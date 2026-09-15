"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { useSupabase } from "@/components/supabase-provider"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { downloadFile } from "@/lib/download"
import { useSSE, type SSEEvent } from "./useSSE"
import { useTypewriter } from "./useTypewriter"

export type ThumbnailRatio = '16:9' | '9:16' | '1:1' | '4:3'

export interface ThumbnailJob {
  id: string
  user_id: string
  prompt: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  ratio: ThumbnailRatio
  generate_count: number
  image_urls: string[]
  reference_image_url: string | null
  face_image_url: string | null
  video_link: string | null
  video_frame_url: string | null
  error_message: string | null
  credits_consumed: number
  job_id: string | null
  created_at: string
  updated_at: string
}

interface GenerateResponse {
  id: string
  jobId: string
  status: string
  message: string
}

interface UseThumbnailGenerationOptions {
  onComplete?: (thumbnailJobId: string) => void
  initialPrompt?: string
  initialContext?: string
  initialScriptId?: string
  initialStoryBuilderId?: string
  initialIdeationId?: string
  initialIdeaIndex?: number
}

const STATUS_MESSAGES: Record<string, (p: number) => string> = {
  waiting: () => "Waiting in queue...",
  default: (p) =>
    p < 20 ? "Preparing generation..." :
    p < 80 ? `Generating thumbnails... ${p}%` :
    p < 100 ? "Finalizing..." : "Done!",
}

