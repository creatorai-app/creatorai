"use client"

import { useState } from "react"
import { useAdminActivities } from "@/hooks/useAdmin"
import {
  ChevronLeft,
  ChevronRight,
  Activity as ActivityIcon,
  Sparkles,
  AlertTriangle,
  CreditCard,
  Handshake,
  MailX,
} from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import type { ActivityFeedItem } from "@repo/validation"

const CATEGORY = {
  feature: { icon: Sparkles, color: "text-violet-400", ring: "bg-violet-500/10" },
  error: { icon: AlertTriangle, color: "text-red-400", ring: "bg-red-500/10" },
  subscription: { icon: CreditCard, color: "text-cyan-400", ring: "bg-cyan-500/10" },
  affiliate: { icon: Handshake, color: "text-indigo-400", ring: "bg-indigo-500/10" },
  unsubscribe: { icon: MailX, color: "text-amber-400", ring: "bg-amber-500/10" },
} as const

function statusColor(s: string | null) {
  switch (s) {
    case "completed":
    case "active":
    case "confirmed":
    case "paid":
    case "approved": return "bg-green-900/40 text-green-400"
    case "failed":
    case "denied":
    case "refunded": return "bg-red-900/40 text-red-400"
    case "processing":
    case "queued":
    case "pending":
    case "dubbing": return "bg-yellow-900/40 text-yellow-400"
    default: return "bg-slate-800 text-slate-400"
  }
}

export default function AdminActivitiesPage() {
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState("")
  const { data, total, loading } = useAdminActivities(page, category)

  const totalPages = Math.ceil((total || 0) / 30)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Activity Log</h1>
        <p className="text-slate-400 mt-1">Every user action — feature usage, errors, subscriptions and affiliate activity</p>
      </div>

      <div className="flex gap-3">
        <Select value={category || "all"} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="All activity" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All activity</SelectItem>
            <SelectItem value="feature">Feature usage</SelectItem>
            <SelectItem value="error">Errors</SelectItem>
            <SelectItem value="subscription">Subscriptions</SelectItem>
            <SelectItem value="affiliate">Affiliate</SelectItem>
            <SelectItem value="unsubscribe">Unsubscribes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-900 border border-slate-800 rounded-lg animate-pulse" />
          ))
        ) : !data?.length ? (
          <div className="text-center py-12 text-slate-500">
            <ActivityIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No activities recorded yet</p>
          </div>
        ) : (
          data.map((a: ActivityFeedItem) => {
            const cat = CATEGORY[a.category] ?? CATEGORY.feature
            const Icon = cat.icon
            const who = a.profiles?.full_name || a.profiles?.name || a.profiles?.email || "Unknown user"
            return (
              <div key={a.id} className="flex items-start gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
                <div className={`mt-0.5 h-8 w-8 rounded-full ${cat.ring} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 ${cat.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">
                    <span className="font-medium">{who}</span>{" "}
                    <span className="text-slate-400">·</span>{" "}
                    <span className={`font-medium ${cat.color}`}>{a.label}</span>{" "}
                    <span className="text-slate-400">{a.action.replace(/_/g, " ")}</span>
                    {a.credits_consumed > 0 && (
                      <span className="text-slate-500 text-xs ml-1.5">({a.credits_consumed} credits)</span>
                    )}
                  </p>
                  {a.profiles?.email && (
                    <p className="text-xs text-slate-500 truncate">{a.profiles.email}</p>
                  )}
                  {a.error_message && (
                    <p className="text-xs text-red-400/90 mt-1 break-words">{a.error_message}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {a.status && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(a.status)}`}>
                      {a.status}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{total} activities</p>
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
    </div>
  )
}
