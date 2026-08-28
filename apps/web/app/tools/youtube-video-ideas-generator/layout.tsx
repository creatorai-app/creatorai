import type { Metadata } from "next"
import { getFreeTool } from "@/lib/free-tools"
import { ToolJsonLd, toolMetadata } from "@/lib/tool-seo"

const tool = getFreeTool("youtube-video-ideas-generator")!

export const metadata: Metadata = toolMetadata(tool)

export default function IdeasGeneratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToolJsonLd tool={tool} />
      {children}
    </>
  )
}
