"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@repo/ui/button"
import { Card, CardContent } from "@repo/ui/card"
import { Textarea } from "@repo/ui/textarea"
import { Label } from "@repo/ui/label"
import { ArrowLeft, Loader2, Wand2, Pencil } from "lucide-react"
import { useSSE, type SSEEvent } from "@/hooks/useSSE"
import { getApiErrorMessage } from "@/lib/api-client"
import {
  getVideoGeneration,
  editVideoGeneration,
  type VideoGenerationJob,
} from "@/lib/api/getVideoGenerations"

export default function EditVideoPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id

  const [source, setSource] = useState<VideoGenerationJob | null | undefined>(undefined)
  const [instruction, setInstruction] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [newVideoJobId, setNewVideoJobId] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getVideoGeneration(id).then(setSource)
  }, [id])

  const { progress, statusMessage } = useSSE<string>({
    jobId,
    endpoint: "/api/v1/video-generation/status",
    extractResult: (data: SSEEvent) => (data as any).videoUrl ?? null,
    onComplete: (url) => {
      if (url) {
        setResultUrl(url)
        toast.success("Edit applied!")
      }
    },
    onFinished: () => {
      setIsSubmitting(false)
      setJobId(null)
    },
  })

  const canEdit = source && source.status === "completed" && source.interaction_id

  const handleSubmit = async () => {
    if (!id || instruction.trim().length < 3) {
      toast.error("Describe the change (at least 3 characters)")
      return
    }
    setIsSubmitting(true)
    setResultUrl(null)
    try {
      const res = await editVideoGeneration(id, instruction.trim())
      setJobId(res.jobId)
      setNewVideoJobId(res.videoJobId)
      toast.success("Applying your edit…")
    } catch (error) {
      toast.error("Edit failed", { description: getApiErrorMessage(error, "Please try again.") })
      setIsSubmitting(false)
      setJobId(null)
    }
  }

  return (
    <div className="container max-w-4xl py-8 md:py-12">
      <Link
        href="/dashboard/video-generation"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to video generation
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <Pencil className="h-6 w-6 text-purple-600" /> Edit video
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Describe one change at a time — Omni keeps everything else intact (stateful editing).
        </p>
      </div>

      {source === undefined && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {source === null && (
        <Card><CardContent className="py-12 text-center text-slate-500">Video not found.</CardContent></Card>
      )}

      {source && !canEdit && (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            This video can&apos;t be edited yet — only finished clips are editable.
          </CardContent>
        </Card>
      )}

      {source && canEdit && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label>{resultUrl ? "Original" : "Current video"}</Label>
            {source.video_url && (
              <video src={source.video_url} controls className="w-full rounded-lg border border-slate-200 dark:border-slate-700" />
            )}
            <p className="text-xs text-slate-400 line-clamp-2">{source.prompt}</p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="instruction">What should change?</Label>
                <Textarea
                  id="instruction"
                  placeholder={'e.g. "Make it night time" · "Remove the on-screen text" · "Add falling snow"'}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={4}
                  disabled={isSubmitting}
                />
              </div>

              {isSubmitting && (
                <div className="space-y-2">
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{statusMessage}</p>
                </div>
              )}

              <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Applying…</>
                ) : (
                  <><Wand2 className="h-4 w-4 mr-2" /> Apply edit</>
                )}
              </Button>

              {resultUrl && !isSubmitting && (
                <div className="space-y-3">
                  <Label>Edited result</Label>
                  <video src={resultUrl} controls className="w-full rounded-lg border border-slate-200 dark:border-slate-700" />
                  {newVideoJobId && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        // Chain: keep editing the just-produced clip.
                        setResultUrl(null)
                        setInstruction("")
                        router.push(`/dashboard/video-generation/${newVideoJobId}/edit`)
                      }}
                    >
                      Continue editing this result
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
