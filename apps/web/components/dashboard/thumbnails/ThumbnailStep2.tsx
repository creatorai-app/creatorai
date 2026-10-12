"use client"

import { Label } from "@repo/ui/label"
import { Input } from "@repo/ui/input"
import { Button } from "@repo/ui/button"
import type { ThumbnailRatio } from "@/hooks/useThumbnailGeneration"

const ratioOptions: { value: ThumbnailRatio; label: string; desc: string }[] = [
  { value: "16:9", label: "16:9", desc: "YouTube Standard" },
  { value: "9:16", label: "9:16", desc: "Shorts / Stories" },
  { value: "1:1", label: "1:1", desc: "Square" },
  { value: "4:3", label: "4:3", desc: "Classic" },
]

interface ThumbnailStep2Props {
  ratio: ThumbnailRatio
  setRatio: (v: ThumbnailRatio) => void
  videoLink: string
  setVideoLink: (v: string) => void
}

export default function ThumbnailStep2({
  ratio,
  setRatio,
  videoLink,
  setVideoLink,
}: ThumbnailStep2Props) {
  return (
    <div className="space-y-8">
      <h3 className="text-xl font-semibold">Step 2: Choose ratio and video.</h3>

      {/* Ratio Selection */}
      <div className="space-y-3">
        <Label>Aspect Ratio</Label>
        <p className="text-sm text-muted-foreground">
          Select the target aspect ratio for your thumbnail.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {ratioOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={ratio === opt.value ? "default" : "outline"}
              onClick={() => setRatio(opt.value)}
              className="min-w-[100px]"
            >
              {opt.label}
              <span className="ml-1.5 text-xs opacity-70 hidden sm:inline">
                {opt.desc}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Video Link */}
      <div className="space-y-3">
        <Label htmlFor="videoLink">YouTube / Google Drive Link</Label>
        <p className="text-sm text-muted-foreground">
          Provide a video link for context-aware thumbnail generation.
        </p>
        <Input
          id="videoLink"
          placeholder="https://youtube.com/watch?v=..."
          value={videoLink}
          onChange={(e) => setVideoLink(e.target.value)}
          className="focus-visible:ring-purple-500"
        />
      </div>

      {/* Personalization Info */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">Personalized to your style</Label>
          <p className="text-sm text-muted-foreground">
            If your AI memory is built, thumbnails will match your channel's
            visual identity and past thumbnail style automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
