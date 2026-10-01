"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { AdminSegmentUser, AdminUserSegment } from "@repo/validation"
import { adminApi } from "@/hooks/useAdmin"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@repo/ui/dialog"

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
]

function timeAgo(iso: string | null) {
  if (!iso) return "never"
  const secs = (Date.parse(iso) - Date.now()) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit)
  }
  return "just now"
}

export type UserSegmentSelection = { segment: AdminUserSegment; title: string; description: string }

export function UserSegmentDialog({
  selection,
  onOpenChange,
}: {
  selection: UserSegmentSelection | null
  onOpenChange: (open: boolean) => void
}) {
  const [users, setUsers] = useState<AdminSegmentUser[] | null>(null)
  const [error, setError] = useState(false)
  const segment = selection?.segment

  useEffect(() => {
    if (!segment) return
    let cancelled = false
    setUsers(null)
    setError(false)
    adminApi
      .getUserSegment(segment)
      .then((data) => !cancelled && setUsers(data))
      .catch(() => !cancelled && setError(true))
    return () => { cancelled = true }
  }, [segment])

  return (
    <Dialog open={!!selection} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 pb-4 border-b border-slate-800 text-left">
          <DialogTitle className="flex items-center gap-2">
            {selection?.title}
            {users && <span className="text-sm font-normal text-slate-500 tabular-nums">({users.length})</span>}
          </DialogTitle>
          <DialogDescription className="text-slate-500">{selection?.description}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto p-2">
          {error ? (
            <p className="px-3 py-8 text-center text-sm text-red-400">Couldn't load these users.</p>
          ) : !users ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-slate-800/60 animate-pulse" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">No users here yet.</p>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {users.map((u) => {
                const name = u.full_name || u.name || u.email || "Unknown"
                return (
                  <li key={u.user_id}>
                    <Link
                      href={`/dashboard/admin/users/${u.user_id}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-800/50"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} alt="" />}
                        <AvatarFallback className="bg-slate-800 text-slate-300 text-sm">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">{name}</p>
                        <p className="truncate text-xs text-slate-500">{u.email}</p>
                      </div>
                      <div className="hidden sm:block shrink-0 text-right text-xs">
                        <p className="text-slate-300">{u.plan ?? "Free"}</p>
                        <p className="text-slate-500">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                      </div>
                      <p className="w-20 shrink-0 text-right text-xs text-slate-400" title="Last seen">
                        {timeAgo(u.last_seen_at)}
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
