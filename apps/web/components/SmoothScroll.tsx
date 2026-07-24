"use client"

import { useSmoothScroll } from "@/hooks/useSmoothScroll"

/**
 * Renderless client island that enables Lenis smooth scrolling on an otherwise
 * server-rendered page. Lets a Server Component opt into the marketing smooth
 * scroll without becoming a Client Component itself.
 */
export default function SmoothScroll() {
  useSmoothScroll()
  return null
}
