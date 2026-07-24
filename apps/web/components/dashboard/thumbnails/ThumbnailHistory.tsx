"use client"

import * as motion from "motion/react-m";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Download, Clock, ImageIcon, AlertCircle } from "lucide-react";
import { Skeleton } from "@repo/ui/skeleton";
import type { ThumbnailJob } from "@/hooks/useThumbnailGeneration"

interface ThumbnailHistoryProps {
  jobs: ThumbnailJob[]
  isLoading: boolean
  onDownload: (url: string, index: number) => void
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "Queued", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
}

export function ThumbnailHistory({ jobs, isLoading, onDownload }: ThumbnailHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Generations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Generations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No thumbnails generated yet</p>
            <p className="text-sm mt-1">Your generated thumbnails will appear here</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Generations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobs.map((job, idx) => {
          const config = (statusConfig[job.status] ?? statusConfig.queued)!

          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-lg border p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.prompt}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={config.variant} className="text-xs">
                      {config.label}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {job.ratio} · {new Date(job.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {job.status === 'failed' && job.error_message && (
                <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span className="truncate">{job.error_message}</span>
                </div>
              )}

              {job.status === 'completed' && job.image_urls?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {job.image_urls.map((url: string, i: number) => (
                    <div key={url} className="relative group shrink-0">
                      <img
                        src={url}
                        alt={`Thumbnail ${i + 1}`}
                        className="h-16 w-auto rounded border object-cover"
                        loading="lazy"
                      />
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute inset-0 w-full h-full rounded opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity"
                        onClick={() => onDownload(url, i)}
                      >
                        <Download className="h-3.5 w-3.5 text-white" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )
        })}
      </CardContent>
    </Card>
  )
}
