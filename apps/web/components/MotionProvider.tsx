"use client"

import { LazyMotion } from "motion/react"
import type { ReactNode } from "react"

/**
 * Loads Motion's animation feature bundle once, for the whole app.
 *
 * Every animated component in the codebase imports the slim `m` component from
 * `motion/react-m` (≈4.6kB, tree-shakeable) instead of the full `motion`
 * component (34kB, un-tree-shakeable). `m` on its own renders but doesn't
 * animate — it needs a feature set provided by a `LazyMotion` ancestor.
 *
 * `domMax` is required because the navbar, tabs and dock use shared-layout
 * animations (`layoutId`) and some dashboard surfaces use drag. It's loaded via
 * a dynamic import so the ~25kB feature bundle is a separate chunk fetched after
 * the page is interactive, rather than sitting in the first-load JS competing
 * with hydration (the window Lighthouse measures for Total Blocking Time).
 *
 * No `strict`: it would throw if any third-party dependency rendered a full
 * `motion` component inside this tree, and it adds no bundle saving over our own
 * code already using `m`.
 */
const loadFeatures = () => import("motion/react").then((mod) => mod.domMax)

export default function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>
}
