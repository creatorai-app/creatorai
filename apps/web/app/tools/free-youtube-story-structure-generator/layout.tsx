import type { Metadata } from "next"
import { getFreeTool } from "@/lib/free-tools"
import { ToolJsonLd, toolMetadata } from "@/lib/tool-seo"

const tool = getFreeTool("free-youtube-story-structure-generator")!

export const metadata: Metadata = toolMetadata(tool)

export default function StoryStructureGeneratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ToolJsonLd tool={tool} />
      {children}
    </>
  )
}
