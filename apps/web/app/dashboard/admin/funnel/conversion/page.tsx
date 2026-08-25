"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { api } from "@/lib/api-client"
import { useAdminFunnel } from "@/hooks/useAdmin"
import { StatCard, type StatConfig } from "@/components/admin/stat-card"
import { AdminButton } from "@/components/admin/admin-button"
import { Input } from "@repo/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog"
import {
  Eye,
  MousePointerClick,
  CreditCard,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
} from "lucide-react"
import type {
  AdminFunnelEvent,
  FunnelEventName,
  FunnelTierBreakdown,
  PaginatedResponse,
} from "@repo/validation"

const PAGE_SIZE = 25

const EVENT_META: Record<FunnelEventName, { label: string; className: string }> = {
  pricing_viewed: { label: "Pricing viewed", className: "bg-slate-800 text-slate-300" },
  plan_clicked: { label: "Plan clicked", className: "bg-blue-900/40 text-blue-400" },
  checkout_started: { label: "Checkout started", className: "bg-purple-900/40 text-purple-400" },
}

const fmtTime = (d: string) =>
  new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const visitorName = (e: AdminFunnelEvent) =>
  e.profile?.full_name || e.profile?.name || e.profile?.email || "Anonymous visitor"

/** Referrers are full URLs; the host alone is what makes a table row readable. */
function referrerHost(referrer: string | null) {
  if (!referrer) return "Direct"
  try {
    return new URL(referrer).hostname.replace(/^www\./, "")
  } catch {
    return referrer
  }
}

/** Percentage of the named preceding step that made it to this one. */
const stepRate = (value: number, previous: number, previousLabel: string) =>
  previous > 0
    ? `${Math.round((value / previous) * 1000) / 10}% of ${previousLabel}`
    : undefined

