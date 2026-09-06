"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Sparkles, Clapperboard, Gauge, Anchor, Layers, Flag } from "lucide-react"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Textarea } from "@repo/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import {
  AUDIENCE_LEVELS,
  AUDIENCE_LEVEL_LABELS,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  STORY_MODES,
  STORY_MODE_LABELS,
  VIDEO_DURATIONS,
  VIDEO_DURATION_LABELS,
  type StoryBuilderResult,
} from "@repo/validation"
import { useFreeTool } from "@/hooks/useFreeTool"
import SignupGateModal from "./SignupGateModal"
import ToolResultActions from "./ToolResultActions"
import { TOOL_FIELD, TOOL_FIELD_TEXTAREA } from "./field-styles"

const SLUG = "free-youtube-story-structure-generator"

// CSS rather than motion, deliberately. A motion `initial={{ opacity: 0 }}`
// leaves the element invisible until the LazyMotion feature bundle has loaded
// and run, and if that never happens the generated blueprint never appears at
// all. Same reasoning as the script and idea widgets.
const RISE = "animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500"

/** Green above 7, amber above 5, red below. An honest score has to look honest. */
function scoreTone(score: number) {
  if (score >= 7) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (score >= 5) return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-rose-50 text-rose-700 border-rose-200"
}

const RISK_TONE: Record<string, string> = {
  low: "text-emerald-700",
  medium: "text-amber-700",
  high: "text-rose-700",
}

/**
 * The plain-text form of a blueprint, for the Copy button.
 *
 * Only the sections the page renders. The stored run keeps everything, and the
 * rest appears in the dashboard once the run is claimed.
 */
function asPlainText(r: StoryBuilderResult): string {
  const b = r.structuredBlueprint
  return [
    "HOOK (0-15s)",
    b.hook.openingLine,
    `Curiosity: ${b.hook.curiosityStatement}`,
    `Promise: ${b.hook.promise}`,
    `Stakes: ${b.hook.stakes}`,
    `On screen: ${b.hook.visualSuggestion}`,
    "",
    "CONTEXT (15-45s)",
    `Problem: ${b.contextSetup.problem}`,
    `Why it matters: ${b.contextSetup.whyItMatters}`,
    "",
    "ESCALATION",
    ...b.escalationSegments.map((s) =>
      [
        `${s.segmentNumber}. ${s.title} (${s.estimatedDuration})`,
        `   Micro-hook: ${s.microHook}`,
        `   Insight: ${s.insight}`,
        `   Into the next: ${s.transitionTension}`,
      ].join("\n"),
    ),
    "",
    "CLIMAX",
    `Biggest insight: ${b.climax.biggestInsight}`,
    `Twist: ${b.climax.unexpectedTwist}`,
    "",
    "RESOLUTION",
    `Close the loop: ${b.resolution.closeLoop}`,
    `Soft CTA: ${b.resolution.softCTA}`,
    "",
    `Retention score: ${r.tensionMapping.retentionScore}/10 (drop risk: ${r.tensionMapping.predictedDropRisk})`,
  ].join("\n")
}

