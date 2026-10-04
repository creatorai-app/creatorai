"use client"

import { supportedLanguages } from "@repo/validation"
import { DubLanguagePicker } from "@/components/dashboard/dubbing/DubLanguagePicker"

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
    <DubLanguagePicker
      value={value ?? DETECT}
      onChange={(v) => onChange(v === DETECT ? null : v)}
      options={[
        { value: DETECT, label: "Detect automatically" },
        ...supportedLanguages.map((lang) => ({ ...lang, disabled: targets.includes(lang.value) })),
      ]}
      ariaLabel="Source language"
      disabled={disabled}
    />
  )
}
