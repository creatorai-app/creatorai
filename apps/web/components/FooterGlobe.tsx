"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import type { WorldProps } from "@repo/ui/globe"

const World = dynamic(() => import("@repo/ui/globe").then((m) => m.World), {
  ssr: false,
})

/**
 * Visibility-gated wrapper for the decorative footer globe.
 *
 * The globe pulls three.js + three-globe — ~720kB across three chunks that cost
 * roughly 18s of main-thread time on a throttled mobile CPU. `next/dynamic`
 * alone only kept it out of the initial bundle; it still downloaded and
 * executed right after hydration, on every marketing page, for an element at
 * the very bottom of the footer that most visitors never scroll to. That was
 * the single largest contributor to Total Blocking Time.
 *
 * Now it mounts only when the footer is actually approaching the viewport, and
 * never for visitors who asked for reduced motion (it is a continuously
 * rotating WebGL animation). The wrapper keeps the container's fixed height in
 * both cases, so nothing shifts either way.
 */
export default function FooterGlobe({ data, globeConfig }: WorldProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true)
          io.disconnect()
        }
      },
      // Start loading a little before it scrolls in, so it's ready on arrival.
      { rootMargin: "200px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className="absolute inset-0">
      {show && <World data={data} globeConfig={globeConfig} />}
    </div>
  )
}
