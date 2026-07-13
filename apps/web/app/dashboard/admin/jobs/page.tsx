"use client"

import { useState } from "react"
import { useAdminJobs, adminApi } from "@/hooks/useAdmin"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Briefcase,
} from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Textarea } from "@repo/ui/textarea"
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
import { toast } from "sonner"
import type { JobPost } from "@repo/validation"

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "closed", label: "Closed" },
]

const TEAM_OPTIONS = ["Engineering", "AI", "Design", "Marketing", "Business", "Operations", "Other"]
const TYPE_OPTIONS = ["Full-time", "Part-time", "Contract", "Freelance"]
const CATEGORY_OPTIONS = [
  { value: "engineering", label: "Engineering" },
  { value: "ai", label: "AI" },
  { value: "design", label: "Design" },
  { value: "marketing", label: "Marketing" },
  { value: "business", label: "Business" },
  { value: "other", label: "Other" },
]

const statusColor = (s: string) => {
  switch (s) {
    case "active": return "bg-green-900/40 text-green-400"
    case "inactive": return "bg-yellow-900/40 text-yellow-400"
    case "closed": return "bg-red-900/40 text-red-400"
    default: return "bg-slate-800 text-slate-400"
  }
}

const emptyJob = {
  title: "",
  team: "Engineering",
  location: "Remote",
  type: "Full-time",
  category: "engineering" as const,
  description: "",
  requirements: "",
  status: "active" as const,
}

export default function AdminJobsPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const { data, total, loading, refresh } = useAdminJobs(page, statusFilter)
  const [editJob, setEditJob] = useState<Partial<JobPost> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const totalPages = Math.ceil((total || 0) / 20)

  const openNew = () => {
    setEditJob({ ...emptyJob })
    setIsNew(true)
  }

  const openEdit = (job: JobPost) => {
    setEditJob({ ...job })
    setIsNew(false)
  }

  const handleSave = async () => {
    if (!editJob || saving) return
    if (!editJob.title?.trim() || !editJob.description?.trim() || !editJob.team?.trim()) {
      toast.error("Title, team, and description are required")
      return
    }
    setSaving(true)
    try {
      const payload: Partial<JobPost> = {
        title: editJob.title?.trim(),
        team: editJob.team,
        location: editJob.location?.trim() || "Remote",
        type: editJob.type || "Full-time",
        category: editJob.category || "other",
        description: editJob.description?.trim(),
        requirements: editJob.requirements?.trim() || undefined,
        status: editJob.status || "active",
      }
      if (isNew) {
        await adminApi.createJob(payload)
        toast.success("Job created")
      } else {
        await adminApi.updateJob(editJob.id!, payload)
        toast.success("Job updated")
      }
      setEditJob(null)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save job")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this job post? Applications linked to it will lose the reference.")) return
    try {
      await adminApi.deleteJob(id)
      toast.success("Job deleted")
      refresh()
    } catch {
      toast.error("Failed to delete job")
    }
  }

  const updateField = (field: string, value: string) => {
    setEditJob((prev) => prev ? { ...prev, [field]: value } : prev)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Job Posts</h1>
          <p className="text-slate-400 mt-1">Manage career openings</p>
        </div>
        <AdminButton onClick={openNew} variant="primary">
          <Plus className="h-4 w-4" />
          New Job
        </AdminButton>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium w-8"></th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-5 bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : !data?.length ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No jobs found</td></tr>
              ) : (
                data.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-900/30">
                    <td className="px-4 py-3"><Briefcase className="h-4 w-4 text-purple-400" /></td>
                    <td className="px-4 py-3 text-slate-100 font-medium">{job.title}</td>
                    <td className="px-4 py-3 text-slate-300">{job.team}</td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{job.category}</td>
                    <td className="px-4 py-3 text-slate-400">{job.location}</td>
                    <td className="px-4 py-3 text-slate-400">{job.type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(job.status)}`}>{job.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(job)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-purple-400" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(job.id)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400" title="Delete">
                          <Trash2 className="h-4 w-4" />
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
          <p className="text-sm text-slate-500">{total} jobs</p>
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

      {/* Create / Edit Dialog */}
      <Dialog open={!!editJob} onOpenChange={() => setEditJob(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "Create Job Post" : "Edit Job Post"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Title *</Label>
                <Input value={editJob?.title || ""} onChange={(e) => updateField("title", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" placeholder="e.g. Senior Full-Stack Engineer" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Team *</Label>
                <Select value={editJob?.team || "Engineering"} onValueChange={(v) => updateField("team", v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {TEAM_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Location</Label>
                <Input value={editJob?.location || ""} onChange={(e) => updateField("location", e.target.value)} className="bg-slate-800 border-slate-700 text-slate-200" placeholder="Remote" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Category *</Label>
                <Select value={editJob?.category || "other"} onValueChange={(v) => updateField("category", v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Type</Label>
                <Select value={editJob?.type || "Full-time"} onValueChange={(v) => updateField("type", v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Status</Label>
                <Select value={editJob?.status || "active"} onValueChange={(v) => updateField("status", v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-400">Description *</Label>
              <Textarea value={editJob?.description || ""} onChange={(e) => updateField("description", e.target.value)} rows={3} className="bg-slate-800 border-slate-700 text-slate-200" placeholder="Job description..." />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-400">Requirements</Label>
              <Textarea value={editJob?.requirements || ""} onChange={(e) => updateField("requirements", e.target.value)} rows={3} className="bg-slate-800 border-slate-700 text-slate-200" placeholder="Requirements for this role..." />
            </div>

            <div className="flex gap-3 pt-2">
              <AdminButton variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : isNew ? "Create Job" : "Save Changes"}
              </AdminButton>
              <AdminButton variant="tertiary" onClick={() => setEditJob(null)}>
                Cancel
              </AdminButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
