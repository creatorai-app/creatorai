"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { CreditCard, Filter } from "lucide-react"

const TABS = [
  { label: "Subscriptions", href: "/dashboard/admin/funnel", icon: CreditCard },
  { label: "Conversion Funnel", href: "/dashboard/admin/funnel/conversion", icon: Filter },
]

export default function FunnelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
                isActive ? "text-purple-300" : "text-slate-400 hover:text-slate-100"
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
              )}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
