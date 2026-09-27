"use client"

import { useState } from "react"
import { ChevronDown, ListOrdered } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui/collapsible"
import type { DubTimelineSegment } from "@repo/validation"

/** "1:05.3": minutes, seconds and tenths, enough to find a line in the player. */
function formatAt(seconds: number): string {
  const whole = Math.max(0, seconds)
  const m = Math.floor(whole / 60)
  const s = (whole % 60).toFixed(1).padStart(4, "0")
  return `${m}:${s}`
}

/**
 * One language's lines: when each was said, by whom, what was said and what it became.
 * Collapsed by default, since a long video has hundreds of lines. Clicking a row plays
 * the dub from that line.
 */
export function DubTimeline({
  segments,
  speakerLabel,
  onSeek,
}: {
  segments: DubTimelineSegment[]
  speakerLabel?: (id: string) => string
  onSeek?: (seconds: number) => void
}) {
  const [open, setOpen] = useState(false)
  const label = speakerLabel ?? ((id: string) => id)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
        <span className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-purple-500" />
          Timeline
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{segments.length} lines</span>
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-2 max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {segments.map((segment) => {
            const at = segment.dubStart ?? segment.start
            const row = (
              <>
                <span className="w-16 shrink-0 font-mono text-xs text-slate-500 dark:text-slate-400">{formatAt(at)}</span>
                <span className="w-20 shrink-0 truncate text-xs font-medium text-purple-700 dark:text-purple-300">{label(segment.speaker)}</span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  {/* dir="auto": Arabic, Hebrew and Urdu lines read right to left. */}
                  <span dir="auto" className="block text-sm text-slate-500 dark:text-slate-400">{segment.sourceText}</span>
                  <span dir="auto" className="block text-sm text-slate-900 dark:text-slate-100">
                    {segment.translation ?? <em className="text-slate-400">Not dubbed</em>}
                  </span>
                </span>
              </>
            )
            return (
              <li key={segment.id}>
                {onSeek ? (
                  <button
                    type="button"
                    onClick={() => onSeek(at)}
                    className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-purple-50/60 dark:hover:bg-purple-900/10"
                    aria-label={`Play from ${formatAt(at)}`}
                  >
                    {row}
                  </button>
                ) : (
                  <div className="flex items-start gap-3 px-3 py-2">{row}</div>
                )}
              </li>
            )
          })}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  )
}
