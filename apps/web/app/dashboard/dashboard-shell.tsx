"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSupabase } from "@/components/supabase-provider"
import { DashboardSidebar } from "@/components/dashboard/sidebar/dashboard-sidebar"
import DashboardHeader from "@/components/dashboard-header"
import DashboardFooter from "@/components/dashboard/DashboardFooter"
import HannahChat from "@/components/hannah/HannahChat"
import { SubscriptionExpiryModal } from "@/components/billing/subscription-expiry-modal"

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarPinned, setSidebarPinned] = useState(false)
  const { loading, profile, profileLoading } = useSupabase()
  const pathname = usePathname()
  const router = useRouter()

  const isAdminRoute = pathname.startsWith("/dashboard/admin")

  useEffect(() => {
    if (!loading && !profileLoading && profile?.role === "admin" && !isAdminRoute) {
      router.replace("/dashboard/admin")
    }
  }, [loading, profileLoading, profile, isAdminRoute, router])

  if (isAdminRoute) {
    return <>{children}</>
  }

  if (loading || profileLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-500 border-t-transparent"></div>
      </div>
    )
  }

  if (profile?.role === "admin") return null

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <DashboardSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} pinned={sidebarPinned} setPinned={setSidebarPinned} />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <DashboardHeader />
        {/* Flex column, not plain flow: pages use h-full, which only resolves
            against a stretched flex item — otherwise their content spills past
            the box and the footer lands on top of it. */}
        {/* overflow-x-hidden: decorative blur blobs on several pages are wider
            than a phone screen and would otherwise make the page scroll sideways. */}
        {/* pb-20 below lg: room to scroll the last buttons clear of the floating Hannah chat button */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col pb-20 lg:pb-0">
          <div className="flex-1">{children}</div>
          <DashboardFooter />
        </div>
      </div>
      <HannahChat context="dashboard" />
      <SubscriptionExpiryModal />
    </div>
  )
}
