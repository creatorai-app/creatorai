import type { Metadata } from "next"
import { createMetadata, siteConfig } from "@/lib/seo"
import JsonLd from "@/components/JsonLd"
import { FREE_TOOLS } from "@/lib/free-tools"

export const metadata: Metadata = createMetadata({
  title: "Free AI Tools for YouTube Creators: No Signup Required",
  description:
    "Free AI tools for YouTube creators: generate a video idea or a full script in seconds. No signup for your first run, no credit card, yours to keep.",
  keywords: [
    "free ai tools for youtube",
    "free youtube tools",
    "youtube script generator",
    "youtube video ideas generator",
    "ai tools for content creators",
  ],
  alternates: { canonical: "/tools" },
  openGraph: { url: "/tools", type: "website" },
})

/**
 * Applies to the hub AND every tool page nested under it. The child layouts add
 * their own SoftwareApplication/FAQ schema; this one contributes the ItemList
 * that ties the set together, so a crawler landing on any tool can see the rest.
 */
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Free AI tools for YouTube creators",
    description:
      "Free, no-signup AI tools from Creator AI for generating YouTube video ideas and scripts.",
    itemListElement: FREE_TOOLS.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.name,
      description: tool.cardDescription,
      url: `${siteConfig.url}/tools/${tool.slug}`,
    })),
  }

  return (
    <>
      <JsonLd data={itemListJsonLd} />
      {children}
    </>
  )
}
