"use client"

import { Card, CardContent } from "@repo/ui/card"
import { Badge } from "@repo/ui/badge"
import { Button } from "@repo/ui/button"
import { Trash2, Video as VideoIcon, Loader2, Pencil } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { deleteVideoGeneration, type VideoGenerationJob } from "@/lib/api/getVideoGenerations"

const STATUS_VARIANT: Record<VideoGenerationJob["status"], string> = {
  queued: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
}

export function VideoGenerationHistory({
  jobs, isLoading, onChanged,
}: {
  jobs: VideoGenerationJob[]
  isLoading: boolean
  onChanged: () => void
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const ok = await deleteVideoGeneration(id)
    setDeletingId(null)
    if (ok) onChanged()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <VideoIcon className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No videos yet. Generate your first one above.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardContent className="p-4 flex gap-4">
            <div className="flex-shrink-0 w-40">
              {job.status === "completed" && job.video_url ? (
                <video src={job.video_url} controls className="w-full rounded-md border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="w-full aspect-video rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  {job.status === "failed"
                    ? <span className="text-xs text-red-500">Failed</span>
                    : job.status === "cancelled"
                      ? <span className="text-xs text-slate-400">Cancelled</span>
                      : <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={STATUS_VARIANT[job.status]}>{job.status}</Badge>
                <span className="text-xs text-slate-400">{job.duration_seconds}s · {job.aspect_ratio}</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2">{job.prompt}</p>
              {job.error_message && (
                <p className="text-xs text-red-500 mt-1 line-clamp-1">{job.error_message}</p>
              )}
              {job.credits_consumed > 0 && (
                <p className="text-xs text-slate-400 mt-1">{job.credits_consumed} credits</p>
              )}
            </div>

            <div className="flex-shrink-0 flex flex-col gap-1">
              {job.status === "completed" && job.interaction_id && (
                <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-purple-500" title="Regenerate / edit">
                  <Link href={`/dashboard/video-generation/${job.id}/edit`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(job.id)}
                disabled={deletingId === job.id}
                className="text-slate-400 hover:text-red-500"
              >
                {deletingId === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
