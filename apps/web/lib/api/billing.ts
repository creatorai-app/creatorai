import { api } from "@/lib/api-client"

export interface Plan {
  id: string
  name: string
  price_monthly: number
  price_annual_monthly: number | null
  credits_monthly: number
  features: string[]
  is_active: boolean
  tagline: string | null
  ls_variant_id: string | null
  ls_variant_id_annual: string | null
}

export interface SubscriptionInfo {
  id: string
  status: string
  currentPeriodEnd: string | null
  lsSubscriptionId: string | null
}

export interface BillingInfo {
  currentPlan: Plan | null
  subscription: SubscriptionInfo | null
  credits: number
}

/**
 * useBilling is mounted by six components across the dashboard, so plans and
 * subscription info were refetched on every mount and every settings tab switch.
 * The window is short enough that credits can't visibly drift, and anything that
 * changes billing calls invalidateBilling() rather than waiting it out.
 */
const CACHE_MS = 30_000

const cache = new Map<string, { at: number; promise: Promise<unknown> }>()

function cachedGet<T>(endpoint: string, requireAuth: boolean): Promise<T> {
  const hit = cache.get(endpoint)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise as Promise<T>

  // Failures evict immediately: a blip must not be replayed for the whole window.
  const promise = api.get<T>(endpoint, { requireAuth }).catch((error) => {
    cache.delete(endpoint)
    throw error
  })
  cache.set(endpoint, { at: Date.now(), promise })
  return promise
}

export const getPlans = () => cachedGet<Plan[]>("/api/v1/billing/plans", false)

export const getBillingInfo = () => cachedGet<BillingInfo>("/api/v1/billing/info", true)

export function invalidateBilling(): void {
  cache.clear()
}
