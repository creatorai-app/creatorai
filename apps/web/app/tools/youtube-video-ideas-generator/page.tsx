import ToolPageShell from "@/components/tools/ToolPageShell"
import IdeaGeneratorWidget from "@/components/tools/IdeaGeneratorWidget"
import { getFreeTool } from "@/lib/free-tools"

const tool = getFreeTool("youtube-video-ideas-generator")!

export default function YouTubeVideoIdeasGeneratorPage() {
  return (
    <ToolPageShell tool={tool}>
      <IdeaGeneratorWidget />
    </ToolPageShell>
  )
}
