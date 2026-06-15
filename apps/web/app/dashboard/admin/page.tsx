"use client"

import Link from "next/link"
import { useAdminStats } from "@/hooks/useAdmin"
import { useSupabase } from "@/components/supabase-provider"
import { AdminButton } from "@/components/admin/admin-button"
import {
  Users,
  CreditCard,
  FileText,
  DollarSign,
  Mail,
  TrendingUp,
  UserPlus,
  Briefcase,
  Handshake,
  ArrowUpRight,
  Activity,
  Link2,
  ClipboardList,
  Sparkles,
} from "lucide-react"

type StatConfig = {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  accent: string
  href?: string
  hint?: string
}

function StatCard({ label, value, icon: Icon, gradient, accent, href, hint }: StatConfig) {
  const card = (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-5 transition-all hover:border-slate-700 hover:bg-slate-900">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-20 transition-opacity group-hover:opacity-40 ${gradient}`} />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-50 mt-1.5 tabular-nums">{value}</p>
          {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
        </div>
        <div className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      {href && (
        <div className={`relative mt-4 pt-4 border-t border-slate-800/70 flex items-center gap-1 text-xs font-medium ${accent} opacity-0 group-hover:opacity-100 transition-opacity`}>
          View details
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  )
  return href ? <Link href={href}>{card}</Link> : card
}

const QUICK_ACTIONS: Array<{ label: string; description: string; href: string; icon: React.ComponentType<{ className?: string }>; gradient: string }> = [
  { label: "Users", description: "Manage accounts and roles", href: "/dashboard/admin/users", icon: Users, gradient: "from-blue-500 to-cyan-500" },
  { label: "Applications", description: "Review job applications", href: "/dashboard/admin/applications", icon: ClipboardList, gradient: "from-pink-500 to-rose-500" },
  { label: "Affiliates", description: "Requests, links and sales", href: "/dashboard/admin/affiliates", icon: Link2, gradient: "from-indigo-500 to-purple-500" },
  { label: "Activities", description: "Audit trail across the app", href: "/dashboard/admin/activities", icon: Activity, gradient: "from-amber-500 to-orange-500" },
]

export default function AdminDashboardPage() {
  const { stats, loading } = useAdminStats()
  const { profile } = useSupabase()

  const firstName = (profile?.full_name || profile?.email || "Admin").split(" ")[0]

  const growth: StatConfig[] = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, gradient: "from-blue-500 to-cyan-500", accent: "text-blue-400", href: "/dashboard/admin/users" },
    { label: "New Users", value: stats?.newUsers30d ?? 0, icon: UserPlus, gradient: "from-emerald-500 to-green-500", accent: "text-emerald-400", hint: "last 30 days" },
    { label: "Active Subs", value: stats?.activeSubscriptions ?? 0, icon: CreditCard, gradient: "from-cyan-500 to-sky-500", accent: "text-cyan-400" },
  ]

  const revenue: StatConfig[] = [
    {
      label: "Total Revenue",
      value: `$${(stats?.totalRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      gradient: "from-yellow-500 to-amber-500",
      accent: "text-yellow-400",
      href: "/dashboard/admin/sales",
    },
    { label: "Total Sales", value: stats?.totalSales ?? 0, icon: TrendingUp, gradient: "from-emerald-500 to-teal-500", accent: "text-emerald-400", href: "/dashboard/admin/sales" },
    { label: "Affiliate Requests", value: stats?.pendingAffiliateRequests ?? 0, icon: Handshake, gradient: "from-indigo-500 to-violet-500", accent: "text-indigo-400", href: "/dashboard/admin/affiliates", hint: "pending review" },
    { label: "Published Blogs", value: stats?.publishedBlogs ?? 0, icon: FileText, gradient: "from-orange-500 to-red-500", accent: "text-orange-400", href: "/dashboard/admin/blogs" },
  ]

  const inbox: StatConfig[] = [
    { label: "Unread Mails", value: stats?.unreadMails ?? 0, icon: Mail, gradient: "from-red-500 to-pink-500", accent: "text-red-400", href: "/dashboard/admin/mails" },
    { label: "Pending Applications", value: stats?.pendingApplications ?? 0, icon: Briefcase, gradient: "from-pink-500 to-rose-500", accent: "text-pink-400", href: "/dashboard/admin/applications" },
  ]

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-24 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/40 p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-pink-500/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium mb-3">
              <Sparkles className="h-3 w-3" />
              Admin overview
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-50">
              Welcome back, {firstName}
            </h1>
            <p className="text-slate-400 mt-1.5 text-sm">
              Here's what's happening across your platform today.
            </p>
          </div>
          <div className="flex gap-2">
            <AdminButton variant="secondary" asChild>
              <Link href="/dashboard/admin/affiliates">
                <Handshake className="h-4 w-4" />
                Review Affiliates
              </Link>
            </AdminButton>
            <AdminButton variant="primary" asChild>
              <Link href="/dashboard/admin/users">
                <Users className="h-4 w-4" />
                Manage Users
              </Link>
            </AdminButton>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Growth</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {growth.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Revenue & Content</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {revenue.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Needs Attention</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {inbox.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 transition-all hover:border-slate-700 hover:bg-slate-900"
            >
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-lg mb-3`}>
                <action.icon className="h-5 w-5 text-white" />
              </div>
              <p className="text-slate-100 font-medium">{action.label}</p>
              <p className="text-xs text-slate-500 mt-1">{action.description}</p>
              <ArrowUpRight className="h-4 w-4 text-slate-600 absolute top-4 right-4 group-hover:text-slate-300 transition-colors" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
