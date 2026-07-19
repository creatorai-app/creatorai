"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
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
import type { PaginatedResponse } from "@repo/validation"

interface AdminSubscription {
  id: string
  user_id: string | null
  status: string
  billing_interval: string | null
  current_period_start: string | null
  current_period_end: string | null
  ls_subscription_id: string | null
  created_at: string
  plans: { id: string; name: string; price_monthly: number; credits_monthly: number } | null
  profiles: { user_id: string; full_name: string | null; name: string | null; email: string | null; credits: number | null } | null
}

const STATUSES = ["active", "on_trial", "past_due", "canceled", "expired", "unpaid"]

function statusColor(s: string) {
  switch (s) {
    case "active": return "bg-green-900/40 text-green-400"
    case "on_trial": return "bg-blue-900/40 text-blue-400"
    case "past_due":
    case "unpaid": return "bg-orange-900/40 text-orange-400"
    case "canceled":
    case "expired": return "bg-red-900/40 text-red-400"
    default: return "bg-slate-800 text-slate-400"
  }
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—")
const userName = (s: AdminSubscription) => s.profiles?.full_name || s.profiles?.name || "—"

export default function AdminSubscriptionsPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>("all")
  const [data, setData] = useState<PaginatedResponse<AdminSubscription> | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AdminSubscription | null>(null)

  const fetchSubs = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (status !== "all") params.set("status", status)
      const res = await api.get<PaginatedResponse<AdminSubscription>>(
        `/api/v1/admin/subscriptions?${params}`,
        { requireAuth: true }
      )
      setData(res)
    } catch {
      console.error("Failed to fetch subscriptions")
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { fetchSubs() }, [fetchSubs])

  const totalPages = Math.ceil((data?.total || 0) / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Subscriptions</h1>
          <p className="text-slate-400 mt-1">Every user subscription with its plan and billing period</p>
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-slate-300">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Period Start</th>
                <th className="px-4 py-3 font-medium">Period End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-5 bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.data?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No subscriptions found</td>
                </tr>
              ) : (
                data.data.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => setSelected(sub)}
                    className="cursor-pointer hover:bg-slate-900/30"
                  >
                    <td className="px-4 py-3 text-slate-200">{userName(sub)}</td>
                    <td className="px-4 py-3 text-slate-300">{sub.plans?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(sub.status)}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(sub.current_period_start)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(sub.current_period_end)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{data?.total} total subscriptions</p>
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

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Subscription details</DialogTitle>
          </DialogHeader>
          {selected && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Detail label="User" value={userName(selected)} />
              <Detail label="Email" value={selected.profiles?.email || selected.user_id || "—"} />
              <Detail label="Plan" value={selected.plans?.name || "—"} />
              <Detail
                label="Plan price"
                value={selected.plans ? `$${Number(selected.plans.price_monthly).toFixed(2)}/mo` : "—"}
              />
              <Detail
                label="Monthly credits"
                value={selected.plans ? String(selected.plans.credits_monthly) : "—"}
              />
              <Detail
                label="Remaining credits"
                value={selected.profiles?.credits != null ? String(selected.profiles.credits) : "—"}
              />
              <Detail
                label="Status"
                value={
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(selected.status)}`}>
                    {selected.status}
                  </span>
                }
              />
              <Detail label="Billing interval" value={selected.billing_interval || "—"} />
              <Detail label="Period start" value={fmtDate(selected.current_period_start)} />
              <Detail label="Period end" value={fmtDate(selected.current_period_end)} />
              <Detail label="Created" value={fmtDate(selected.created_at)} />
              <div className="col-span-2">
                <Detail label="LS subscription ID" value={selected.ls_subscription_id || "—"} mono />
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
