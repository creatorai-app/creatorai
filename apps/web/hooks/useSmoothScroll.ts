"use client"

import { useEffect } from "react";
import "lenis/dist/lenis.css"

/**
 * Lenis inertia scrolling for the marketing pages.
 *
 * Previously every marketing page did `new Lenis({ autoRaf: true })` inline,
 * which put Lenis in each page's first-load JS and started a permanent
 * requestAnimationFrame loop during hydration — exactly the window Lighthouse
 * measures for Total Blocking Time. Two changes, no change to how it feels on
 * the desktop pages where the effect actually reads:
 *
 *   - Loaded with a dynamic import, so the library is a separate chunk fetched
 *     after the page is interactive rather than part of the critical bundle.
 *   - Skipped on touch devices and for `prefers-reduced-motion`. Lenis does not
 *     smooth native touch scrolling by default anyway (`syncTouch` is off), so
 *     on phones the rAF loop was pure cost for no visible effect — and phones
 *     are where the performance score hurts most.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches
    ) {
      return
    }

    let instance: { destroy: () => void } | null = null
    let cancelled = false

    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return
      instance = new Lenis({ autoRaf: true })
    })

    return () => {
      cancelled = true
      instance?.destroy()
    }
  }, [])
}
