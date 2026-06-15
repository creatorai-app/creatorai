"use client"

import { useState } from "react"
import { useAdminActivities } from "@/hooks/useAdmin"
import { ChevronLeft, ChevronRight, Activity as ActivityIcon } from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"

const actionIcons: Record<string, string> = {
  create: "text-green-400",
  update: "text-blue-400",
  delete: "text-red-400",
  login: "text-cyan-400",
}

function getActionColor(action: string) {
  if (action.includes("create")) return actionIcons.create
  if (action.includes("update")) return actionIcons.update
  if (action.includes("delete") || action.includes("remove")) return actionIcons.delete
  return "text-slate-400"
}

export default function AdminActivitiesPage() {
  const [page, setPage] = useState(1)
  const [entityType, setEntityType] = useState("")
  const { data, total, loading } = useAdminActivities(page, entityType)

  const totalPages = Math.ceil((total || 0) / 50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Activity Log</h1>
        <p className="text-slate-400 mt-1">Track all admin and system actions</p>
      </div>

      <div className="flex gap-3">
        <Select value={entityType || "all"} onValueChange={(v) => { setEntityType(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="blog">Blog</SelectItem>
            <SelectItem value="affiliate_sale">Affiliate Sale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-900 border border-slate-800 rounded-lg animate-pulse" />
          ))
        ) : !data?.length ? (
          <div className="text-center py-12 text-slate-500">
            <ActivityIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No activities recorded yet</p>
          </div>
        ) : (
          data.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4"
            >
              <div className={`mt-0.5 h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0`}>
                <ActivityIcon className={`h-4 w-4 ${getActionColor(activity.action)}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200">
                  <span className="font-medium">{activity.profiles?.full_name || activity.profiles?.email || "System"}</span>
                  {" "}
                  <span className={`font-medium ${getActionColor(activity.action)}`}>{activity.action.replace(/_/g, " ")}</span>
                  {" "}
                  <span className="text-slate-400">{activity.entity_type}</span>
                  {activity.entity_id && (
                    <span className="text-slate-500 text-xs ml-1 font-mono">({activity.entity_id.slice(0, 8)}...)</span>
                  )}
                </p>
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {JSON.stringify(activity.metadata)}
                  </p>
                )}
              </div>
              <span className="text-xs text-slate-500 shrink-0">
                {new Date(activity.created_at).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{total} activities</p>
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
