"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAdminMails, adminApi, type EmailTemplate, type EmailCampaignStats } from "@/hooks/useAdmin"
import { AdminButton } from "@/components/admin/admin-button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import {
  Send, History, PenLine, Inbox, Mail, MailOpen, Archive, Reply, ChevronLeft, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

const CATEGORY_LABELS: Record<string, string> = {
  product_update: "Product Update",
  tips_and_tricks: "Tips & Tricks",
  feature_spotlight: "Feature Spotlight",
  action_required: "Action Required",
  use_case: "Use Case",
  announcement: "Announcement",
}

const TAB_TRIGGER = "data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400"

// useSearchParams must sit inside a Suspense boundary or `next build` fails.
export default function AdminEmailsPage() {
  return (
    <Suspense fallback={<div className="h-64 rounded-xl bg-slate-800/50 animate-pulse" />}>
      <AdminEmailsInner />
    </Suspense>
  )
}

function AdminEmailsInner() {
  const initialTab = useSearchParams().get("tab") === "receiving" ? "receiving" : "sending"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Emails</h1>
        <p className="text-slate-400 mt-1">Send campaigns to users and handle what they send back</p>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="sending" className={TAB_TRIGGER}>
            <Send className="h-4 w-4 mr-1.5" />
            Sending
          </TabsTrigger>
          <TabsTrigger value="receiving" className={TAB_TRIGGER}>
            <Inbox className="h-4 w-4 mr-1.5" />
            Receiving
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sending" className="mt-4">
          <SendingTab />
        </TabsContent>
        <TabsContent value="receiving" className="mt-4">
          <ReceivingTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SendingTab() {
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [stats, setStats] = useState<EmailCampaignStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([adminApi.getEmailTemplates(), adminApi.getEmailStats()])
      .then(([tpls, s]) => { setTemplates(tpls); setStats(s) })
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setLoading(false))
  }, [])

  const byCategory = templates.reduce<Record<string, EmailTemplate[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t)
    return acc
  }, {})

  const compose = (templateId?: string) =>
    router.push(`/dashboard/admin/emails/send${templateId ? `?template=${templateId}` : ""}`)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-400">Send categorized, personalized bulk emails to users</p>
        <div className="flex gap-2">
          <AdminButton variant="secondary" onClick={() => router.push("/dashboard/admin/emails/history")}>
            <History className="h-4 w-4 mr-1" /> History
          </AdminButton>
          <AdminButton variant="primary" onClick={() => compose()}>
            <Send className="h-4 w-4 mr-1" /> Compose
          </AdminButton>
        </div>
      </div>

      {stats && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Sent today (UTC)" value={stats.totals.today} />
          <StatCard label="This month" value={stats.totals.month} />
          <StatCard label="This year" value={stats.totals.year} />
          <StatCard label="All time" value={stats.totals.allTime} />
        </div>
      )}

      {loading ? (
        <div className="h-64 rounded-xl bg-slate-800/50 animate-pulse" />
      ) : (
        <div className="space-y-8">
          {Object.entries(byCategory).map(([cat, tpls]) => (
            <div key={cat} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tpls.map((t) => {
                  const s = stats?.byTemplate[t.id]
                  const delivered = s?.delivered ?? 0
                  const audience = stats?.audienceSize ?? 0
                  const pct = audience > 0 ? Math.min(100, Math.round((delivered / audience) * 100)) : 0
                  return (
                    <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col gap-3">
                      <div>
                        <div className="text-slate-100 font-medium">{t.name}</div>
                        <div className="text-xs text-slate-500 mt-1 line-clamp-2">{t.subject}</div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>{delivered} of {audience} reached</span>
                          <span>
                            {s?.batches ? `${s.batches} batch${s.batches > 1 ? "es" : ""}` : "not sent yet"}
                          </span>
                        </div>
                        {s?.lastSentAt && (
                          <div className="text-[11px] text-slate-600">Last sent {new Date(s.lastSentAt).toLocaleDateString()}</div>
                        )}
                      </div>

                      <AdminButton variant="tertiary" size="sm" className="self-start" onClick={() => compose(t.id)}>
                        <PenLine className="h-3.5 w-3.5 mr-1" /> Use
                      </AdminButton>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-100 mt-1">{value.toLocaleString()}</div>
    </div>
  )
}

function ReceivingTab() {
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-400">Contact form messages and inquiries</p>
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
                    onClick={() => router.push(`/dashboard/admin/emails/inbox/${mail.id}`)}
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
