"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select"
import { supportedLanguages } from "@repo/validation"

// Radix Select items cannot have an empty value, so "detect" has a name of its own.
const DETECT = "auto"

/**
 * What the source is spoken in. Left on "Detect automatically", each engine works it
 * out; naming it helps with short clips, strong accents and mixed-language audio. A
 * language picked as a target cannot be the source.
 */
export function DubSourceLanguage({
  value,
  onChange,
  targets,
  disabled,
}: {
  value: string | null
  onChange: (language: string | null) => void
  targets: string[]
  disabled?: boolean
}) {
  return (
    <Select value={value ?? DETECT} onValueChange={(v) => onChange(v === DETECT ? null : v)} disabled={disabled}>
      <SelectTrigger aria-label="Source language">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DETECT}>Detect automatically</SelectItem>
        {supportedLanguages.map((lang) => (
          <SelectItem key={lang.value} value={lang.value} disabled={targets.includes(lang.value)}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
