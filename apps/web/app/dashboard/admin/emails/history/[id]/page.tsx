"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { adminApi, type EmailCampaignDetail } from "@/hooks/useAdmin"
import { AdminButton } from "@/components/admin/admin-button"
import { ArrowLeft } from "lucide-react"

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

function segmentSummary(f: EmailCampaignDetail["segment_filter"]): string {
  if (!f || Object.keys(f).length === 0) return "All users"
  const parts: string[] = []
  if (typeof f.channelConnected === "boolean") parts.push(`channel ${f.channelConnected ? "connected" : "not connected"}`)
  if (typeof f.modelTrained === "boolean") parts.push(`AI ${f.modelTrained ? "trained" : "untrained"}`)
  if (f.planTier) parts.push(`${f.planTier} plan`)
  if (f.signupBeforeDays) parts.push(`signed up ≥ ${f.signupBeforeDays}d ago`)
  return parts.join(" · ") || "All users"
}

export default function CampaignDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [c, setC] = useState<EmailCampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    adminApi.getEmailCampaign(id)
      .then(setC)
      .catch(() => setC(null))
      .finally(() => setLoading(false))
  }, [id])

  const resizeFrame = useCallback(() => {
    const frame = frameRef.current
    const doc = frame?.contentDocument
    if (frame && doc?.body) frame.style.height = `${doc.body.scrollHeight + 8}px`
  }, [])

  if (loading) return <div className="h-64 rounded-xl bg-slate-800/50 animate-pulse" />

  if (!c) {
    return (
      <div className="space-y-4">
        <AdminButton variant="tertiary" onClick={() => router.push("/dashboard/admin/emails/history")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </AdminButton>
        <p className="text-slate-400">Campaign not found.</p>
      </div>
    )
  }

  const errors = Array.isArray(c.error_details) ? c.error_details : c.error_details ? [c.error_details] : []

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <AdminButton variant="tertiary" size="icon" onClick={() => router.push("/dashboard/admin/emails/history")}>
          <ArrowLeft className="h-4 w-4" />
        </AdminButton>
        <h1 className="text-2xl font-bold text-slate-100">{c.email_templates?.name ?? "Campaign"}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(c.status)}`}>{c.status}</span>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 grid gap-3 sm:grid-cols-2">
        <Row label="Category" value={CATEGORY_LABELS[c.email_templates?.category ?? ""] ?? c.email_templates?.category ?? "—"} />
        <Row label="Subject" value={c.email_templates?.subject ?? "—"} />
        <Row label="From" value={c.from_address} />
        <Row label="Recipients" value={String(c.recipient_count)} />
        <Row label="Edited before send" value={c.custom_html_used ? "Yes" : "No"} />
        <Row label="Sent" value={new Date(c.sent_at).toLocaleString()} />
        <Row label="Segment filter" value={segmentSummary(c.segment_filter)} />
        <Row label="Resend batches" value={String(c.resend_batch_ids?.length ?? 0)} />
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-red-400">Errors</h2>
          <pre className="text-xs text-red-300/90 whitespace-pre-wrap break-words">{JSON.stringify(errors, null, 2)}</pre>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-3 text-sm font-semibold text-slate-300">
          Recipients ({c.recipients.length})
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-800">
          {c.recipients.length === 0 ? (
            <div className="px-5 py-6 text-center text-slate-500 text-sm">No recipient records found</div>
          ) : (
            c.recipients.map((r) => (
              <div key={r.id} className="px-5 py-2.5">
                <div className="text-sm text-slate-200 truncate">{r.fullName || r.email}</div>
                <div className="text-xs text-slate-500 truncate">{r.email}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {c.custom_html_used && c.custom_html && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-300">Sent HTML (edited)</h2>
          <iframe ref={frameRef} title="Sent email" onLoad={resizeFrame} srcDoc={c.custom_html}
            sandbox="allow-same-origin" className="w-full rounded-lg bg-white" style={{ minHeight: 300, border: "none" }} />
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 text-right break-all">{value}</span>
    </div>
  )
}
