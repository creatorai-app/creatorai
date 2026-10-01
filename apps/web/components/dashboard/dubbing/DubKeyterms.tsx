"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Input } from "@repo/ui/input"
import { DUB_KEYTERMS_MAX, keytermProblem, normalizeKeyterms } from "@repo/validation"

/**
 * Names and terms the dub should keep as they are, as chips. Enter or a comma adds one;
 * pasting a comma-separated list adds them all. Each is checked against the same rules
 * the API applies, so a refused term is explained here rather than after the upload.
 */
export function DubKeyterms({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (terms: string[]) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState("")
  const [problem, setProblem] = useState<string | null>(null)

  const add = (raw: string) => {
    const terms = raw.split(",").map((t) => t.trim()).filter(Boolean)
    if (!terms.length) return
    const bad = terms.map(keytermProblem).find(Boolean)
    if (bad) {
      setProblem(bad)
      return
    }
    const next = normalizeKeyterms([...value, ...terms])
    if (next.length > DUB_KEYTERMS_MAX) {
      setProblem(`You can add up to ${DUB_KEYTERMS_MAX} names and terms.`)
      return
    }
    onChange(next)
    setDraft("")
    setProblem(null)
  }

  return (
    <div className="space-y-2">
      <Input
        aria-label="Add a name or term"
        placeholder="Brand, product or person, then Enter"
        value={draft}
        disabled={disabled || value.length >= DUB_KEYTERMS_MAX}
        onChange={(e) => {
          setDraft(e.target.value)
          setProblem(null)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            add(draft)
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
      {problem && <p className="text-xs text-red-600 dark:text-red-400">{problem}</p>}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Names and terms">
          {value.map((term) => (
            <li
              key={term}
              className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-purple-800 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-200"
            >
              {term}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== term))}
                disabled={disabled}
                aria-label={`Remove ${term}`}
                className="rounded-full p-0.5 hover:bg-purple-200/60 dark:hover:bg-purple-800/60"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
