"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Sparkles, FileText } from "lucide-react"
import { Button } from "@repo/ui/button"
import { Textarea } from "@repo/ui/textarea"
import { Label } from "@repo/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import { useFreeTool } from "@/hooks/useFreeTool"
import SignupGateModal from "./SignupGateModal"
import ToolResultActions from "./ToolResultActions"

interface FreeScript {
  title: string
  script: string
}

const SLUG = "youtube-script-generator"

const TONES = [
  { value: "conversational", label: "Conversational" },
  { value: "educational", label: "Educational" },
  { value: "motivational", label: "Motivational" },
  { value: "funny", label: "Funny" },
  { value: "serious", label: "Serious" },
] as const

const DURATIONS = [
  { value: "60", label: "60 seconds (Shorts)" },
  { value: "120", label: "2 minutes" },
  { value: "180", label: "3 minutes" },
  { value: "300", label: "5 minutes" },
] as const

/**
 * Renders the generated markdown without pulling react-markdown into this
 * client bundle. The API is asked for `##` headings, bold and paragraphs and
 * nothing else, so a line-level pass covers it, and anything unmatched still
 * renders as readable text rather than raw syntax.
 */
function ScriptBody({ markdown }: { markdown: string }) {
  const bold = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      ),
    )

  return (
    <div className="mt-4 space-y-3">
      {markdown.split("\n").map((raw, i) => {
        const line = raw.trim()
        if (!line) return null

        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="pt-2 text-base font-semibold text-slate-900">
              {line.slice(4)}
            </h4>
          )
        }
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="pt-3 text-lg font-bold text-slate-900">
              {line.slice(3)}
            </h3>
          )
        }
        if (line.startsWith("# ")) {
          return (
            <h3 key={i} className="pt-3 text-lg font-bold text-slate-900">
              {line.slice(2)}
            </h3>
          )
        }
        if (/^[-*]\s+/.test(line)) {
          return (
            <p key={i} className="pl-4 text-[0.95rem] leading-relaxed text-slate-700">
              • {bold(line.replace(/^[-*]\s+/, ""))}
            </p>
          )
        }
        return (
          <p key={i} className="text-[0.95rem] leading-relaxed text-slate-700">
            {bold(line)}
          </p>
        )
      })}
    </div>
  )
}

export default function ScriptGeneratorWidget() {
  const [topic, setTopic] = useState("")
  const [tone, setTone] = useState<string>("conversational")
  const [duration, setDuration] = useState<string>("180")
  const { result, isLoading, error, showSignupGate, closeSignupGate, run } =
    useFreeTool<FreeScript>(SLUG, "/api/v1/free-tools/script")

  const canSubmit = topic.trim().length >= 3 && !isLoading

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) run({ topic: topic.trim(), tone, duration: Number(duration) })
        }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="space-y-1.5">
          <Label htmlFor="topic" className="text-sm font-medium text-slate-700">
            What is the video about? <span className="text-rose-500">*</span>
          </Label>
          <Textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Why your espresso tastes sour, and the three things to change first"
            maxLength={500}
            rows={3}
            required
            className="bg-white"
          />
          <p className="text-xs text-slate-500">
            A sentence with a point of view beats a keyword. {topic.length}/500
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tone" className="text-sm font-medium text-slate-700">
              Tone
            </Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="tone" className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duration" className="text-sm font-medium text-slate-700">
              Length
            </Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="duration" className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              Writing your script…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              Generate my script
            </>
          )}
        </Button>

        <p className="mt-3 text-xs text-slate-500">
          Free · no account needed for your first script · takes about 20 seconds
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
      </form>

      {result && (
        <div className="mt-6 rounded-2xl border border-purple-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-purple-600">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Your script
          </div>

          <h3 className="mt-3 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
            {result.title}
          </h3>

          <ScriptBody markdown={result.script} />

          <ToolResultActions
            copyText={`${result.title}\n\n${result.script}`}
            toolSlug={SLUG}
            nextStep={{
              href: "/tools/youtube-video-ideas-generator",
              label: "Need the next video idea? →",
            }}
          />
        </div>
      )}

      <SignupGateModal
        open={showSignupGate}
        onOpenChange={(next) => !next && closeSignupGate()}
        toolSlug={SLUG}
        toolName="script generator"
      />

      {result && (
        <p className="mt-4 text-center text-sm text-slate-600">
          Want scripts that sound like <em>you</em>?{" "}
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
