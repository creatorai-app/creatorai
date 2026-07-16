"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAdminUsers, adminApi } from "@/hooks/useAdmin"
import { Search, ChevronLeft, ChevronRight, Trash2, Edit, Shield } from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
import { UserEditDialog } from "@/components/admin/user-edit-dialog"
import { Input } from "@repo/ui/input"
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

export default function AdminUsersPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("")
  const [searchInput, setSearchInput] = useState("")
  const { data, total, loading, refresh } = useAdminUsers(page, search, roleFilter)

  const [editUser, setEditUser] = useState<Record<string, unknown> | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [plans, setPlans] = useState<Array<{ id: string; name: string; credits_monthly: number; price_monthly: number }>>([])

  useEffect(() => {
    adminApi.getPlans().then(setPlans).catch(() => {})
  }, [])

  const totalPages = Math.ceil((total || 0) / 20)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await adminApi.deleteUser(deleteConfirm)
      toast.success("User deleted")
      setDeleteConfirm(null)
      refresh()
    } catch {
      toast.error("Failed to delete user")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Users</h1>
        <p className="text-slate-400 mt-1">Manage all platform users</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700 text-slate-100"
            />
          </div>
          <AdminButton type="submit" variant="secondary">
            Search
          </AdminButton>
        </form>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-5 bg-slate-800 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No users found</td>
                </tr>
              ) : (
                data?.map((user: Record<string, unknown>) => (
                  <tr
                    key={user.user_id as string}
                    onClick={() => router.push(`/dashboard/admin/users/${user.user_id}`)}
                    className="hover:bg-slate-900/30 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-slate-200">{(user.full_name || user.name || "-") as string}</td>
                    <td className="px-4 py-3 text-slate-400">{user.email as string}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-purple-900/40 text-purple-400"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {user.role === "admin" && <Shield className="h-3 w-3" />}
                        {user.role as string}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {(user.plan as { name?: string } | null)?.name ?? "Free"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{user.credits as number}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(user.created_at as string).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEditUser(user)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(user.user_id as string)}
                          className="p-1.5 rounded hover:bg-red-900/30 text-slate-400 hover:text-red-400"
                        >
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
          <p className="text-sm text-slate-500">{total} total users</p>
          <div className="flex gap-2">
            <AdminButton variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </AdminButton>
            <span className="flex items-center text-sm text-slate-400 px-2">
              {page} / {totalPages}
            </span>
            <AdminButton variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </AdminButton>
          </div>
        </div>
      )}

      <UserEditDialog
        user={editUser}
        plans={plans}
        onOpenChange={(open) => { if (!open) setEditUser(null) }}
        onSaved={refresh}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-slate-400">Are you sure? This action cannot be undone. The user and all their data will be permanently deleted.</p>
          <DialogFooter>
            <AdminButton variant="tertiary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </AdminButton>
            <AdminButton variant="primary" tone="danger" onClick={handleDelete}>
              Delete
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
