import {
  FREE_TOOL_CLAIM_ROUTE,
  claimPathForRun,
  getFreeToolSession,
  loginHrefForRun,
  signupHrefForRun,
} from "./free-tool-session"

/**
 * The session id is the authorization for claiming an anonymous run, and the
 * hrefs are what carry a free result through signup into the dashboard. A wrong
 * link here loses the thing the visitor just made.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("getFreeToolSession", () => {
  beforeEach(() => localStorage.clear())

  it("mints a v4 uuid on first use and stores it", () => {
    const id = getFreeToolSession()
    expect(id).toMatch(UUID)
    expect(localStorage.getItem("free-tool-session")).toBe(id)
  })

  it("returns the same id on every later call, so a run stays claimable", () => {
    expect(getFreeToolSession()).toBe(getFreeToolSession())
  })

  it("still returns a usable id when storage is blocked", () => {
    // Private mode throws on getItem; the generation must not fail with a result
    // already on screen.
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(getFreeToolSession()).toMatch(UUID)
    spy.mockRestore()
  })

  it("falls back to a random id when randomUUID is unavailable", () => {
    // randomUUID needs a secure context, which plain-http local dev is not.
    const original = crypto.randomUUID
    // @ts-expect-error - deliberately removing the API to exercise the fallback
    crypto.randomUUID = undefined
    const id = getFreeToolSession()
    expect(id).toMatch(UUID)
    crypto.randomUUID = original
  })
})

describe("claimPathForRun", () => {
  it.each(Object.keys(FREE_TOOL_CLAIM_ROUTE) as Array<keyof typeof FREE_TOOL_CLAIM_ROUTE>)(
    "sends a %s run to its own dashboard page",
    (tool) => {
      expect(claimPathForRun(tool, "run-1")).toBe(`${FREE_TOOL_CLAIM_ROUTE[tool]}?freeRun=run-1`)
    },
  )

  it("falls back to the dashboard root when there is nothing to claim", () => {
    expect(claimPathForRun("script", null)).toBe("/dashboard")
  })

  it("only ever points inside /dashboard, which is all the callback honors", () => {
    for (const route of Object.values(FREE_TOOL_CLAIM_ROUTE)) {
      expect(route.startsWith("/dashboard/")).toBe(true)
    }
  })
})

describe("signupHrefForRun", () => {
  it("tags the signup with the tool it came from and carries the run forward", () => {
    const href = signupHrefForRun("script", "youtube-script-generator", "run-1")
    const params = new URLSearchParams(href.split("?")[1])
    expect(params.get("ref")).toBe("tool-youtube-script-generator")
    expect(params.get("next")).toBe("/dashboard/scripts/new?freeRun=run-1")
  })

  it("omits `next` entirely when the run was never stored", () => {
    const href = signupHrefForRun("idea", "youtube-idea-generator", null)
    expect(new URLSearchParams(href.split("?")[1]).get("next")).toBeNull()
  })

  it("encodes the nested query so `next` survives as one parameter", () => {
    expect(signupHrefForRun("story", "story-builder", "run-1")).toContain("freeRun%3Drun-1")
  })
})

describe("loginHrefForRun", () => {
  it("routes an existing account to the same claim page", () => {
    const href = loginHrefForRun("idea", "run-1")
    expect(new URLSearchParams(href.split("?")[1]).get("redirectTo")).toBe(
      "/dashboard/research/new?freeRun=run-1",
    )
  })

  it("sends a login with nothing to claim to the dashboard root", () => {
    expect(loginHrefForRun("idea", null)).toBe(`/login?redirectTo=${encodeURIComponent("/dashboard")}`)
  })
})
