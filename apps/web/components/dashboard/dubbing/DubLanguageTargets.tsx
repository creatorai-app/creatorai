"use client"

import { Plus, X } from "lucide-react"
import { Button } from "@repo/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select"
import { accentsFor, dubbableLanguagesFor, type DubEngine, type DubTarget } from "@repo/validation"

/**
 * The languages to dub into, one output each, up to the plan's `max`. Each row picks a
 * language and, where the engine honours one, an accent.
 */
export function DubLanguageTargets({
  engine,
  targets,
  onChange,
  max,
  disabled,
}: {
  engine: DubEngine
  targets: DubTarget[]
  onChange: (targets: DubTarget[]) => void
  max: number
  disabled?: boolean
}) {
  const languages = dubbableLanguagesFor(engine)
  const rows = targets.length ? targets : [{ language: "" }]

  const setRow = (index: number, next: DubTarget) =>
    onChange(rows.map((row, i) => (i === index ? next : row)).filter((t) => t.language))

  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const accents = row.language ? accentsFor(row.language, engine) : []
        const taken = new Set(rows.filter((_, i) => i !== index).map((r) => r.language))
        return (
          <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={row.language}
              // A new language clears the accent: it belonged to the old one.
              onValueChange={(language) => setRow(index, { language })}
              disabled={disabled}
            >
              <SelectTrigger aria-label={`Language ${index + 1}`} className="sm:flex-1">
                <SelectValue placeholder="Select a language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value} disabled={taken.has(lang.value)}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {accents.length > 0 && (
              <Select
                value={row.accent ?? ""}
                onValueChange={(accent) => setRow(index, { language: row.language, accent })}
                disabled={disabled}
              >
                <SelectTrigger aria-label={`Accent for language ${index + 1}`} className="sm:w-48">
                  <SelectValue placeholder="Default accent" />
                </SelectTrigger>
                <SelectContent>
                  {accents.map((accent) => (
                    <SelectItem key={accent.value} value={accent.value}>{accent.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end sm:self-auto"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                disabled={disabled}
                aria-label={`Remove language ${index + 1}`}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {max > 1 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...targets, { language: "" }])}
            disabled={disabled || rows.length >= max || !rows[rows.length - 1]?.language}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add language
          </Button>
        ) : <span />}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Your plan dubs into up to {max} language{max === 1 ? "" : "s"} at once. Each language is charged as its own dub.
        </span>
      </div>
    </div>
  )
}
