"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { adminApi, type EmailSendHistoryItem } from "@/hooks/useAdmin"
import { AdminButton } from "@/components/admin/admin-button"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"

const CATEGORY_LABELS: Record<string, string> = {
  product_update: "Product Update",
  tips_and_tricks: "Tips & Tricks",
  feature_spotlight: "Feature Spotlight",
  action_required: "Action Required",
  use_case: "Use Case",
  announcement: "Announcement",
}

const statusColor = (s: string) => {
  switch (s) {
    case "sent": return "bg-green-900/40 text-green-400"
    case "partial_failure": return "bg-amber-900/40 text-amber-400"
    case "failed": return "bg-red-900/40 text-red-400"
    default: return "bg-slate-800 text-slate-400"
  }
}

export default function EmailHistoryPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<EmailSendHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.getEmailHistory(page)
      setData(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      toast.error("Failed to load history")
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil((total || 0) / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AdminButton variant="tertiary" size="icon" onClick={() => router.push("/dashboard/admin/emails")}>
          <ArrowLeft className="h-4 w-4" />
        </AdminButton>
        <h1 className="text-2xl font-bold text-slate-100">Send history</h1>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">Recipients</th>
                <th className="px-4 py-3 font-medium">Edited</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-5 bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : !data.length ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No campaigns sent yet</td></tr>
              ) : (
                data.map((s) => (
                  <tr key={s.id} onClick={() => router.push(`/dashboard/admin/emails/history/${s.id}`)}
                    className="hover:bg-slate-900/30 cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="text-slate-200">{s.email_templates?.name ?? "—"}</div>
                      <div className="text-xs text-slate-500">{CATEGORY_LABELS[s.email_templates?.category ?? ""] ?? s.email_templates?.category}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{s.from_address}</td>
                    <td className="px-4 py-3 text-slate-300">{s.recipient_count}</td>
                    <td className="px-4 py-3 text-slate-400">{s.custom_html_used ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status)}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(s.sent_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{total} campaigns</p>
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
