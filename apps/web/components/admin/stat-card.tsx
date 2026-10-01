"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

export type StatConfig = {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  accent: string
  href?: string
  onClick?: () => void
  hint?: string
}

export function StatCard({ label, value, icon: Icon, gradient, accent, href, onClick, hint }: StatConfig) {
  const card = (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-5 text-left transition-all hover:border-slate-700 hover:bg-slate-900">
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
      {(href || onClick) && (
        <div className={`relative mt-4 pt-4 border-t border-slate-800/70 flex items-center gap-1 text-xs font-medium ${accent} opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity`}>
          View details
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  )
  if (href) return <Link href={href}>{card}</Link>
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="group block w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60">
        {card}
      </button>
    )
  }
  return card
}
