"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Copy } from "lucide-react"
import { Button } from "@repo/ui/button"

/**
 * Copy + "what to do next" row under a generated result.
 *
 * The next step is always another Creator AI surface rather than a dead end, * the moment a free result lands is the only moment the visitor is certain the
 * thing works.
 */
export default function ToolResultActions({
  copyText,
  toolSlug,
  nextStep,
}: {
  copyText: string
  toolSlug: string
  nextStep: { href: string; label: string }
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (insecure origin, permissions), the text is on screen
      // to select by hand, so there is nothing useful to say here.
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? (
          <>
            <Check className="mr-1.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
            Copied
          </>
        ) : (
          <>
            <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Copy
          </>
        )}
      </Button>

      <Button asChild size="sm" variant="ghost" className="text-purple-700 hover:text-purple-800">
        <Link href={nextStep.href}>{nextStep.label}</Link>
      </Button>

      <Button
        asChild
        size="sm"
        className="ml-auto bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 text-white hover:brightness-110"
      >
        <Link href={`/signup?ref=tool-${toolSlug}`}>Save it, free account</Link>
      </Button>
    </div>
  )
}
