"use client"

import { Plus, X } from "lucide-react"
import { Button } from "@repo/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select"
import { accentsFor, DUB_ENGINE_INFO, DUB_ENGINES, dubbableLanguagesFor, type DubEngine, type DubTarget } from "@repo/validation"
import { DubLanguagePicker } from "@/components/dashboard/dubbing/DubLanguagePicker"

/**
 * The languages to dub into, one output each, up to the plan's `max`. Each row picks a
 * language and, where the engine honours one, a dialect (ElevenLabs Dubbing v2). The
 * languages only the other engine speaks are listed greyed out, so a search for one says
 * where to find it. The source language, when one is picked, cannot be a target.
 */
export function DubLanguageTargets({
  engine,
  targets,
  onChange,
  max,
  disabled,
  sourceLanguage,
}: {
  engine: DubEngine
  targets: DubTarget[]
  onChange: (targets: DubTarget[]) => void
  max: number
  disabled?: boolean
  sourceLanguage?: string | null
}) {
  const languages = dubbableLanguagesFor(engine)
  const other = DUB_ENGINES.find((e) => e !== engine)!
  const otherOnly = dubbableLanguagesFor(other).filter((l) => !languages.some((mine) => mine.value === l.value))
  const rows = targets.length ? targets : [{ language: "" }]

  const setRow = (index: number, next: DubTarget) =>
    onChange(rows.map((row, i) => (i === index ? next : row)).filter((t) => t.language))

  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const accents = row.language ? accentsFor(row.language, engine) : []
        const taken = new Set([...rows.filter((_, i) => i !== index).map((r) => r.language), ...(sourceLanguage ? [sourceLanguage] : [])])
        return (
          <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DubLanguagePicker
              value={row.language}
              // A new language clears the dialect: it belonged to the old one.
              onChange={(language) => setRow(index, { language })}
              options={[
                ...languages.map((lang) => ({
                  ...lang,
                  disabled: taken.has(lang.value),
                  note: lang.value === sourceLanguage ? "The source" : undefined,
                })),
                ...otherOnly.map((lang) => ({ ...lang, disabled: true, note: `Only on ${DUB_ENGINE_INFO[other].name}` })),
              ]}
              ariaLabel={`Language ${index + 1}`}
              disabled={disabled}
              className="sm:flex-1"
            />

            {accents.length > 0 && (
              <Select
                value={row.accent ?? ""}
                onValueChange={(accent) => setRow(index, { language: row.language, accent })}
                disabled={disabled}
              >
                <SelectTrigger aria-label={`Dialect for language ${index + 1}`} className="sm:w-52 focus:ring-0 focus:ring-offset-0 focus:border-purple-400">
                  <SelectValue placeholder="Default dialect" />
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

      {max > 1 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...targets, { language: "" }])}
          disabled={disabled || rows.length >= max || !rows[rows.length - 1]?.language}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add language ({rows.length}/{max})
        </Button>
      )}
    </div>
  )
}
