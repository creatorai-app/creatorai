"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { adminApi, type EmailTemplate } from "@/hooks/useAdmin"
import { AdminButton } from "@/components/admin/admin-button"
import { Send, History, PenLine } from "lucide-react"
import { toast } from "sonner"

const CATEGORY_LABELS: Record<string, string> = {
  product_update: "Product Update",
  tips_and_tricks: "Tips & Tricks",
  feature_spotlight: "Feature Spotlight",
  action_required: "Action Required",
  use_case: "Use Case",
  announcement: "Announcement",
}

export default function EmailTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getEmailTemplates()
      .then(setTemplates)
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
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Emails</h1>
          <p className="text-slate-400 mt-1">Send categorized, personalized bulk emails to users</p>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="secondary" onClick={() => router.push("/dashboard/admin/emails/history")}>
            <History className="h-4 w-4 mr-1" /> History
          </AdminButton>
          <AdminButton variant="primary" onClick={() => compose()}>
            <Send className="h-4 w-4 mr-1" /> Compose
          </AdminButton>
        </div>
      </div>

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
                {tpls.map((t) => (
                  <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col gap-3">
                    <div>
                      <div className="text-slate-100 font-medium">{t.name}</div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-2">{t.subject}</div>
                    </div>
                    <AdminButton variant="tertiary" size="sm" className="self-start" onClick={() => compose(t.id)}>
                      <PenLine className="h-3.5 w-3.5 mr-1" /> Use
                    </AdminButton>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
