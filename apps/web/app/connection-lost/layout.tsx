import type { Metadata } from "next"
import type React from "react"
import { createMetadata, noIndexRobots } from "@/lib/seo"

export const metadata: Metadata = createMetadata({
  title: "Connection lost",
  description: "We can't reach Creator AI right now.",
  robots: noIndexRobots,
})

export default function ConnectionLostLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