export function useThumbnailGeneration(options?: UseThumbnailGenerationOptions) {
  const { profile } = useSupabase()

  const [prompt, setPrompt] = useState(options?.initialPrompt ?? "")
  const [context, setContext] = useState(options?.initialContext ?? "")
  const [ratio, setRatio] = useState<ThumbnailRatio>("16:9")
  const [scriptId] = useState(options?.initialScriptId)
  const [storyBuilderId] = useState(options?.initialStoryBuilderId)
  const [ideationId] = useState(options?.initialIdeationId)
  const [ideaIndex] = useState(options?.initialIdeaIndex)
  const [generateCount] = useState(3)
  const [videoLink, setVideoLink] = useState("")
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const [faceImage, setFaceImage] = useState<File | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [isSurprising, setIsSurprising] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [thumbnailJobId, setThumbnailJobId] = useState<string | null>(null)

  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [creditsConsumed, setCreditsConsumed] = useState(0)
  const [pastJobs, setPastJobs] = useState<ThumbnailJob[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(true)

  const fetchPastJobs = async () => {
    setIsLoadingJobs(true)
    try {
      const data = await api.get<ThumbnailJob[]>('/api/v1/thumbnail', { requireAuth: true })
      console.debug("[thumbnail] fetched jobs", {
        count: data.length,
        latest: data[0] ? { id: data[0].id, status: data[0].status, updated_at: data[0].updated_at } : null,
      })
      setPastJobs(data)
    } catch (error) {
      toast.error("Failed to load thumbnail jobs", {
        description: getApiErrorMessage(error, "Please try again."),
      })
    } finally {
      setIsLoadingJobs(false)
    }
  }

  useEffect(() => { fetchPastJobs() }, [])

  const sse = useSSE<string[]>({
    jobId,
    endpoint: "/api/v1/thumbnail/status",
    getStatusMessages: (p, state) =>
      state === "waiting" ? STATUS_MESSAGES.waiting!(p) : STATUS_MESSAGES.default!(p),
    extractResult: (data: SSEEvent) => (data as any).imageUrls ?? null,
    onComplete: (imageUrls) => {
      console.debug("[thumbnail] SSE complete event", {
        jobId,
        thumbnailJobId,
        imageCount: imageUrls?.length ?? 0,
      })
      if (imageUrls) {
        setGeneratedImages(imageUrls)
        setCreditsConsumed(imageUrls.length)
        toast.success("Thumbnails generated!", {
          description: `${imageUrls.length} thumbnail${imageUrls.length > 1 ? 's' : ''} ready`,
        })
        fetchPastJobs()
        if (thumbnailJobId && options?.onComplete) {
          options.onComplete(thumbnailJobId)
        }
      }
    },
    onFinished: () => {
      setIsGenerating(false)
      setJobId(null)
    },
  })

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.trim().length < 3) {
      toast.error("Prompt must be at least 3 characters")
      return
    }

    setIsGenerating(true)
    setGeneratedImages([])
    setCreditsConsumed(0)

    try {
      const formData = new FormData()
      formData.append('prompt', prompt.trim())
      formData.append('ratio', ratio)
      formData.append('generateCount', String(generateCount))
      formData.append('personalized', String(profile?.ai_trained ?? false))

      if (videoLink.trim()) formData.append('videoLink', videoLink.trim())
      if (referenceImage) formData.append('referenceImage', referenceImage)
      if (faceImage) formData.append('faceImage', faceImage)
      if (context.trim()) formData.append('context', context.trim())
      if (scriptId) formData.append('scriptId', scriptId)
      if (storyBuilderId) formData.append('storyBuilderId', storyBuilderId)
      if (ideationId) formData.append('ideationId', ideationId)
      if (ideaIndex != null) formData.append('ideaIndex', String(ideaIndex))

      const response = await api.upload<GenerateResponse>(
        '/api/v1/thumbnail/generate',
        formData,
        { requireAuth: true },
      )
      console.debug("[thumbnail] generation started", {
        thumbnailJobId: response.id,
        queueJobId: response.jobId,
      })

      setThumbnailJobId(response.id)
      setJobId(response.jobId)
      toast.success("Generation started!")
    } catch (error) {
      toast.error("Generation Failed", {
        description: getApiErrorMessage(error, "Failed to start generation."),
      })
      setIsGenerating(false)
      setJobId(null)
    }
  }

  const handleRegenerate = () => {
    setGeneratedImages([])
    handleGenerate()
  }

  const handleDownload = useCallback(
    (imageUrl: string, index: number) => downloadFile(imageUrl, `thumbnail_${index + 1}.png`),
    [],
  )

  const { typeOut, isTyping } = useTypewriter(setPrompt)

  /** Ask the API for an on-brand prompt seeded by the source this page was opened from. */
  const surpriseMe = async () => {
    setIsSurprising(true)
    try {
      const res = await api.post<{ success: boolean; prompt: string }>(
        '/api/v1/thumbnail/surprise',
        {
          context: context.trim() || undefined,
          scriptId,
          storyBuilderId,
          ideationId,
          ideaIndex,
        },
        { requireAuth: true },
      )
      if (res.prompt) typeOut(res.prompt)
    } catch (error) {
      toast.error("Couldn't dream one up", {
        description: getApiErrorMessage(error, "Please try again."),
      })
    } finally {
      setIsSurprising(false)
    }
  }

  // Landed here from a script, blueprint or idea with nothing typed yet: draft the
  // prompt from that source once, so the form arrives filled instead of blank.
  const autoDrafted = useRef(false)
  useEffect(() => {
    if (autoDrafted.current) return
    if (!scriptId && !storyBuilderId && ideationId == null) return
    if (prompt.trim()) return
    autoDrafted.current = true
    surpriseMe()
  }, [scriptId, storyBuilderId, ideationId])

  const clearForm = () => {
    setPrompt("")
    setContext("")
    setVideoLink("")
    setReferenceImage(null)
    setFaceImage(null)
    setRatio("16:9")
    setGeneratedImages([])
  }

  const showOutput = isGenerating || generatedImages.length > 0

  return {
    prompt, setPrompt,
    context, setContext,
    ratio, setRatio,
    generateCount,
    videoLink, setVideoLink,
    referenceImage, setReferenceImage,
    faceImage, setFaceImage,
    isGenerating, isSurprising, isTyping,
    progress: sse.progress, statusMessage: sse.statusMessage,
    generatedImages, creditsConsumed,
    showOutput,
    pastJobs, isLoadingJobs,
    handleGenerate, handleRegenerate, surpriseMe,
    handleDownload, clearForm,
  }
}
