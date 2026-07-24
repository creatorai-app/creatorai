"use client"

import * as motion from "motion/react-m";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { ThumbnailProgress } from "./ThumbnailProgress";
import { GenerationPlaceholder } from "@/components/dashboard/common/GenerationPlaceholder"

interface ThumbnailOutputPanelProps {
  isGenerating: boolean
  progress: number
  statusMessage: string
  generatedImages: string[]
  creditsConsumed?: number
  onRegenerate: () => void
  onDownload: (url: string, index: number) => void
  onNewGeneration?: () => void
}

export function ThumbnailOutputPanel({
  isGenerating,
  progress,
  statusMessage,
  generatedImages,
  creditsConsumed = 0,
  onRegenerate,
  onDownload,
  onNewGeneration,
}: ThumbnailOutputPanelProps) {
  const hasImages = generatedImages.length > 0

  return (
    <Card className="lg:sticky lg:top-8 lg:min-h-[600px]">
      <CardHeader>
        <CardTitle>Your Thumbnails</CardTitle>
      </CardHeader>

      <CardContent>
        {isGenerating ? (
          <ThumbnailProgress progress={progress} statusMessage={statusMessage} />
        ) : hasImages ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="space-y-4"
          >
            {generatedImages.map((url, index) => (
              <motion.div
                key={url}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.12 }}
                className="group relative overflow-hidden rounded-lg border bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="aspect-video relative">
                  <img
                    src={url}
                    alt={`Thumbnail variation ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 gap-1.5"
                      onClick={() => onDownload(url, index)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Variation {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onDownload(url, index)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <GenerationPlaceholder
            title="Ready to create thumbnails?"
            description="Fill out the form and our AI will generate 3 unique thumbnail variations."
          />
        )}
      </CardContent>

      {hasImages && (
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            Regenerating will cost{" "}
            <span className="font-medium">3 credits</span>.
          </p>
          <Button
            variant="outline"
            onClick={onRegenerate}
            disabled={isGenerating}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
