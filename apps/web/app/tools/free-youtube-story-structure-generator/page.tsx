import ToolPageShell from "@/components/tools/ToolPageShell"
import StoryStructureWidget from "@/components/tools/StoryStructureWidget"
import { getFreeTool } from "@/lib/free-tools"

const tool = getFreeTool("free-youtube-story-structure-generator")!

export default function YouTubeStoryStructureGeneratorPage() {
  return (
    <ToolPageShell tool={tool}>
      <StoryStructureWidget />
    </ToolPageShell>
  )
}
