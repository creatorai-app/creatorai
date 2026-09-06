"use client"

import Link from "next/link"
import { Check, Download, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog"
import { Button } from "@repo/ui/button"
import { FREE_TOOL_SIGNUP_BENEFITS } from "@/lib/free-tools"
import { loginHrefForRun, signupHrefForRun, type FreeToolKind } from "@/lib/free-tool-session"

/**
 * The one signup ask on a /tools page, in two moods.
 *
 * "limit"  — shown on the second generation attempt. The visitor already got
 *            something that worked, so the ask is "keep going", not "pay up".
 * "export" — shown when they click Export. Harder ask, better moment: they are
 *            asking to take the result with them, which is the point at which
 *            an account is genuinely the answer rather than a toll.
 *
 * Both carry `runId` so signing up hands the result back instead of losing it.
 * Dismissible in both moods: the result stays on screen either way.
 */
export default function SignupGateModal({
  open,
  onOpenChange,
  toolSlug,
  toolName,
  tool,
  runId = null,
  reason = "limit",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  toolSlug: string
  toolName: string
  /** Which real feature a claimed run materializes into. */
  tool: FreeToolKind
  runId?: string | null
  reason?: "limit" | "export"
}) {
  const signupHref = signupHrefForRun(tool, toolSlug, runId)
  const isExport = reason === "export"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500">
            {isExport ? (
              <Download className="h-6 w-6 text-white" aria-hidden="true" />
            ) : (
              <Sparkles className="h-6 w-6 text-white" aria-hidden="true" />
            )}
          </div>
          <DialogTitle className="text-center text-xl font-bold text-slate-900">
            {isExport
              ? "Create a free account to export"
              : "That was your free one. Want 500 more?"}
          </DialogTitle>
          <DialogDescription className="text-center text-slate-600">
            {isExport ? (
              <>
                Exporting needs an account, and it is free. Sign up and this{" "}
                {toolName} result is waiting in your dashboard, ready to edit,
                export and build on. Nothing is lost.
              </>
            ) : (
              <>
                Create a free Creator AI account to keep using the {toolName} and
                everything else. No credit card.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <ul className="my-2 space-y-2.5">
          {FREE_TOOL_SIGNUP_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2.5 text-sm text-slate-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <Button
            asChild
            className="w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 text-white hover:brightness-110"
          >
            <Link href={signupHref}>
              {isExport ? "Sign up and export" : "Get 500 free credits"}
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full text-slate-600">
            <Link href={loginHrefForRun(tool, runId)}>I already have an account</Link>
          </Button>
        </div>

        <p className="text-center text-xs text-slate-500">
          Free forever plan · 500 credits every month ·{" "}
          <Link href="/pricing" className="underline hover:text-purple-600">
            See all plans
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  )
}
