import type { Metadata } from "next"
import type React from "react"
import { createMetadata, noIndexRobots } from "@/lib/seo"

export const metadata: Metadata = createMetadata({
  title: "Error",
  description: "An error occurred.",
  robots: noIndexRobots,
})

export default function ErrorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
