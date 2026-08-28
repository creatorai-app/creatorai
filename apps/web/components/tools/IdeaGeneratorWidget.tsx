"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Sparkles, Lightbulb, Target, Hash, ListOrdered, Gauge } from "lucide-react"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { useFreeTool } from "@/hooks/useFreeTool"
import SignupGateModal from "./SignupGateModal"
import ToolResultActions from "./ToolResultActions"

interface FreeIdea {
  title: string
  titleVariations: string[]
  uniqueAngle: string
  whyItWorks: string
  hookAngle: string
  suggestedFormat: string
  targetKeywords: string[]
  talkingPoints: string[]
  opportunityScore: number
}

const SLUG = "youtube-video-ideas-generator"

/** Green above 70, amber above 40, red below, an honest score has to look honest. */
function scoreTone(score: number) {
  if (score >= 70) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (score >= 40) return "bg-amber-50 text-amber-700 border-amber-200"
  return "bg-rose-50 text-rose-700 border-rose-200"
}

export default function IdeaGeneratorWidget() {
  const [niche, setNiche] = useState("")
  const [audience, setAudience] = useState("")
  const { result, isLoading, error, showSignupGate, closeSignupGate, run } =
    useFreeTool<FreeIdea>(SLUG, "/api/v1/free-tools/idea")

  const canSubmit = niche.trim().length >= 3 && !isLoading

  const asPlainText = (idea: FreeIdea) =>
    [
      idea.title,
      "",
      `Also try: ${idea.titleVariations.join(" | ")}`,
      "",
      `Angle: ${idea.uniqueAngle}`,
      `Why it works: ${idea.whyItWorks}`,
      `Hook: ${idea.hookAngle}`,
      `Format: ${idea.suggestedFormat}`,
      `Keywords: ${idea.targetKeywords.join(", ")}`,
      "",
      "Talking points:",
      ...idea.talkingPoints.map((p, i) => `${i + 1}. ${p}`),
    ].join("\n")

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) run({ niche: niche.trim(), audience: audience.trim() || undefined })
        }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="niche" className="text-sm font-medium text-slate-700">
              Your niche or topic <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="niche"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="home espresso for beginners"
              maxLength={200}
              required
              className="bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audience" className="text-sm font-medium text-slate-700">
              Who is it for? <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              id="audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="people who just bought their first machine"
              maxLength={200}
              className="bg-white"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
          className="mt-4 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 text-white hover:brightness-110 sm:w-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Finding an angle…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              Generate my video idea
            </>
          )}
        </Button>

        <p className="mt-3 text-xs text-slate-500">
          Free · no account needed for your first idea · takes about 10 seconds
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
      </form>

      {result && (
        <div className="mt-6 rounded-2xl border border-purple-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-purple-600">
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              Your video idea
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreTone(result.opportunityScore)}`}
            >
              <Gauge className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Opportunity {Math.round(result.opportunityScore)}/100
            </span>
          </div>

          <h3 className="mt-3 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
            {result.title}
          </h3>

          {result.titleVariations.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {result.titleVariations.map((variation) => (
                <li key={variation} className="text-sm text-slate-600">
                  <span className="mr-1.5 text-slate-400">Also try:</span>
                  {variation}
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Target className="h-4 w-4 text-purple-600" aria-hidden="true" />
                The angle
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600">{result.uniqueAngle}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-800">Why it works</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600">{result.whyItWorks}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-semibold text-slate-800">First 15 seconds</dt>
              <dd className="mt-1 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                {result.hookAngle}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-800">Suggested format</dt>
              <dd className="mt-1 text-sm text-slate-600">{result.suggestedFormat}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Hash className="h-4 w-4 text-purple-600" aria-hidden="true" />
                Target keywords
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {result.targetKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs text-purple-700"
                  >
                    {keyword}
                  </span>
                ))}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <ListOrdered className="h-4 w-4 text-purple-600" aria-hidden="true" />
                Talking points
              </dt>
              <dd className="mt-2">
                <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
                  {result.talkingPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ol>
              </dd>
            </div>
          </dl>

          <ToolResultActions
            copyText={asPlainText(result)}
            toolSlug={SLUG}
            nextStep={{
              href: "/tools/youtube-script-generator",
              label: "Turn this into a full script →",
            }}
          />
        </div>
      )}

      <SignupGateModal
        open={showSignupGate}
        onOpenChange={(next) => !next && closeSignupGate()}
        toolSlug={SLUG}
        toolName="video ideas generator"
      />

      {result && (
        <p className="mt-4 text-center text-sm text-slate-600">
          Want ideas built from your own channel's data?{" "}
          <Link
            href={`/signup?ref=tool-${SLUG}`}
            className="font-medium text-purple-600 underline hover:text-purple-700"
          >
            Create a free account
          </Link>{" "}
          and get 500 credits a month.
        </p>
      )}
    </div>
  )
}
