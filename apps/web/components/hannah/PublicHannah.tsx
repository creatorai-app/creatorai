"use client"

import { usePathname } from "next/navigation"
import HannahChat from "./HannahChat"

/**
 * Mounts the public Hannah on every marketing/auth page. The dashboard renders
 * its own Hannah (with dashboard context) in dashboard-shell, so we hide here to
 * avoid two widgets.
 */
export default function PublicHannah() {
  const pathname = usePathname()
  if (pathname.startsWith("/dashboard")) return null
  return <HannahChat context="public" />
}
