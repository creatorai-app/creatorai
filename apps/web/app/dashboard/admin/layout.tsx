"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSupabase } from "@/components/supabase-provider"
import { AdminButton } from "@/components/admin/admin-button"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Activity,
  Mail,
  Link2,
  Briefcase,
  ClipboardList,
  LogOut,
  Menu,
  X,
} from "lucide-react"

const adminLinks = [
  { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
  { label: "Users", href: "/dashboard/admin/users", icon: Users },
  { label: "Jobs", href: "/dashboard/admin/jobs", icon: Briefcase },
  { label: "Applications", href: "/dashboard/admin/applications", icon: ClipboardList },
  { label: "Blogs", href: "/dashboard/admin/blogs", icon: FileText },
  { label: "Subscriptions", href: "/dashboard/admin/subscriptions", icon: CreditCard },
  { label: "Activities", href: "/dashboard/admin/activities", icon: Activity },
  { label: "Mails", href: "/dashboard/admin/mails", icon: Mail },
  { label: "Affiliates", href: "/dashboard/admin/affiliates", icon: Link2 },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading, logout } = useSupabase()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !profileLoading) {
      if (!user) {
        router.push("/admin/login?redirectedFrom=/dashboard/admin")
        return
      }
      if (profile?.role !== "admin") {
        router.push("/dashboard")
      }
    }
  }, [user, profile, loading, profileLoading, router])

  if (loading || profileLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    )
  }

  if (!user || profile?.role !== "admin") return null

  const initial = (profile?.full_name || profile?.email || "A").charAt(0).toUpperCase()

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900/95 backdrop-blur border-r border-slate-800 transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800">
          <Link href="/dashboard/admin" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-900/30">
              A
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold">Admin Panel</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Creator AI</span>
            </div>
          </Link>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {adminLinks.map((link) => {
            const isActive = link.href === "/dashboard/admin"
              ? pathname === link.href
              : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-gradient-to-r from-purple-600/20 to-pink-600/10 text-purple-300"
                    : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
                )}
              >
                {isActive && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gradient-to-b from-purple-400 to-pink-400" />}
                <link.icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-purple-300" : "text-slate-500 group-hover:text-slate-300")} />
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2 mb-2">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100 truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-slate-500">Administrator</p>
            </div>
          </div>
          <AdminButton
            variant="tertiary"
            tone="danger"
            onClick={() => logout()}
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </AdminButton>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 border-b border-slate-800 bg-slate-950/60 backdrop-blur px-6 lg:hidden">
          <button className="text-slate-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-xs">
            {initial}
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  )
}
