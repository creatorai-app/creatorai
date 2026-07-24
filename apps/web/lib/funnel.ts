/**
 * Purchase-intent tracking for the pricing page.
 *
 * Lemon Squeezy only ever sees people who already reached its checkout, so the
 * steps above that have to come from us. `checkout_started` is recorded
 * server-side when the checkout session is created, so it is not sent here.
 */

const SESSION_KEY = "caf_session_id"

/** Anonymous, per-tab id so the funnel can count people rather than clicks. */
function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    // Private mode / storage disabled: still track, just as a one-off session.
    return "no-storage"
  }
}

export function trackFunnel(event: "pricing_viewed" | "plan_clicked", tier?: string) {
  if (typeof window === "undefined") return

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

  // keepalive so a plan_clicked fired as the user navigates away still lands.
  fetch(`${backend}/api/v1/billing/funnel`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      tier,
      sessionId: getSessionId(),
      referrer: document.referrer || undefined,
    }),
  }).catch(() => {
    // Analytics must never break the page.
  })
}