export default function ConversionFunnelPage() {
  const { funnel, loading: funnelLoading, refresh } = useAdminFunnel()

  const [page, setPage] = useState(1)
  const [event, setEvent] = useState("all")
  const [tier, setTier] = useState("all")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [events, setEvents] = useState<PaginatedResponse<AdminFunnelEvent> | null>(null)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [selected, setSelected] = useState<AdminFunnelEvent | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      setEventsLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (event !== "all") params.set("event", event)
      if (tier !== "all") params.set("tier", tier)
      if (search) params.set("search", search)
      const res = await api.get<PaginatedResponse<AdminFunnelEvent>>(
        `/api/v1/admin/funnel/events?${params}`,
        { requireAuth: true }
      )
      setEvents(res)
    } catch {
      console.error("Failed to fetch funnel events")
    } finally {
      setEventsLoading(false)
    }
  }, [page, event, tier, search])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const totalPages = Math.ceil((events?.total || 0) / PAGE_SIZE)
  const tierNames = funnel?.byTier.map((t) => t.tier) ?? []

  const steps: StatConfig[] = funnel
    ? [
      { label: "Pricing Viewed", value: funnel.pricingViewed, icon: Eye, gradient: "from-slate-500 to-slate-400", accent: "text-slate-300" },
      { label: "Plan Clicked", value: funnel.planClicked, icon: MousePointerClick, gradient: "from-blue-500 to-cyan-500", accent: "text-blue-400", hint: stepRate(funnel.planClicked, funnel.pricingViewed, "pricing views") },
      { label: "Checkout Started", value: funnel.checkoutStarted, icon: CreditCard, gradient: "from-purple-500 to-fuchsia-500", accent: "text-purple-400", hint: stepRate(funnel.checkoutStarted, funnel.planClicked, "plan clicks") },
      { label: "Completed", value: funnel.completed, icon: TrendingUp, gradient: "from-emerald-500 to-teal-500", accent: "text-emerald-400", hint: stepRate(funnel.completed, funnel.checkoutStarted, "checkouts started") },
    ]
    : []

  const applySearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Conversion Funnel</h1>
        </div>
        <AdminButton
          variant="secondary"
          onClick={() => { refresh(); fetchEvents() }}
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </AdminButton>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Steps</h2>
        </div>
        {funnelLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl border border-slate-800 bg-slate-900 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        )}
      </section>

      {!!funnel?.byTier.length && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">By Tier</h2>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                    <th className="text-left font-medium py-3 px-5">Tier</th>
                    <th className="text-right font-medium py-3 px-5">Clicked</th>
                    <th className="text-right font-medium py-3 px-5">Checkout</th>
                    <th className="text-right font-medium py-3 px-5">Completed</th>
                    <th className="text-right font-medium py-3 px-5">Abandoned</th>
                    <th className="text-right font-medium py-3 px-5">Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.byTier.map((t: FunnelTierBreakdown) => (
                    <tr key={t.tier} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900">
                      <td className="py-3 px-5 text-slate-100 font-medium">{t.tier}</td>
                      <td className="py-3 px-5 text-right text-slate-300 tabular-nums">{t.clicked}</td>
                      <td className="py-3 px-5 text-right text-slate-300 tabular-nums">{t.checkoutStarted}</td>
                      <td className="py-3 px-5 text-right text-emerald-400 tabular-nums">{t.completed}</td>
                      <td className="py-3 px-5 text-right text-amber-400 tabular-nums">{t.abandoned}</td>
                      <td className="py-3 px-5 text-right text-slate-300 tabular-nums">{t.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Event Feed</h2>
          <div className="flex gap-2 flex-wrap">
            <form
              onSubmit={(e) => { e.preventDefault(); applySearch(searchInput) }}
              className="relative"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Session or referrer"
                className="w-52 pl-9 bg-slate-800 border-slate-700 text-slate-300 placeholder:text-slate-500"
              />
            </form>
            <Select value={event} onValueChange={(v) => { setEvent(v); setPage(1) }}>
              <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-slate-300">
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All events</SelectItem>
                {Object.entries(EVENT_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tier} onValueChange={(v) => { setTier(v); setPage(1) }}>
              <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-300">
                <SelectValue placeholder="All tiers" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All tiers</SelectItem>
                {tierNames.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-slate-900/50 text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Step</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Who</th>
                  <th className="px-4 py-3 font-medium">Referrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {eventsLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-5 bg-slate-800 rounded animate-pulse" /></td></tr>
                  ))
                ) : !events?.data?.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No funnel events found</td>
                  </tr>
                ) : (
                  events.data.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className="cursor-pointer hover:bg-slate-900/30"
                    >
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtTime(e.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_META[e.event]?.className ?? "bg-slate-800 text-slate-400"}`}>
                          {EVENT_META[e.event]?.label ?? e.event}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{e.tier || "—"}</td>
                      <td className="px-4 py-3 text-slate-200">
                        <span className={e.profile ? "" : "text-slate-500 italic"}>{visitorName(e)}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{referrerHost(e.referrer)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{events?.total} total events</p>
            <div className="flex gap-2">
              <AdminButton variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </AdminButton>
              <span className="flex items-center text-sm text-slate-400 px-2">{page} / {totalPages}</span>
              <AdminButton variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </AdminButton>
            </div>
          </div>
        )}
      </section>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Funnel event</DialogTitle>
          </DialogHeader>
          {selected && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Detail
                label="Step"
                value={
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_META[selected.event]?.className ?? "bg-slate-800 text-slate-400"}`}>
                    {EVENT_META[selected.event]?.label ?? selected.event}
                  </span>
                }
              />
              <Detail label="Tier" value={selected.tier || "—"} />
              <Detail label="Time" value={new Date(selected.created_at).toLocaleString()} />
              <Detail label="Visitor" value={visitorName(selected)} />
              <Detail label="Email" value={selected.profile?.email || "—"} />
              <Detail
                label="Credits"
                value={selected.profile?.credits != null ? String(selected.profile.credits) : "—"}
              />
              <div className="col-span-2">
                <Detail
                  label="User"
                  value={
                    selected.user_id ? (
                      <Link
                        href={`/dashboard/admin/users/${selected.user_id}`}
                        className="text-purple-300 hover:text-purple-200 font-mono text-xs break-all"
                      >
                        {selected.user_id}
                      </Link>
                    ) : (
                      "Signed out"
                    )
                  }
                />
              </div>
              <div className="col-span-2">
                <Detail label="Session" value={selected.session_id} mono />
              </div>
              <div className="col-span-2">
                <Detail label="Referrer" value={selected.referrer || "Direct"} mono />
              </div>
              <div className="col-span-2">
                <Detail label="Event ID" value={selected.id} mono />
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-slate-200 break-words ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  )
}
