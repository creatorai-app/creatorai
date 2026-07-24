"use client"

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useState } from "react";
import HannahLogo from "./HannahLogo"

/**
 * Mounts the public Hannah on every marketing/auth page. The dashboard renders
 * its own Hannah (with dashboard context) in dashboard-shell, so we hide here to
 * avoid two widgets.
 *
 * HannahChat pulls react-markdown, remark-gfm, axios and the API client — well
 * over 100kB that used to sit in every marketing page's first-load bundle for a
 * widget that starts closed. Only the launcher ships up front now; the chat
 * itself loads on the first click.
 */
const HannahChat = dynamic(() => import("./HannahChat"), { ssr: false })

export default function PublicHannah() {
  const pathname = usePathname()
  const [opened, setOpened] = useState(false)

  if (pathname.startsWith("/dashboard")) return null

  if (opened) return <HannahChat context="public" autoOpen />

  // Visually identical to the launcher inside HannahChat, minus the motion
  // wrapper — CSS handles hover/press, so no animation library is needed here.
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end print:hidden">
      <button
        onClick={() => setOpened(true)}
        aria-label="Chat with Hannah"
        className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-500/30 ring-1 ring-white/20 transition-transform duration-150 hover:scale-105 active:scale-95"
      >
        <HannahLogo size={40} />
      </button>
    </div>
  )
}
