"use client"

import { useState, useEffect } from "react"
import { adminApi } from "@/hooks/useAdmin"
import { AdminButton } from "@/components/admin/admin-button"
import { Input } from "@repo/ui/input"
import { Textarea } from "@repo/ui/textarea"
import { Switch } from "@repo/ui/switch"
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
  DialogFooter,
} from "@repo/ui/dialog"
import { toast } from "sonner"

type Plan = { id: string; name: string; credits_monthly: number }

// Profile fields the admin can edit. Mirrors ALLOWED_USER_FIELDS on the API.
const TEXT_FIELDS: Array<{ key: string; label: string; type?: string }> = [
  { key: "full_name", label: "Full name" },
  { key: "name", label: "Display name" },
  { key: "email", label: "Email", type: "email" },
  { key: "avatar_url", label: "Avatar URL" },
  { key: "language", label: "Language" },
  { key: "referral_code", label: "Referral code" },
  { key: "referred_by", label: "Referred by" },
]

export function UserEditDialog({
  user,
  plans,
  onOpenChange,
  onSaved,
}: {
  user: Record<string, unknown> | null
  plans: Plan[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [planId, setPlanId] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm({
      full_name: user.full_name ?? "",
      name: user.name ?? "",
      email: user.email ?? "",
      avatar_url: user.avatar_url ?? "",
      bio: user.bio ?? "",
      language: user.language ?? "",
      referral_code: user.referral_code ?? "",
      referred_by: user.referred_by ?? "",
      role: (user.role as string) ?? "user",
      credits: user.credits ?? 0,
      ai_trained: !!user.ai_trained,
      youtube_connected: !!user.youtube_connected,
    })
    setPlanId((user.plan_id as string) ?? "")
  }, [user])

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!user) return
    setSaving(true)
    try {
      // Plan first — this grants the plan's credit allowance — then the profile
      // fields, so any manual credits override wins.
      if (planId && planId !== ((user.plan_id as string) ?? "")) {
        await adminApi.setUserPlan(user.user_id as string, planId)
      }
      await adminApi.updateUser(user.user_id as string, {
        ...form,
        credits: Number(form.credits),
      })
      toast.success("User updated")
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error("Failed to update user")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          {TEXT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-sm text-slate-400 mb-1 block">{f.label}</label>
              <Input
                type={f.type ?? "text"}
                value={(form[f.key] as string) ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>
          ))}

          <div>
            <label className="text-sm text-slate-400 mb-1 block">Role</label>
            <Select value={form.role as string} onValueChange={(v) => set("role", v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-1 block">Plan</label>
            <Select
              value={planId}
              onValueChange={(v) => {
                setPlanId(v)
                const p = plans.find((pl) => pl.id === v)
                if (p) set("credits", p.credits_monthly)
              }}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-1 block">Credits</label>
            <Input
              type="number"
              value={String(form.credits ?? "")}
              onChange={(e) => set("credits", e.target.value)}
              className="bg-slate-800 border-slate-700 text-slate-200"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm text-slate-400 mb-1 block">Bio</label>
            <Textarea
              value={(form.bio as string) ?? ""}
              onChange={(e) => set("bio", e.target.value)}
              className="bg-slate-800 border-slate-700 text-slate-200"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
            <span className="text-sm text-slate-300">AI trained</span>
            <Switch checked={!!form.ai_trained} onCheckedChange={(v) => set("ai_trained", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
            <span className="text-sm text-slate-300">YouTube connected</span>
            <Switch checked={!!form.youtube_connected} onCheckedChange={(v) => set("youtube_connected", v)} />
          </div>
        </div>

        <p className="text-xs text-slate-500 -mt-2">Changing the plan grants its credit allowance and resets the subscription (billing provider is not affected).</p>

        <DialogFooter>
          <AdminButton variant="tertiary" onClick={() => onOpenChange(false)}>
            Cancel
          </AdminButton>
          <AdminButton variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </AdminButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
