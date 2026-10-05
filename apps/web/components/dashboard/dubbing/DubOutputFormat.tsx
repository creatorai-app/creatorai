"use client"

import { cn } from "@repo/ui/lib/utils"
import { DUB_OUTPUT_FORMATS, DUB_OUTPUT_FORMAT_INFO, type DubOutputFormat } from "@repo/validation"

/**
 * What the dub comes back as: the video, or the dubbed track alone. Only a video can come
 * back as a video. `videoUnavailable` keeps MP4 in view but off, saying why (a video whose
 * audio alone is in storage).
 */
export function DubOutputFormatPicker({
  value,
  onChange,
  allowVideo,
  videoUnavailable,
  disabled,
}: {
  value: DubOutputFormat
  onChange: (format: DubOutputFormat) => void
  allowVideo: boolean
  videoUnavailable?: string
  disabled?: boolean
}) {
  const formats = DUB_OUTPUT_FORMATS.filter((f) => allowVideo || videoUnavailable || f !== "mp4")
  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Output"
        className={cn("grid grid-cols-1 gap-2", formats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}
      >
        {formats.map((format) => {
          const { label, help } = DUB_OUTPUT_FORMAT_INFO[format]
          const active = value === format
          const off = format === "mp4" && !!videoUnavailable
          return (
            <button
              key={format}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(format)}
              disabled={disabled || off}
              title={off ? videoUnavailable : help}
              className={cn(
                "rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                active
                  ? "border-purple-500 bg-purple-50/70 ring-1 ring-purple-500 dark:bg-purple-900/20"
                  : "border-slate-200 bg-white hover:border-purple-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-purple-700",
              )}
            >
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
            </button>
          )
        })}
      </div>
      {videoUnavailable && <p className="text-xs text-slate-500 dark:text-slate-400">{videoUnavailable}</p>}
    </div>
  )
}
