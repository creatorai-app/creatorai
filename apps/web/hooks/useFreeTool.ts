"use client"

import { useCallback, useState } from "react"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { getFreeToolSession } from "@/lib/free-tool-session"

/**
 * One free generation per visitor, then a signup prompt.
 *
 * The localStorage flag is a nudge, not a wall, clearing storage or opening a
 * private window resets it, and that is fine. Someone determined enough to do
 * that is not the person the gate is for, and the per-IP window on the API is
 * the actual ceiling. Making it harder here would only punish the people who
 * came back a week later on the same laptop.
 *
 * Every run is also stored server-side against the visitor's session id, so the
 * result survives the trip through /signup and can be claimed into the new
 * account instead of being lost. `runId` is what the export CTA carries.
 *
 * ponytail: localStorage, same as the Hannah chat history. Move to a cookie if
 * the gate ever needs to be read server-side for a personalized first render.
 */

const usedKey = (tool: string) => `free-tool-used-${tool}`

function hasUsed(tool: string): boolean {
  try {
    return localStorage.getItem(usedKey(tool)) === "1"
  } catch {
    // Private mode / storage disabled: never gate someone we cannot remember.
    return false
  }
}

function markUsed(tool: string) {
  try {
    localStorage.setItem(usedKey(tool), "1")
  } catch {
    // Nothing to do, the API rate limit still applies.
  }
}

/** Every free-tool response carries the id of the stored run, when it stored. */
type WithRunId = { runId?: string | null }

export function useFreeTool<TResult>(tool: string, endpoint: string) {
  const [result, setResult] = useState<TResult | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSignupGate, setShowSignupGate] = useState(false)
  const [gateReason, setGateReason] = useState<"limit" | "export">("limit")

  const run = useCallback(
    async (body: Record<string, unknown>) => {
      // The gate is checked before the request, so the second attempt costs
      // nothing and the modal opens instantly.
      if (hasUsed(tool)) {
        setGateReason("limit")
        setShowSignupGate(true)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const data = await api.post<TResult & WithRunId>(endpoint, {
          ...body,
          sessionId: getFreeToolSession(),
        })
        setResult(data)
        setRunId(data.runId ?? null)
        markUsed(tool)
      } catch (err) {
        // A 429 means the per-IP window is spent, which is the same conversation
        // as the gate, ask for the signup rather than showing a dead end.
        const message = getApiErrorMessage(err, "That didn't generate. Please try again.")
        if ((err as { statusCode?: number })?.statusCode === 429) {
          setGateReason("limit")
          setShowSignupGate(true)
        } else {
          setError(message)
        }
      } finally {
        setIsLoading(false)
      }
    },
    [tool, endpoint],
  )

  return {
    result,
    runId,
    isLoading,
    error,
    showSignupGate,
    gateReason,
    /** Export is account-only: the file is the ask that earns the signup. */
    requestExport: useCallback(() => {
      setGateReason("export")
      setShowSignupGate(true)
    }, []),
    openSignupGate: useCallback(() => {
      setGateReason("limit")
      setShowSignupGate(true)
    }, []),
    closeSignupGate: useCallback(() => setShowSignupGate(false), []),
    run,
  }
}
