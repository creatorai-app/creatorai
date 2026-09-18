import { trackFunnel } from "./funnel"

/**
 * Analytics sits on the pricing page, the most valuable page on the site. The
 * one rule it must never break is taking the page down with it.
 */

describe("trackFunnel", () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    sessionStorage.clear()
    fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  const body = () => JSON.parse(fetchMock.mock.calls[0][1].body)

  it("posts the event and tier to the billing funnel endpoint", () => {
    trackFunnel("plan_clicked", "Pro")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/v1\/billing\/funnel$/)
    expect(init.method).toBe("POST")
    expect(body()).toMatchObject({ event: "plan_clicked", tier: "Pro" })
  })

  it("keeps the request alive so a click that navigates away still lands", () => {
    trackFunnel("plan_clicked", "Pro")
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true)
  })

  it("reuses one session id across events, so the funnel counts people not clicks", () => {
    trackFunnel("pricing_viewed")
    trackFunnel("plan_clicked", "Pro")
    const [first, second] = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).sessionId)
    expect(first).toBe(second)
    expect(first).toBeTruthy()
  })

  it("still reports when storage is disabled, as a one-off session", () => {
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    trackFunnel("pricing_viewed")
    expect(body().sessionId).toBe("no-storage")
    spy.mockRestore()
  })

  it("omits the tier on a page view, which has no plan attached", () => {
    trackFunnel("pricing_viewed")
    expect(body().tier).toBeUndefined()
  })

  it("swallows a failed request rather than surfacing it on the page", async () => {
    fetchMock.mockRejectedValue(new Error("offline"))
    expect(() => trackFunnel("pricing_viewed")).not.toThrow()
    // Flush the rejection so it is handled, not reported as unhandled.
    await Promise.resolve()
  })
})
