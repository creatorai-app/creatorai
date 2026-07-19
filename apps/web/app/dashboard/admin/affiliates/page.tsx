"use client"

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api-client"
import {
  useAdminAffiliateRequests,
  useAdminLsAffiliates,
  useAdminPromoCodes,
  useAdminWithdrawals,
  adminApi,
} from "@/hooks/useAdmin"
import {
  ChevronLeft,
  ChevronRight,
  Link2,
  Users,
  ExternalLink,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Zap,
  DollarSign,
  Edit,
  RotateCcw,
  Globe,
  Share2,
  BarChart3,
  Megaphone,
  Mail,
  Calendar,
  StickyNote,
  Ticket,
  Banknote,
} from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
import { Input } from "@repo/ui/input"
import { Textarea } from "@repo/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import { toast } from "sonner"
import type { AffiliateLink, AffiliateRequest, AffiliateSale, AffiliatePromoCode, AffiliateWithdrawal, PaginatedResponse } from "@repo/validation"

function LinksTab() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedResponse<AffiliateLink & { profiles?: { full_name: string; email: string } }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [users, setUsers] = useState<Array<{ user_id: string; full_name: string; email: string }>>([])
  const [userSearch, setUserSearch] = useState("")
  const [form, setForm] = useState({ sales_rep_id: "", code: "", label: "", commission_rate: "20", ls_affiliate_id: "" })
  const [editLink, setEditLink] = useState<(AffiliateLink & { profiles?: { full_name: string; email: string } }) | null>(null)
  const [editForm, setEditForm] = useState({ label: "", commission_rate: "", is_active: true, ls_affiliate_id: "" })
  const [saving, setSaving] = useState(false)

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<PaginatedResponse<AffiliateLink & { profiles?: { full_name: string; email: string } }>>(
        `/api/v1/admin/affiliates/links?page=${page}`,
        { requireAuth: true }
      )
      setData(res)
    } catch {
      console.error("Failed to fetch affiliate links")
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  const loadUsers = useCallback(async (search: string) => {
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (search.trim()) params.set("search", search.trim())
      const res = await api.get<PaginatedResponse<{ user_id: string; full_name: string; email: string }>>(
        `/api/v1/admin/users?${params}`,
        { requireAuth: true }
      )
      setUsers(res.data || [])
    } catch {
      console.error("Failed to load users")
    }
  }, [])

  useEffect(() => {
    if (!showCreate) return
    const t = setTimeout(() => loadUsers(userSearch), 300)
    return () => clearTimeout(t)
  }, [userSearch, showCreate, loadUsers])

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.sales_rep_id) { toast.error("Select a user"); return }
    try {
      setCreating(true)
      await adminApi.createAffiliateLinkForRep({
        owner_id: form.sales_rep_id,
        code: form.code || generateCode(),
        label: form.label || undefined,
        commission_rate: Number(form.commission_rate) || 20,
        ls_affiliate_id: form.ls_affiliate_id || undefined,
      })
      toast.success("Affiliate link created and assigned")
      setShowCreate(false)
      setForm({ sales_rep_id: "", code: "", label: "", commission_rate: "20", ls_affiliate_id: "" })
      fetchLinks()
    } catch {
      toast.error("Failed to create link")
    } finally {
      setCreating(false)
    }
  }

  const copyLink = (code: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    navigator.clipboard.writeText(`${baseUrl}/?ref=${code}`)
    toast.success("Link copied to clipboard")
  }

  const openEdit = (link: AffiliateLink & { profiles?: { full_name: string; email: string } }) => {
    setEditLink(link)
    setEditForm({
      label: link.label || "",
      commission_rate: String(link.commission_rate),
      is_active: link.is_active,
      ls_affiliate_id: link.ls_affiliate_id || "",
    })
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editLink) return
    try {
      setSaving(true)
      await adminApi.updateAffiliateLink(editLink.id, {
        label: editForm.label || null,
        commission_rate: Number(editForm.commission_rate) || 10,
        is_active: editForm.is_active,
        ls_affiliate_id: editForm.ls_affiliate_id || null,
      })
      toast.success("Link updated")
      setEditLink(null)
      fetchLinks()
    } catch {
      toast.error("Failed to update link")
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil((data?.total || 0) / 20)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{data?.total ?? 0} total links</p>
        <AdminButton
          onClick={() => { setForm({ sales_rep_id: "", code: generateCode(), label: "", commission_rate: "20", ls_affiliate_id: "" }); setUserSearch(""); setShowCreate(true) }}
          variant="primary"
          tone="success"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Create Link
        </AdminButton>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Promotion</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Commission %</th>
                <th className="px-4 py-3 font-medium">Clicks</th>
                <th className="px-4 py-3 font-medium">LS ID</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-5 bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.data?.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No affiliate links created yet
                  </td>
                </tr>
              ) : (
                data.data.map((link) => (
                  <tr key={link.id} className="hover:bg-slate-900/30">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded">
                        {link.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{link.label || "-"}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate" title={link.promotion_channel || undefined}>
                      {link.promotion_channel || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {link.profiles?.full_name || link.profiles?.email || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{link.commission_rate}%</td>
                    <td className="px-4 py-3 text-slate-300">{link.click_count}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">{link.ls_affiliate_id || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        link.is_active ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"
                      }`}>
                        {link.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => copyLink(link.code)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Copy link">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openEdit(link)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Edit">
                          <Edit className="h-3.5 w-3.5" />
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
          <p className="text-sm text-slate-500">{data?.total} links</p>
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Create Affiliate Link</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Assign to user *</label>
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name or email"
                className="bg-slate-800 border-slate-700 text-slate-200 mb-2"
              />
              <Select value={form.sales_rep_id} onValueChange={(v: string) => setForm({ ...form, sales_rep_id: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Code</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="bg-slate-800 border-slate-700 text-slate-200 font-mono"
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Label (optional)</label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g., YouTube Campaign"
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Commission Rate (%)</label>
              <Input
                type="number"
                value={form.commission_rate}
                onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-200"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Lemon Squeezy Affiliate ID (optional)</label>
              <Input
                value={form.ls_affiliate_id}
                onChange={(e) => setForm({ ...form, ls_affiliate_id: e.target.value })}
                placeholder="LS affiliate ID to link"
                className="bg-slate-800 border-slate-700 text-slate-200 font-mono"
              />
            </div>
            <DialogFooter>
              <AdminButton type="button" variant="tertiary" onClick={() => setShowCreate(false)}>Cancel</AdminButton>
              <AdminButton type="submit" variant="primary" tone="success" disabled={creating}>
                {creating ? "Creating..." : "Create & Assign"}
              </AdminButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editLink} onOpenChange={() => setEditLink(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Edit Affiliate Link | <span className="font-mono text-purple-400">{editLink?.code}</span></DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Label</label>
              <Input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} placeholder="Campaign label" className="bg-slate-800 border-slate-700 text-slate-200" />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Commission Rate (%)</label>
              <Input type="number" value={editForm.commission_rate} onChange={(e) => setEditForm({ ...editForm, commission_rate: e.target.value })} className="bg-slate-800 border-slate-700 text-slate-200" min="0" max="100" />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">LS Affiliate ID</label>
              <Input value={editForm.ls_affiliate_id} onChange={(e) => setEditForm({ ...editForm, ls_affiliate_id: e.target.value })} className="bg-slate-800 border-slate-700 text-slate-200 font-mono" />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${editForm.is_active ? "bg-green-600" : "bg-slate-700"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${editForm.is_active ? "translate-x-5" : "translate-x-0"}`} />
              </button>
              <span className="text-sm text-slate-300">{editForm.is_active ? "Active" : "Inactive"}</span>
            </div>
            <DialogFooter>
              <AdminButton type="button" variant="tertiary" onClick={() => setEditLink(null)}>Cancel</AdminButton>
              <AdminButton type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </AdminButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const REQUEST_STATUS_META: Record<AffiliateRequest["status"], { label: string; badge: string; icon: typeof CheckCircle; iconClass: string }> = {
  approved: { label: "Approved", badge: "bg-green-900/40 text-green-400 border border-green-800/50", icon: CheckCircle, iconClass: "text-green-400" },
  denied: { label: "Denied", badge: "bg-red-900/40 text-red-400 border border-red-800/50", icon: XCircle, iconClass: "text-red-400" },
  pending: { label: "Pending", badge: "bg-yellow-900/40 text-yellow-400 border border-yellow-800/50", icon: Clock, iconClass: "text-yellow-400" },
}

function DetailRow({ icon: Icon, label, value, mono }: { icon: typeof Mail; label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-800/80 flex items-center justify-center">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={`text-sm text-slate-200 break-words ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  )
}

function RequestsTab() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const { data, total, loading, refresh } = useAdminAffiliateRequests(page, statusFilter)
  const [selected, setSelected] = useState<AffiliateRequest | null>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [submitting, setSubmitting] = useState<"approved" | "denied" | "pending" | null>(null)

  const openDetails = (req: AffiliateRequest) => {
    setSelected(req)
    setAdminNotes(req.admin_notes || "")
  }

  const closeDetails = () => {
    setSelected(null)
    setAdminNotes("")
    setSubmitting(null)
  }

  const handleReview = async (action: "approved" | "denied" | "pending") => {
    if (!selected || submitting) return
    try {
      setSubmitting(action)
      await adminApi.reviewAffiliateRequest(selected.id, action, adminNotes || undefined)
      toast.success(action === "pending" ? "Reverted to pending" : `Request ${action}`)
      closeDetails()
      refresh()
    } catch {
      toast.error("Failed to update request")
      setSubmitting(null)
    }
  }

  const totalPages = Math.ceil((total || 0) / 20)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter || "all"} onValueChange={(v: string) => { setStatusFilter(v === "all" ? undefined : v); setPage(1) }}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-300 text-xs h-8">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-slate-500">{total ?? 0} requests</p>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Website</th>
                <th className="px-4 py-3 font-medium">Promotion</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-5 bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No affiliate requests yet
                  </td>
                </tr>
              ) : (
                data.map((req: AffiliateRequest) => {
                  const meta = REQUEST_STATUS_META[req.status]
                  const StatusIcon = meta.icon
                  return (
                    <tr key={req.id} onClick={() => openDetails(req)} className="hover:bg-slate-900/40 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-slate-200 font-medium">{req.full_name}</td>
                      <td className="px-4 py-3 text-slate-400">{req.email}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{req.website || "-"}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-[180px] truncate">{req.promotion_method || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                          <StatusIcon className={`h-3.5 w-3.5 ${meta.iconClass}`} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(req.created_at).toLocaleDateString()}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <AdminButton variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </AdminButton>
          <span className="text-sm text-slate-400 px-2">{page} / {totalPages}</span>
          <AdminButton variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </AdminButton>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open: boolean) => { if (!open) closeDetails() }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (() => {
            const meta = REQUEST_STATUS_META[selected.status]
            const StatusIcon = meta.icon
            return (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <DialogTitle className="text-lg">{selected.full_name}</DialogTitle>
                      <p className="text-sm text-slate-400 mt-1">Affiliate application details</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${meta.badge}`}>
                      <StatusIcon className={`h-3.5 w-3.5 ${meta.iconClass}`} />
                      {meta.label}
                    </span>
                  </div>
                </DialogHeader>

                <div className="space-y-5 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailRow icon={Mail} label="Email" value={selected.email} />
                    <DetailRow icon={Globe} label="Website" value={selected.website} />
                    <DetailRow icon={Share2} label="Social Media" value={selected.social_media} />
                    <DetailRow icon={BarChart3} label="Audience Size" value={selected.audience_size} />
                    <DetailRow icon={Megaphone} label="Promotion Method" value={selected.promotion_method} />
                    <DetailRow icon={Calendar} label="Submitted" value={new Date(selected.created_at).toLocaleString()} />
                  </div>

                  {selected.reason && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 mb-2">
                        <StickyNote className="h-3.5 w-3.5" />
                        Reason
                      </div>
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">{selected.reason}</p>
                    </div>
                  )}

                  <div className="border-t border-slate-800 pt-4 space-y-2">
                    <label className="text-sm font-medium text-slate-300">Admin notes</label>
                    <p className="text-xs text-slate-500">
                      On approval, this message is emailed to the applicant from <span className="text-slate-400">support@tryscriptai.com</span>.
                    </p>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Welcome aboard! Here's your affiliate signup link..."
                      className="bg-slate-800 border-slate-700 text-slate-200"
                      rows={4}
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                  <AdminButton variant="tertiary" onClick={closeDetails}>Close</AdminButton>
                  {selected.status !== "pending" && (
                    <AdminButton
                      onClick={() => handleReview("pending")}
                      disabled={!!submitting}
                      variant="tertiary"
                      className="text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {submitting === "pending" ? "Reverting..." : "Revert"}
                    </AdminButton>
                  )}
                  {selected.status !== "denied" && (
                    <AdminButton
                      onClick={() => handleReview("denied")}
                      disabled={!!submitting}
                      variant="secondary"
                      tone="danger"
                    >
                      <XCircle className="h-4 w-4" />
                      {submitting === "denied" ? "Denying..." : "Deny"}
                    </AdminButton>
                  )}
                  {selected.status !== "approved" && (
                    <AdminButton
                      onClick={() => handleReview("approved")}
                      disabled={!!submitting}
                      variant="primary"
                      tone="success"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {submitting === "approved" ? "Approving..." : "Approve & Email"}
                    </AdminButton>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SalesTab() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedResponse<AffiliateSale & { profiles?: { full_name: string; email: string } }> | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get<PaginatedResponse<AffiliateSale & { profiles?: { full_name: string; email: string } }>>(
        `/api/v1/admin/affiliates/sales?page=${page}`,
        { requireAuth: true }
      )
      setData(res)
    } catch {
      console.error("Failed to fetch sales")
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchSales() }, [fetchSales])

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await adminApi.updateSaleStatus(id, status)
      toast.success(`Sale marked as ${status}`)
      fetchSales()
    } catch {
      toast.error("Failed to update sale status")
    }
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "confirmed": return "bg-green-900/40 text-green-400"
      case "paid": return "bg-blue-900/40 text-blue-400"
      case "refunded": return "bg-red-900/40 text-red-400"
      default: return "bg-yellow-900/40 text-yellow-400"
    }
  }

  const totalPages = Math.ceil((data?.total || 0) / 20)

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{data?.total ?? 0} total sales</p>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Sales Rep</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-5 bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.data?.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No affiliate sales recorded yet
                  </td>
                </tr>
              ) : (
                data.data.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-900/30">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded">
                        {sale.affiliate_links?.code || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{sale.profiles?.full_name || sale.profiles?.email || "-"}</td>
                    <td className="px-4 py-3 text-slate-400">{sale.customer_email || "-"}</td>
                    <td className="px-4 py-3 text-slate-200 font-medium">${Number(sale.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">${Number(sale.commission).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(sale.status)}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(sale.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Select value={sale.status} onValueChange={(v: string) => handleStatusChange(sale.id, v)}>
                        <SelectTrigger className="w-28 h-7 bg-slate-800 border-slate-700 text-slate-300 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <AdminButton variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </AdminButton>
          <span className="text-sm text-slate-400 px-2">{page} / {totalPages}</span>
          <AdminButton variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </AdminButton>
        </div>
      )}
    </div>
  )
}

function LsAffiliatesTab() {
  const { affiliates, loading, refresh } = useAdminLsAffiliates()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{affiliates.length} Lemon Squeezy affiliates</p>
        <div className="flex gap-2">
          <AdminButton variant="secondary" size="sm" onClick={refresh}>
            Sync from LS
          </AdminButton>
          <AdminButton variant="primary" size="sm" asChild>
            <a href="https://app.lemonsqueezy.com/affiliates" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open LS Dashboard
            </a>
          </AdminButton>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">LS ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Total Earnings</th>
                <th className="px-4 py-3 font-medium">Unpaid</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-5 bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : !affiliates.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No Lemon Squeezy affiliates found. Set up your affiliate program in the LS dashboard.
                  </td>
                </tr>
              ) : (
                affiliates.map((aff) => (
                  <tr key={aff.id} className="hover:bg-slate-900/30">
                    <td className="px-4 py-3 font-mono text-xs text-purple-400">{aff.id}</td>
                    <td className="px-4 py-3 text-slate-200">{aff.user_name}</td>
                    <td className="px-4 py-3 text-slate-400">{aff.user_email}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{aff.share_domain || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        aff.status === "active" ? "bg-green-900/40 text-green-400" :
                        aff.status === "pending" ? "bg-yellow-900/40 text-yellow-400" :
                        "bg-red-900/40 text-red-400"
                      }`}>
                        {aff.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">
                      ${(aff.total_earnings / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-yellow-400">
                      ${(aff.unpaid_earnings / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(aff.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PromoCodesTab() {
  const [page, setPage] = useState(1)
  const { data, total, loading, refresh } = useAdminPromoCodes(page)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [users, setUsers] = useState<Array<{ user_id: string; full_name: string; email: string }>>([])
  const [userSearch, setUserSearch] = useState("")
  const [form, setForm] = useState({ owner_id: "", code: "", amount: "20", amount_type: "percent", commission_rate: "20", label: "" })
  const [edit, setEdit] = useState<AffiliatePromoCode | null>(null)
  const [saving, setSaving] = useState(false)

  const loadUsers = useCallback(async (search: string) => {
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (search.trim()) params.set("search", search.trim())
      const res = await api.get<PaginatedResponse<{ user_id: string; full_name: string; email: string }>>(
        `/api/v1/admin/users?${params}`, { requireAuth: true })
      setUsers(res.data || [])
    } catch { console.error("Failed to load users") }
  }, [])

  useEffect(() => {
    if (!showCreate) return
    const t = setTimeout(() => loadUsers(userSearch), 300)
    return () => clearTimeout(t)
  }, [userSearch, showCreate, loadUsers])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.owner_id) { toast.error("Select a user"); return }
    if (!form.code || form.code.length < 3) { toast.error("Code must be at least 3 characters"); return }
    try {
      setCreating(true)
      await adminApi.createPromoCode({
        owner_id: form.owner_id,
        code: form.code.toUpperCase(),
        amount: Number(form.amount),
        amount_type: form.amount_type as "percent" | "fixed",
        commission_rate: Number(form.commission_rate) || 20,
        label: form.label || undefined,
      })
      toast.success("Promo code created in Lemon Squeezy and assigned")
      setShowCreate(false)
      setForm({ owner_id: "", code: "", amount: "20", amount_type: "percent", commission_rate: "20", label: "" })
      refresh()
    } catch {
      toast.error("Failed to create promo code")
    } finally {
      setCreating(false)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    try {
      setSaving(true)
      await adminApi.updatePromoCode(edit.id, {
        commission_rate: edit.commission_rate,
        label: edit.label || undefined,
        is_active: edit.is_active,
      })
      toast.success("Promo code updated")
      setEdit(null)
      refresh()
    } catch {
      toast.error("Failed to update promo code")
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil((total || 0) / 20)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{total ?? 0} promo codes</p>
        <AdminButton onClick={() => { setUserSearch(""); setShowCreate(true) }} variant="primary" tone="success" size="sm">
          <Plus className="h-4 w-4" /> Create Promo Code
        </AdminButton>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Commission %</th>
                <th className="px-4 py-3 font-medium">Active</th>
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
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    <Ticket className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No promo codes yet
                  </td>
                </tr>
              ) : (
                data.map((promo) => (
                  <tr key={promo.id} className="hover:bg-slate-900/30">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-pink-400 bg-pink-900/20 px-2 py-0.5 rounded">{promo.code}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{promo.profiles?.full_name || promo.profiles?.email || "-"}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {promo.amount_type === "percent" ? `${promo.amount}%` : `$${promo.amount}`}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{promo.commission_rate}%</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${promo.is_active ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                        {promo.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setEdit(promo)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Edit">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
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
          <p className="text-sm text-slate-500">{total} promo codes</p>
          <div className="flex gap-2">
            <AdminButton variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></AdminButton>
            <span className="flex items-center text-sm text-slate-400 px-2">{page} / {totalPages}</span>
            <AdminButton variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></AdminButton>
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Create Promo Code</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Assign to user *</label>
              <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search users by name or email" className="bg-slate-800 border-slate-700 text-slate-200 mb-2" />
              <Select value={form.owner_id} onValueChange={(v: string) => setForm({ ...form, owner_id: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200"><SelectValue placeholder="Select a user" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {users.map((u) => (<SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Code *</label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. CREATOR20" className="bg-slate-800 border-slate-700 text-slate-200 font-mono" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Discount amount</label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-slate-800 border-slate-700 text-slate-200" min="1" />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Type</label>
                <Select value={form.amount_type} onValueChange={(v: string) => setForm({ ...form, amount_type: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="percent">Percent (%)</SelectItem>
                    <SelectItem value="fixed">Fixed ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Commission rate (%)</label>
              <Input type="number" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} className="bg-slate-800 border-slate-700 text-slate-200" min="0" max="100" />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Label (optional)</label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Internal name" className="bg-slate-800 border-slate-700 text-slate-200" />
            </div>
            <DialogFooter>
              <AdminButton type="button" variant="tertiary" onClick={() => setShowCreate(false)}>Cancel</AdminButton>
              <AdminButton type="submit" variant="primary" tone="success" disabled={creating}>{creating ? "Creating..." : "Create"}</AdminButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={() => setEdit(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Edit Promo Code | <span className="font-mono text-pink-400">{edit?.code}</span></DialogTitle>
          </DialogHeader>
          {edit && (
            <form onSubmit={handleSaveEdit} className="space-y-4 py-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Commission rate (%)</label>
                <Input type="number" value={edit.commission_rate} onChange={(e) => setEdit({ ...edit, commission_rate: Number(e.target.value) })} className="bg-slate-800 border-slate-700 text-slate-200" min="0" max="100" />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Label</label>
                <Input value={edit.label || ""} onChange={(e) => setEdit({ ...edit, label: e.target.value })} className="bg-slate-800 border-slate-700 text-slate-200" />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setEdit({ ...edit, is_active: !edit.is_active })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${edit.is_active ? "bg-green-600" : "bg-slate-700"}`}>
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${edit.is_active ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <span className="text-sm text-slate-300">{edit.is_active ? "Active" : "Inactive"}</span>
              </div>
              <DialogFooter>
                <AdminButton type="button" variant="tertiary" onClick={() => setEdit(null)}>Cancel</AdminButton>
                <AdminButton type="submit" variant="primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</AdminButton>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const WITHDRAWAL_STATUS_META: Record<AffiliateWithdrawal["status"], string> = {
  requested: "bg-yellow-900/40 text-yellow-400 border border-yellow-800/50",
  approved: "bg-blue-900/40 text-blue-400 border border-blue-800/50",
  paid: "bg-green-900/40 text-green-400 border border-green-800/50",
  rejected: "bg-red-900/40 text-red-400 border border-red-800/50",
}

function WithdrawalsTab() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const { data, total, loading, refresh } = useAdminWithdrawals(page, statusFilter)
  const [selected, setSelected] = useState<AffiliateWithdrawal | null>(null)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState<string | null>(null)

  const act = async (status: "approved" | "paid" | "rejected") => {
    if (!selected || submitting) return
    try {
      setSubmitting(status)
      await adminApi.updateWithdrawal(selected.id, status, notes || undefined)
      toast.success(`Withdrawal ${status}`)
      setSelected(null)
      setNotes("")
      refresh()
    } catch {
      toast.error("Failed to update withdrawal")
    } finally {
      setSubmitting(null)
    }
  }

  const totalPages = Math.ceil((total || 0) / 20)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter || "all"} onValueChange={(v: string) => { setStatusFilter(v === "all" ? undefined : v); setPage(1) }}>
          <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-300 text-xs h-8"><SelectValue placeholder="Filter status" /></SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-slate-500">{total ?? 0} withdrawals</p>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Affiliate</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Requested</th>
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
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    <Banknote className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No withdrawal requests
                  </td>
                </tr>
              ) : (
                data.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-900/30">
                    <td className="px-4 py-3 text-slate-400">{w.profiles?.full_name || w.profiles?.email || "-"}</td>
                    <td className="px-4 py-3 text-slate-100 font-semibold">${Number(w.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-300 capitalize">{w.method}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${WITHDRAWAL_STATUS_META[w.status]}`}>{w.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{new Date(w.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <AdminButton variant="secondary" size="sm" onClick={() => { setSelected(w); setNotes(w.admin_notes || "") }}>Review</AdminButton>
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
          <p className="text-sm text-slate-500">{total} withdrawals</p>
          <div className="flex gap-2">
            <AdminButton variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></AdminButton>
            <span className="flex items-center text-sm text-slate-400 px-2">{page} / {totalPages}</span>
            <AdminButton variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></AdminButton>
          </div>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setNotes("") }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Withdrawal | ${selected ? Number(selected.amount).toFixed(2) : ""}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-4">
              <DetailRow icon={Users} label="Affiliate" value={selected.profiles?.full_name || selected.profiles?.email} />
              <DetailRow icon={Banknote} label="Method" value={selected.method} />
              {Object.entries(selected.details || {}).map(([k, v]) => (
                <DetailRow key={k} icon={StickyNote} label={k.replace(/_/g, " ")} value={String(v)} mono />
              ))}
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Admin notes (optional)</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment reference, reason, etc." className="bg-slate-800 border-slate-700 text-slate-200" rows={3} />
              </div>
              <DialogFooter className="gap-2">
                <AdminButton type="button" variant="primary" tone="danger" disabled={!!submitting} onClick={() => act("rejected")}>
                  {submitting === "rejected" ? "..." : "Reject"}
                </AdminButton>
                <AdminButton type="button" variant="secondary" disabled={!!submitting} onClick={() => act("approved")}>
                  {submitting === "approved" ? "..." : "Approve"}
                </AdminButton>
                <AdminButton type="button" variant="primary" tone="success" disabled={!!submitting} onClick={() => act("paid")}>
                  {submitting === "paid" ? "..." : "Mark Paid"}
                </AdminButton>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AdminAffiliatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Affiliate Program</h1>
        <p className="text-slate-400 mt-1">Manage affiliate links, review requests, and sync with Lemon Squeezy</p>
      </div>

      <Tabs defaultValue="links" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="links" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400">
            <Link2 className="h-4 w-4 mr-1.5" />
            Links
          </TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400">
            <Users className="h-4 w-4 mr-1.5" />
            Requests
          </TabsTrigger>
          <TabsTrigger value="promo-codes" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400">
            <Ticket className="h-4 w-4 mr-1.5" />
            Promo Codes
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400">
            <Banknote className="h-4 w-4 mr-1.5" />
            Withdrawals
          </TabsTrigger>
          <TabsTrigger value="sales" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400">
            <DollarSign className="h-4 w-4 mr-1.5" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="lemon-squeezy" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400">
            <Zap className="h-4 w-4 mr-1.5" />
            Lemon Squeezy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="mt-4">
          <LinksTab />
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <RequestsTab />
        </TabsContent>

        <TabsContent value="promo-codes" className="mt-4">
          <PromoCodesTab />
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4">
          <WithdrawalsTab />
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <SalesTab />
        </TabsContent>

        <TabsContent value="lemon-squeezy" className="mt-4">
          <LsAffiliatesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
