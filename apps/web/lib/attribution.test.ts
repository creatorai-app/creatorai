import { captureAttribution, readAttribution } from "./attribution"

/**
 * Referral and promo credit has to survive the signup detour between landing and
 * checkout. Dropping it here means an affiliate goes unpaid on a sale they made.
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function land(search: string) {
  window.history.replaceState({}, "", `/pricing${search}`)
}

describe("captureAttribution", () => {
  beforeEach(() => {
    localStorage.clear()
    land("")
  })

  it("stores a referral code with the time it was seen", () => {
    land("?ref=afrin")
    captureAttribution()
    expect(JSON.parse(localStorage.getItem("affiliate_ref")!)).toMatchObject({ code: "afrin" })
  })

  it("captures a referral and a promo code from the same landing", () => {
    land("?ref=afrin&promo=LAUNCH20")
    captureAttribution()
    expect(readAttribution("affiliate_ref")).toBe("afrin")
    expect(readAttribution("promo_code")).toBe("LAUNCH20")
  })

  it("trims whitespace a pasted link tends to carry", () => {
    land("?ref=%20afrin%20")
    captureAttribution()
    expect(readAttribution("affiliate_ref")).toBe("afrin")
  })

  it("ignores an empty parameter rather than storing a blank code", () => {
    land("?ref=")
    captureAttribution()
    expect(localStorage.getItem("affiliate_ref")).toBeNull()
  })

  it("leaves an earlier capture alone when the next page carries no parameters", () => {
    land("?ref=afrin")
    captureAttribution()
    land("/pricing")
    captureAttribution()
    expect(readAttribution("affiliate_ref")).toBe("afrin")
  })

  it("lets a newer link overwrite the stored code", () => {
    land("?ref=first")
    captureAttribution()
    land("?ref=second")
    captureAttribution()
    expect(readAttribution("affiliate_ref")).toBe("second")
  })
})

describe("readAttribution", () => {
  beforeEach(() => localStorage.clear())

  it("returns undefined when nothing was ever captured", () => {
    expect(readAttribution("affiliate_ref")).toBeUndefined()
  })

  it("honors a code inside the 30 day window", () => {
    localStorage.setItem(
      "affiliate_ref",
      JSON.stringify({ code: "afrin", ts: Date.now() - THIRTY_DAYS_MS + 60_000 }),
    )
    expect(readAttribution("affiliate_ref")).toBe("afrin")
  })

  it("drops an expired code and clears it, so it is not re-checked forever", () => {
    localStorage.setItem(
      "affiliate_ref",
      JSON.stringify({ code: "afrin", ts: Date.now() - THIRTY_DAYS_MS - 1 }),
    )
    expect(readAttribution("affiliate_ref")).toBeUndefined()
    expect(localStorage.getItem("affiliate_ref")).toBeNull()
  })

  it("survives malformed stored data instead of breaking checkout", () => {
    localStorage.setItem("promo_code", "{not json")
    expect(readAttribution("promo_code")).toBeUndefined()
  })
})
