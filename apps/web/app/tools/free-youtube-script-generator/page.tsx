import ToolPageShell from "@/components/tools/ToolPageShell"
import ScriptGeneratorWidget from "@/components/tools/ScriptGeneratorWidget"
import { getFreeTool } from "@/lib/free-tools"

const tool = getFreeTool("free-youtube-script-generator")!

export default function YouTubeScriptGeneratorPage() {
  return (
    <ToolPageShell tool={tool}>
      <ScriptGeneratorWidget />
    </ToolPageShell>
  )
}
