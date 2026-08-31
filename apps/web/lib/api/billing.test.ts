import { api } from "@/lib/api-client"
import { getBillingInfo, invalidateBilling } from "./billing"

jest.mock("@/lib/api-client", () => ({ api: { get: jest.fn() } }))

const mockedGet = api.get as jest.Mock

describe("billing cache", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    invalidateBilling()
    mockedGet.mockReset()
  })

  afterEach(() => jest.useRealTimers())

  it("serves concurrent and repeat callers from one request", async () => {
    mockedGet.mockResolvedValue({ currentPlan: null, subscription: null, credits: 0 })

    await Promise.all([getBillingInfo(), getBillingInfo()])
    await getBillingInfo()

    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it("refetches once the window has passed", async () => {
    mockedGet.mockResolvedValue({ currentPlan: null, subscription: null, credits: 0 })

    await getBillingInfo()
    jest.advanceTimersByTime(30_001)
    await getBillingInfo()

    expect(mockedGet).toHaveBeenCalledTimes(2)
  })

  it("does not replay a failure for the rest of the window", async () => {
    mockedGet.mockRejectedValueOnce(new Error("boom"))
    mockedGet.mockResolvedValueOnce({ currentPlan: null, subscription: null, credits: 5 })

    await expect(getBillingInfo()).rejects.toThrow("boom")
    await expect(getBillingInfo()).resolves.toEqual({
      currentPlan: null,
      subscription: null,
      credits: 5,
    })
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })

  it("invalidateBilling forces a fresh read", async () => {
    mockedGet.mockResolvedValue({ currentPlan: null, subscription: null, credits: 0 })

    await getBillingInfo()
    invalidateBilling()
    await getBillingInfo()

    expect(mockedGet).toHaveBeenCalledTimes(2)
  })
})
