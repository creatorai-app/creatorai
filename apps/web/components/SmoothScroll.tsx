"use client"

import { useSmoothScroll } from "@/hooks/useSmoothScroll"

/**
 * Renders nothing; exists so a server component can opt into Lenis.
 *
 * The /tools pages are deliberately server-rendered so the copy that has to
 * rank is in the HTML, which means they cannot call the hook themselves. Drop
 * this in instead of turning a whole page into a client component.
 */
export default function SmoothScroll() {
  useSmoothScroll()
  return null
}
