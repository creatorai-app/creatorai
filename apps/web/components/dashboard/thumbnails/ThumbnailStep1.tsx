"use client"

import { Label } from "@repo/ui/label"
import { Textarea } from "@repo/ui/textarea"
import * as motion from "motion/react-m"
import { Loader2, Wand2 } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"

interface ThumbnailStep1Props {
  prompt: string
  setPrompt: (v: string) => void
  context: string
  setContext: (v: string) => void
  promptError: string | null
  onSurpriseMe: () => void
  isSurprising: boolean
  isTyping: boolean
  isGenerating: boolean
}

export default function ThumbnailStep1({
  prompt,
  setPrompt,
  context,
  setContext,
  promptError,
  onSurpriseMe,
  isSurprising,
  isTyping,
  isGenerating,
}: ThumbnailStep1Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Step 1: Describe your thumbnail</h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="prompt">
            Thumbnail Prompt <span className="text-red-500">*</span>
          </Label>
          {/* Surprise me — on-brand prompt from the creator's trained style and source content. */}
          <motion.button
            type="button"
            onClick={onSurpriseMe}
            disabled={isSurprising || isTyping || isGenerating}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="group relative inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm disabled:opacity-60"
          >
            <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
            {isSurprising ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <motion.span
                animate={{ rotate: [0, -12, 12, 0] }}
                transition={{ repeat: Infinity, repeatDelay: 2.5, duration: 0.8 }}
              >
                <Wand2 className="h-3.5 w-3.5" />
              </motion.span>
            )}
            Surprise me
          </motion.button>
        </div>
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isTyping}
          placeholder="e.g., A dramatic thumbnail showing a person reacting to a computer screen with bold red and blue gradient, text overlay saying 'SHOCKING RESULTS'"
          className={cn(
            "min-h-[120px] focus-visible:ring-purple-500",
            isTyping && "ring-1 ring-purple-400/60 transition-shadow",
          )}
        />
        {promptError && <p className="text-red-500 text-sm">{promptError}</p>}
        <p className="text-xs text-muted-foreground">
          Be specific about colors, composition, text overlays, and mood — or let Surprise me
          draft one in your channel style.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="context">Additional Context</Label>
        <Textarea
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g., The video is about productivity tips for developers. My channel has a dark/techy aesthetic."
          className="min-h-[100px] focus-visible:ring-purple-500"
        />
        <p className="text-xs text-muted-foreground">
          What the video is about. Used by Surprise me and by the generator.
        </p>
      </div>
    </div>
  )
}
