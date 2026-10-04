"use client"

import { AudioLines, Cpu } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { DUB_ENGINES, DUB_ENGINE_INFO, dubbableLanguagesFor, type DubEngine } from "@repo/validation"

const ICONS: Record<DubEngine, React.ComponentType<{ className?: string }>> = {
  cypher: Cpu,
  elevenlabs: AudioLines,
}

/** The two dubbing pipelines as a radio group. They cost the same; only the languages differ. */
export function DubEngineCards({
  engine,
  onSelect,
  disabled,
}: {
  engine: DubEngine
  onSelect: (engine: DubEngine) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Dubbing engine" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {DUB_ENGINES.map((e) => {
        const { name, description } = DUB_ENGINE_INFO[e]
        const Icon = ICONS[e]
        const active = engine === e
        return (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(e)}
            disabled={disabled}
            title={description}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-60",
              active
                ? "border-purple-500 bg-purple-50/70 ring-1 ring-purple-500 dark:bg-purple-900/20"
                : "border-slate-200 bg-white hover:border-purple-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-purple-700",
            )}
          >
            <span
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                active ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{name}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {dubbableLanguagesFor(e).length} languages
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
