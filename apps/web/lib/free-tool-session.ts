/**
 * The visitor's free-tool session id, and the signup link that carries a run
 * through to the dashboard.
 *
 * The id is generated in the browser and kept in localStorage. It is what makes
 * "sign up and keep what you just made" possible: the API stores every
 * anonymous run against it, and the claim after signup has to present it. That
 * also makes it the authorization for a claim, which is why it is a v4 UUID and
 * not something derived from the visitor.
 *
 * Same origin throughout (/tools, /signup, /dashboard), so it survives the whole
 * flow without a cookie or a query param.
 */

const SESSION_KEY = "free-tool-session"

/** Where a claimed run of each tool should land the user. */
export const FREE_TOOL_CLAIM_ROUTE = {
  script: "/dashboard/scripts/new",
  idea: "/dashboard/research/new",
  story: "/dashboard/story-builder/new",
} as const

export type FreeToolKind = keyof typeof FREE_TOOL_CLAIM_ROUTE

function uuid(): string {
  // randomUUID needs a secure context; the fallback keeps the tools working on
  // plain http in local dev rather than throwing where a result is on screen.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (
      Number(c) ^
      (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))
    ).toString(16),
  )
}

export function getFreeToolSession(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const created = uuid()
    localStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    // Storage blocked: the run is still stored server-side and still usable in
    // this tab, it just cannot be claimed after a reload. Better than failing
    // the generation.
    return uuid()
  }
}

/**
 * The dashboard page that claims `runId`, or plain /dashboard when there is
 * nothing to claim (the run failed to store, or storage was blocked).
 */
export function claimPathForRun(tool: FreeToolKind, runId: string | null): string {
  return runId ? `${FREE_TOOL_CLAIM_ROUTE[tool]}?freeRun=${runId}` : "/dashboard"
}

/**
 * The signup URL that brings a free result into the new account.
 *
 * `next` is read by /signup and by the OAuth callback, both of which only honor
 * paths under /dashboard. The dashboard page then sees `freeRun` and claims it.
 */
export function signupHrefForRun(tool: FreeToolKind, toolSlug: string, runId: string | null): string {
  const params = new URLSearchParams({ ref: `tool-${toolSlug}` })
  if (runId) params.set("next", claimPathForRun(tool, runId))
  return `/signup?${params.toString()}`
}

/** Same destination for someone who already has an account. */
export function loginHrefForRun(tool: FreeToolKind, runId: string | null): string {
  return `/login?redirectTo=${encodeURIComponent(claimPathForRun(tool, runId))}`
}
