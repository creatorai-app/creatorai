"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useAdminStats, useAdminFunnel } from "@/hooks/useAdmin"
import type { FunnelTierBreakdown } from "@repo/validation"
import { useSupabase } from "@/components/supabase-provider"
import { AdminButton } from "@/components/admin/admin-button"
import { StatCard, type StatConfig } from "@/components/admin/stat-card"
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
  Eye,
  MousePointerClick,
  Radio,
  AlertTriangle,
} from "lucide-react"


const QUICK_ACTIONS: Array<{ label: string; description: string; href: string; icon: React.ComponentType<{ className?: string }>; gradient: string }> = [
  { label: "Users", description: "Manage accounts and roles", href: "/dashboard/admin/users", icon: Users, gradient: "from-blue-500 to-cyan-500" },
  { label: "Applications", description: "Review job applications", href: "/dashboard/admin/applications", icon: ClipboardList, gradient: "from-pink-500 to-rose-500" },
  { label: "Affiliates", description: "Requests, links and sales", href: "/dashboard/admin/affiliates", icon: Link2, gradient: "from-indigo-500 to-purple-500" },
  { label: "Activities", description: "Audit trail across the app", href: "/dashboard/admin/activities", icon: Activity, gradient: "from-amber-500 to-orange-500" },
]

/**
 * Purchase-intent funnel. The first three steps are tracked from our own
 * frontend; Lemon Squeezy only ever sees people who reached its checkout.
 */
function FunnelSection() {
  const { funnel, loading } = useAdminFunnel()

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Conversion Funnel</h2>
        <div className="h-32 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
      </section>
    )
  }
  if (!funnel) return null

  const steps: StatConfig[] = [
    { label: "Pricing Viewed", value: funnel.pricingViewed, icon: Eye, gradient: "from-slate-500 to-slate-400", accent: "text-slate-300" },
    { label: "Plan Clicked", value: funnel.planClicked, icon: MousePointerClick, gradient: "from-blue-500 to-cyan-500", accent: "text-blue-400" },
    { label: "Checkout Started", value: funnel.checkoutStarted, icon: CreditCard, gradient: "from-purple-500 to-fuchsia-500", accent: "text-purple-400" },
    { label: "Completed", value: funnel.completed, icon: TrendingUp, gradient: "from-emerald-500 to-teal-500", accent: "text-emerald-400" },
  ]

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Conversion Funnel</h2>
        <Link href="/dashboard/admin/funnel/conversion" className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1">
          Full breakdown <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {funnel.byTier.length > 0 && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                  <th className="text-left font-medium py-3 px-5">Tier</th>
                  <th className="text-right font-medium py-3 px-5">Clicked</th>
                  <th className="text-right font-medium py-3 px-5">Checkout</th>
                  <th className="text-right font-medium py-3 px-5">Completed</th>
                  <th className="text-right font-medium py-3 px-5">Abandoned</th>
                  <th className="text-right font-medium py-3 px-5">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {funnel.byTier.map((t: FunnelTierBreakdown) => (
                  <tr key={t.tier} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900">
                    <td className="py-3 px-5 text-slate-100 font-medium">{t.tier}</td>
                    <td className="py-3 px-5 text-right text-slate-300 tabular-nums">{t.clicked}</td>
                    <td className="py-3 px-5 text-right text-slate-300 tabular-nums">{t.checkoutStarted}</td>
                    <td className="py-3 px-5 text-right text-emerald-400 tabular-nums">{t.completed}</td>
                    <td className="py-3 px-5 text-right text-amber-400 tabular-nums">{t.abandoned}</td>
                    <td className="py-3 px-5 text-right text-slate-300 tabular-nums">{t.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export default function AdminDashboardPage() {
  const { stats, loading, refresh } = useAdminStats()

  // "Online now" is only useful if it is actually now.
  useEffect(() => {
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh])
  const { profile } = useSupabase()

  const firstName = (profile?.full_name || profile?.email || "Admin").split(" ")[0]

  const live: StatConfig[] = [
    {
      label: "Online Now",
      value: stats?.onlineUsers ?? 0,
      icon: Radio,
      gradient: "from-green-500 to-emerald-500",
      accent: "text-green-400",
      href: "/dashboard/admin/users",
      hint: `active in the last ${stats?.onlineWindowMinutes ?? 5} min`,
    },
    { label: "Active Today", value: stats?.activeUsers24h ?? 0, icon: Activity, gradient: "from-teal-500 to-cyan-500", accent: "text-teal-400", hint: "last 24 hours" },
    {
      label: "Errors",
      value: stats?.errors24h ?? 0,
      icon: AlertTriangle,
      gradient: "from-red-500 to-orange-500",
      accent: "text-red-400",
      href: "/dashboard/admin/errors",
      hint: "last 24 hours",
    },
  ]

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
      href: "/dashboard/admin/affiliates",
    },
    { label: "Total Sales", value: stats?.totalSales ?? 0, icon: TrendingUp, gradient: "from-emerald-500 to-teal-500", accent: "text-emerald-400", href: "/dashboard/admin/affiliates" },
    { label: "Affiliate Requests", value: stats?.pendingAffiliateRequests ?? 0, icon: Handshake, gradient: "from-indigo-500 to-violet-500", accent: "text-indigo-400", href: "/dashboard/admin/affiliates", hint: "pending review" },
    { label: "Published Blogs", value: stats?.publishedBlogs ?? 0, icon: FileText, gradient: "from-orange-500 to-red-500", accent: "text-orange-400", href: "/dashboard/admin/blogs" },
  ]

  const inbox: StatConfig[] = [
    { label: "Unread Mails", value: stats?.unreadMails ?? 0, icon: Mail, gradient: "from-red-500 to-pink-500", accent: "text-red-400", href: "/dashboard/admin/emails?tab=receiving" },
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Right now</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {live.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      </section>

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

      <FunnelSection />

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
