"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { adminApi } from "@/hooks/useAdmin"
import { ArrowLeft, Edit, Youtube, Shield } from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
import { UserEditDialog } from "@/components/admin/user-edit-dialog"

type Row = Record<string, unknown>

function Field({ label, value }: { label: string; value: unknown }) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "boolean"
        ? value ? "Yes" : "No"
        : String(value)
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-200 mt-0.5 break-words">{display}</dd>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="text-sm font-semibold text-slate-300 mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function AdminUserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string

  const [user, setUser] = useState<Row | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [plans, setPlans] = useState<Array<{ id: string; name: string; credits_monthly: number; price_monthly: number }>>([])

  const fetchUser = useCallback(async () => {
    setLoading(true)
    try {
      setUser(await adminApi.getUser(userId))
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchUser() }, [fetchUser])
  useEffect(() => { adminApi.getPlans().then(setPlans).catch(() => {}) }, [])

  if (loading) {
    return <div className="h-40 rounded-xl bg-slate-800/50 animate-pulse" />
  }
  if (!user) {
    return (
      <div className="space-y-4">
        <AdminButton variant="tertiary" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </AdminButton>
        <p className="text-slate-400">User not found.</p>
      </div>
    )
  }

  const subscriptions = (user.subscriptions as Row[]) ?? []
  const channels = (user.channels as Row[]) ?? []
  const activity = (user.activity as Row[]) ?? []
  const usageCredits = (user.usage_credits as Row[]) ?? []
  const activeSub = subscriptions.find((s) => s.status === "active") ?? null
  const activePlan = activeSub?.plans as { name?: string } | undefined

  // Feed the edit dialog the flat plan_id the list rows carry.
  const editUser: Row = { ...user, plan_id: activeSub?.plan_id ?? null }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <AdminButton variant="tertiary" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </AdminButton>
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              {(user.full_name || user.name || "Unnamed user") as string}
              {user.role === "admin" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-900/40 text-purple-400">
                  <Shield className="h-3 w-3" /> admin
                </span>
              )}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">{user.email as string}</p>
          </div>
        </div>
        <AdminButton variant="primary" onClick={() => setEditing(true)}>
          <Edit className="h-4 w-4 mr-1" /> Edit
        </AdminButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Membership & credits">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Current plan" value={activePlan?.name ?? "Free"} />
            <Field label="Credits" value={user.credits} />
            <Field label="Billing interval" value={activeSub?.billing_interval} />
            <Field label="Status" value={activeSub?.status} />
            <Field label="Period start" value={fmtDate(activeSub?.current_period_start)} />
            <Field label="Renews / ends" value={fmtDate(activeSub?.current_period_end)} />
          </dl>
        </Card>

        <Card title="Identity">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Full name" value={user.full_name} />
            <Field label="Display name" value={user.name} />
            <Field label="Language" value={user.language} />
            <Field label="AI trained" value={user.ai_trained} />
            <Field label="YouTube connected" value={user.youtube_connected} />
            <Field label="Referral code" value={user.referral_code} />
            <Field label="Referred by" value={user.referred_by} />
            <Field label="Total referrals" value={user.total_referrals} />
            <Field label="Joined" value={fmtDate(user.created_at)} />
            <div className="col-span-2">
              <Field label="Bio" value={user.bio} />
            </div>
          </dl>
        </Card>
      </div>

      {subscriptions.length > 0 && (
        <Card title="Subscription history">
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-1 pb-2 font-medium">Plan</th>
                  <th className="px-1 pb-2 font-medium">Status</th>
                  <th className="px-1 pb-2 font-medium">Billing</th>
                  <th className="px-1 pb-2 font-medium">Period</th>
                  <th className="px-1 pb-2 font-medium">LS Sub ID</th>
                  <th className="px-1 pb-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {subscriptions.map((s) => (
                  <tr key={s.id as string}>
                    <td className="px-1 py-2 text-slate-200">{(s.plans as { name?: string })?.name ?? "—"}</td>
                    <td className="px-1 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${subStatusColor(s.status as string)}`}>
                        {(s.status as string) ?? "—"}
                      </span>
                    </td>
                    <td className="px-1 py-2 text-slate-400">{(s.billing_interval as string) ?? "—"}</td>
                    <td className="px-1 py-2 text-slate-500">
                      {fmtDate(s.current_period_start)} – {fmtDate(s.current_period_end)}
                    </td>
                    <td className="px-1 py-2 text-slate-400 font-mono text-xs">{(s.ls_subscription_id as string) || "—"}</td>
                    <td className="px-1 py-2 text-slate-500">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {channels.length > 0 && (
        <Card title="Connected channels">
          <div className="space-y-3">
            {channels.map((c) => (
              <div key={c.id as string} className="flex items-center gap-3">
                <Youtube className="h-5 w-5 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 truncate">{(c.channel_name ?? c.channel_id) as string}</p>
                  <p className="text-xs text-slate-500">
                    {fmtNum(c.subscriber_count)} subscribers · {fmtNum(c.video_count)} videos
                    {c.custom_url ? ` · ${c.custom_url}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Recent activity">
        {activity.length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {activity.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-300">{a.feature as string}</span>
                <span className="text-slate-500">
                  {(a.credits_consumed as number) > 0 ? `${a.credits_consumed} credits · ` : ""}
                  {fmtDate(a.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {usageCredits.length > 0 && (
        <Card title="Usage credit periods">
          <div className="divide-y divide-slate-800">
            {usageCredits.map((u) => (
              <div key={u.id as string} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-500">
                  {fmtDate(u.period_start)} – {fmtDate(u.period_end)}
                </span>
                <span className="text-slate-300">
                  {u.credits_used as number} used · {u.credits_remaining as number} left
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {editing && (
        <UserEditDialog
          user={editUser}
          plans={plans}
          onOpenChange={(open) => setEditing(open)}
          onSaved={fetchUser}
        />
      )}
    </div>
  )
}

function fmtDate(v: unknown): string {
  if (!v) return "—"
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString()
}

function subStatusColor(s: string): string {
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

function fmtNum(v: unknown): string {
  const n = Number(v)
  return isNaN(n) ? "0" : n.toLocaleString()
}
