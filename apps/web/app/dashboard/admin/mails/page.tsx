"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAdminMails, adminApi } from "@/hooks/useAdmin"
import { ChevronLeft, ChevronRight, Mail, Archive, Reply, MailOpen } from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import { toast } from "sonner"

export default function AdminMailsPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const { data, total, loading, refresh } = useAdminMails(page, statusFilter)

  const totalPages = Math.ceil((total || 0) / 20)

  const statusColor = (s: string) => {
    switch (s) {
      case "unread": return "bg-blue-900/40 text-blue-400"
      case "read": return "bg-slate-800 text-slate-400"
      case "replied": return "bg-green-900/40 text-green-400"
      case "archived": return "bg-slate-800 text-slate-500"
      default: return "bg-slate-800 text-slate-400"
    }
  }

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await adminApi.updateMailStatus(id, status)
      toast.success("Mail status updated")
      refresh()
    } catch {
      toast.error("Failed to update status")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Mails</h1>
        <p className="text-slate-400 mt-1">Manage contact form messages and inquiries</p>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium w-8"></th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-5 bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No mails found</td>
                </tr>
              ) : (
                data.map((mail) => (
                  <tr
                    key={mail.id}
                    className={`hover:bg-slate-900/30 cursor-pointer ${mail.status === "unread" ? "bg-slate-900/20" : ""}`}
                    onClick={() => router.push(`/dashboard/admin/mails/${mail.id}`)}
                  >
                    <td className="px-4 py-3">
                      {mail.status === "unread" ? (
                        <Mail className="h-4 w-4 text-blue-400" />
                      ) : (
                        <MailOpen className="h-4 w-4 text-slate-600" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={mail.status === "unread" ? "text-slate-100 font-medium" : "text-slate-400"}>
                        {mail.from_name || mail.from_email}
                      </div>
                      {mail.from_name && (
                        <div className="text-xs text-slate-500">{mail.from_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{mail.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(mail.status)}`}>
                        {mail.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(mail.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleStatusUpdate(mail.id, "replied")}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-green-400"
                          title="Mark as replied"
                        >
                          <Reply className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(mail.id, "archived")}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                          title="Archive"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{total} mails</p>
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
