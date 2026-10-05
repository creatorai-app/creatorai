"use client"

import { cn } from "@repo/ui/lib/utils"
import { DUB_VOICE_MODES, DUB_VOICE_MODE_INFO, type DubEngine, type DubVoiceMode } from "@repo/validation"

/**
 * How close each dubbed voice stays to the original speaker, as a radio group. The
 * helper line under each option says what it does on the chosen engine, since the two
 * engines get there differently.
 */
export function DubVoiceModePicker({
  engine,
  value,
  onChange,
  disabled,
}: {
  engine: DubEngine
  value: DubVoiceMode
  onChange: (mode: DubVoiceMode) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Voice" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {DUB_VOICE_MODES.map((mode) => {
        const { label, help } = DUB_VOICE_MODE_INFO[mode]
        const active = value === mode
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode)}
            disabled={disabled}
            className={cn(
              "rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              active
                ? "border-purple-500 bg-purple-50/70 ring-1 ring-purple-500 dark:bg-purple-900/20"
                : "border-slate-200 bg-white hover:border-purple-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-purple-700",
            )}
          >
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{help[engine]}</span>
          </button>
        )
      })}
    </div>
  )
}
