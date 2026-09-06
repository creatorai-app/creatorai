"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { getFreeToolSession, type FreeToolKind } from "@/lib/free-tool-session"

/**
 * Picks up a `?freeRun=<id>` left by the signup flow and turns it into a real
 * record on this user's account.
 *
 * The visitor generated something at /tools before they had an account. The
 * signup link carried the run id here; the session id that authorizes the claim
 * is still in localStorage, because /tools, /signup and /dashboard are the same
 * origin. The API copies the stored run into the real feature table and hands
 * back where it lives, and we replace the URL with it.
 *
 * Deliberately a hook shared by all three "new" pages rather than three copies:
 * the only thing that differs between them is which page the user happened to
 * land on, and the API already knows which table a run belongs in.
 */
export function useClaimFreeRun(tool: FreeToolKind) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const runId = searchParams.get("freeRun")
  const [claiming, setClaiming] = useState(!!runId)
  // Strict mode mounts effects twice in dev; claiming twice would be harmless
  // (the API is idempotent per run) but would fire two requests for nothing.
  const started = useRef(false)

  useEffect(() => {
    if (!runId || started.current) return
    started.current = true

    let cancelled = false
    ;(async () => {
      try {
        const { redirectTo } = await api.post<{ redirectTo: string }>(
          "/api/v1/free-tools/claim",
          { runId, sessionId: getFreeToolSession() },
          { requireAuth: true },
        )
        if (!cancelled) router.replace(redirectTo)
      } catch (error) {
        if (cancelled) return
        // The form underneath is perfectly usable, so this is a toast and a
        // cleared URL rather than an error page. Losing the result is bad; being
        // stuck on a dead screen because of it is worse.
        toast.error("Could not load your free result", {
          description: getApiErrorMessage(
            error,
            "It may have already been saved to your account. Check your history.",
          ),
        })
        setClaiming(false)
        router.replace(window.location.pathname)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [runId, router, tool])

  return { claiming }
}