export default function StoryStructureWidget() {
  const [videoTopic, setVideoTopic] = useState("")
  const [targetAudience, setTargetAudience] = useState("")
  const [audienceLevel, setAudienceLevel] = useState<string>("general")
  const [videoDuration, setVideoDuration] = useState<string>("medium")
  const [contentType, setContentType] = useState<string>("tutorial")
  const [storyMode, setStoryMode] = useState<string>("conversational")

  const {
    result,
    runId,
    isLoading,
    error,
    showSignupGate,
    gateReason,
    requestExport,
    closeSignupGate,
    run,
  } = useFreeTool<StoryBuilderResult>(SLUG, "/api/v1/free-tools/story")

  const canSubmit = videoTopic.trim().length >= 3 && !isLoading

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit)
            run({
              videoTopic: videoTopic.trim(),
              targetAudience: targetAudience.trim(),
              audienceLevel,
              videoDuration,
              contentType,
              storyMode,
            })
        }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="space-y-1.5">
          <Label htmlFor="video-topic" className="text-sm font-medium text-slate-700">
            What is the video about? <span className="text-rose-500">*</span>
          </Label>
          <Textarea
            id="video-topic"
            value={videoTopic}
            onChange={(e) => setVideoTopic(e.target.value)}
            placeholder="Why your espresso tastes sour, and the three things to change first"
            maxLength={500}
            rows={3}
            required
            className={TOOL_FIELD_TEXTAREA}
          />
          <p className="text-xs text-slate-500">
            A promise structures better than a topic. {videoTopic.length}/500
          </p>
        </div>

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="target-audience" className="text-sm font-medium text-slate-700">
            Who is it for? <span className="text-slate-400">(optional)</span>
          </Label>
          <Input
            id="target-audience"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="People who just bought their first machine"
            maxLength={300}
            className={TOOL_FIELD}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            {
              id: "video-duration",
              label: "Length",
              value: videoDuration,
              onChange: setVideoDuration,
              options: VIDEO_DURATIONS.map((v) => ({ value: v, label: VIDEO_DURATION_LABELS[v] })),
            },
            {
              id: "content-type",
              label: "Structure template",
              value: contentType,
              onChange: setContentType,
              options: CONTENT_TYPES.map((v) => ({ value: v, label: CONTENT_TYPE_LABELS[v] })),
            },
            {
              id: "story-mode",
              label: "Story mode",
              value: storyMode,
              onChange: setStoryMode,
              options: STORY_MODES.map((v) => ({ value: v, label: STORY_MODE_LABELS[v] })),
            },
            {
              id: "audience-level",
              label: "Audience level",
              value: audienceLevel,
              onChange: setAudienceLevel,
              options: AUDIENCE_LEVELS.map((v) => ({ value: v, label: AUDIENCE_LEVEL_LABELS[v] })),
            },
          ].map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={field.id} className="text-sm font-medium text-slate-700">
                {field.label}
              </Label>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.id} className={TOOL_FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
          className="mt-5 h-12 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 text-base font-medium text-white transition hover:brightness-110"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Structuring your video…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              Build my story structure
            </>
          )}
        </Button>

        <p className="mt-3 text-xs text-slate-500">
          Free · no account needed for your first blueprint · takes about 30 seconds
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
      </form>

      {result && (
        <div className={`${RISE} mt-6 rounded-2xl border border-purple-200 bg-white p-5 shadow-sm sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-purple-600">
              <Clapperboard className="h-4 w-4" aria-hidden="true" />
              Your story blueprint
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreTone(
                result.tensionMapping.retentionScore,
              )}`}
            >
              <Gauge className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Retention {result.tensionMapping.retentionScore}/10
            </span>
          </div>

          <section className={`${RISE} delay-150 mt-5`}>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Anchor className="h-4 w-4 text-purple-600" aria-hidden="true" />
              Hook · first 15 seconds
            </h3>
            <p className="mt-2 rounded-lg bg-slate-50 p-3 text-[0.95rem] font-medium leading-relaxed text-slate-800">
              {result.structuredBlueprint.hook.openingLine}
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["Promise", result.structuredBlueprint.hook.promise],
                ["Stakes", result.structuredBlueprint.hook.stakes],
                ["Curiosity", result.structuredBlueprint.hook.curiosityStatement],
                ["On screen", result.structuredBlueprint.hook.visualSuggestion],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {term}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-600">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={`${RISE} delay-300 mt-6`}>
            <h3 className="text-sm font-semibold text-slate-900">Context · 15 to 45 seconds</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {result.structuredBlueprint.contextSetup.problem}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {result.structuredBlueprint.contextSetup.whyItMatters}
            </p>
          </section>

          <section className={`${RISE} delay-300 mt-6`}>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Layers className="h-4 w-4 text-purple-600" aria-hidden="true" />
              Escalation segments
            </h3>
            <ol className="mt-3 space-y-3">
              {result.structuredBlueprint.escalationSegments.map((segment) => (
                <li
                  key={segment.segmentNumber}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-semibold text-slate-900">
                      {segment.segmentNumber}. {segment.title}
                    </h4>
                    <span className="text-xs text-slate-500">{segment.estimatedDuration}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    <span className="font-medium text-slate-800">Micro-hook: </span>
                    {segment.microHook}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{segment.insight}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                    <span className="font-medium">Into the next: </span>
                    {segment.transitionTension}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className={`${RISE} delay-500 mt-6 grid gap-4 sm:grid-cols-2`}>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Climax</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {result.structuredBlueprint.climax.biggestInsight}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                <span className="font-medium">Twist: </span>
                {result.structuredBlueprint.climax.unexpectedTwist}
              </p>
            </div>
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Flag className="h-4 w-4 text-purple-600" aria-hidden="true" />
                Resolution
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {result.structuredBlueprint.resolution.closeLoop}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                <span className="font-medium">Soft CTA: </span>
                {result.structuredBlueprint.resolution.softCTA}
              </p>
            </div>
          </section>

          <p className="mt-6 rounded-xl border border-purple-100 bg-purple-50/60 p-4 text-sm leading-relaxed text-slate-700">
            <span className="font-semibold text-slate-900">
              Drop risk:{" "}
              <span className={RISK_TONE[result.tensionMapping.predictedDropRisk] ?? "text-slate-700"}>
                {result.tensionMapping.predictedDropRisk}
              </span>
              .
            </span>{" "}
            This blueprint also carries {result.tensionMapping.curiosityLoops} curiosity loops,{" "}
            {result.retentionBeats?.length ?? 0} retention beats, pattern interrupts, the emotional
            arc, CTA placements and a full production outline. Export it to see all of it in your
            dashboard.
          </p>

          <ToolResultActions
            copyText={asPlainText(result)}
            toolSlug={SLUG}
            tool="story"
            runId={runId}
            onExport={requestExport}
            nextStep={{
              href: "/tools/free-youtube-script-generator",
              label: "Turn this into a full script →",
            }}
          />
        </div>
      )}

      <SignupGateModal
        open={showSignupGate}
        onOpenChange={(next) => !next && closeSignupGate()}
        toolSlug={SLUG}
        toolName="story structure generator"
        tool="story"
        runId={runId}
        reason={gateReason}
      />

      {result && (
        <p className="mt-4 text-center text-sm text-slate-600">
          Want a blueprint built around <em>your</em> pacing?{" "}
          <Link
            href={`/signup?ref=tool-${SLUG}`}
            className="font-medium text-purple-600 underline hover:text-purple-700"
          >
            Create a free account
          </Link>{" "}
          and train the AI on your own videos.
        </p>
      )}
    </div>
  )
}
