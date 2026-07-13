"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { useSSE, type SSEEvent } from "./useSSE"
import {
  type VideoAspectRatio,
  type VideoDurationSeconds,
  type VideoGenerationMode,
  requiredImageRange,
} from "@repo/validation"

export interface VideoGenerationJob {
  id: string
  user_id: string
  prompt: string
  mode: VideoGenerationMode | "edit"
  status: "queued" | "processing" | "completed" | "failed" | "cancelled"
  aspect_ratio: VideoAspectRatio
  duration_seconds: number
  input_image_count: number
  model: string | null
  video_url: string | null
  video_gs_uri: string | null
  interaction_id: string | null
  parent_job_id: string | null
  script_id: string | null
  error_message: string | null
  credits_consumed: number
  job_id: string | null
  created_at: string
  updated_at: string
}

interface GenerateResponse {
  success: boolean
  videoJobId: string
  jobId: string
}

const STATUS_MESSAGES: Record<string, (p: number) => string> = {
  waiting: () => "Waiting in queue...",
  default: (p) =>
    p < 10 ? "Submitting to Omni Flash..." :
    p < 90 ? `Generating video... ${p}%` :
    p < 100 ? "Finalizing..." : "Done!",
}

/** Read a File as raw base64 (no data-URL prefix) plus its mime type. */
export function fileToImageInput(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve({ data: result.split(",")[1] ?? "", mimeType: file.type })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function useVideoGeneration() {
  const [prompt, setPrompt] = useState("")
  const [mode, setMode] = useState<VideoGenerationMode>("text_to_video")
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>("16:9")
  const [durationSeconds, setDurationSeconds] = useState<VideoDurationSeconds>(8)
  const [images, setImages] = useState<File[]>([])

  const [isGenerating, setIsGenerating] = useState(false)
  const [isSurprising, setIsSurprising] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [videoJobId, setVideoJobId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const [pastJobs, setPastJobs] = useState<VideoGenerationJob[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(true)

  // Switching mode drops images the new mode can't use (keeps the payload honest).
  const changeMode = (next: VideoGenerationMode) => {
    setMode(next)
    if (requiredImageRange(next).max === 0) setImages([])
    else setImages((prev) => prev.slice(0, requiredImageRange(next).max))
  }

  const fetchPastJobs = async () => {
    setIsLoadingJobs(true)
    try {
      const data = await api.get<{ jobs: VideoGenerationJob[] }>('/api/v1/video-generation', { requireAuth: true })
      setPastJobs(data.jobs ?? [])
    } catch (error) {
      toast.error("Failed to load videos", { description: getApiErrorMessage(error, "Please try again.") })
    } finally {
      setIsLoadingJobs(false)
    }
  }

  useEffect(() => { fetchPastJobs() }, [])

  const sse = useSSE<string>({
    jobId,
    endpoint: "/api/v1/video-generation/status",
    getStatusMessages: (p, state) =>
      state === "waiting" ? STATUS_MESSAGES.waiting!(p) : STATUS_MESSAGES.default!(p),
    extractResult: (data: SSEEvent) => (data as any).videoUrl ?? null,
    onComplete: (url) => {
      if (url) {
        setVideoUrl(url)
        toast.success("Video generated!")
      }
      fetchPastJobs()
    },
    onFinished: () => {
      setIsGenerating(false)
      setJobId(null)
    },
  })

  // Reveal the generated prompt letter-by-letter for a subtle "typing" effect.
  const typeOut = (text: string) => {
    if (typeTimer.current) clearInterval(typeTimer.current)
    setIsTyping(true)
    setPrompt("")
    let i = 0
    typeTimer.current = setInterval(() => {
      i += 1
      setPrompt(text.slice(0, i))
      if (i >= text.length) {
        if (typeTimer.current) clearInterval(typeTimer.current)
        typeTimer.current = null
        setIsTyping(false)
      }
    }, 22)
  }

  // Stop the animation if the component unmounts mid-type.
  useEffect(() => () => { if (typeTimer.current) clearInterval(typeTimer.current) }, [])

  const surpriseMe = async () => {
    setIsSurprising(true)
    try {
      const res = await api.post<{ success: boolean; prompt: string }>(
        '/api/v1/video-generation/surprise',
        { mode },
        { requireAuth: true },
      )
      if (res.prompt) typeOut(res.prompt)
    } catch (error) {
      toast.error("Couldn't dream one up", { description: getApiErrorMessage(error, "Please try again.") })
    } finally {
      setIsSurprising(false)
    }
  }

  const cancelGeneration = async () => {
    if (!jobId) return
    try {
      await api.post(`/api/v1/video-generation/cancel/${jobId}`, {}, { requireAuth: true })
      toast.success("Generation cancelled")
    } catch (error) {
      toast.error("Couldn't cancel", { description: getApiErrorMessage(error, "It may have already finished.") })
    } finally {
      // Close the SSE + reset UI regardless; the worker/DB reflects the final state.
      setIsGenerating(false)
      setJobId(null)
      fetchPastJobs()
    }
  }

  const handleGenerate = async () => {
    if (prompt.trim().length < 3) {
      toast.error("Prompt must be at least 3 characters")
      return
    }
    const { min, max } = requiredImageRange(mode)
    if (images.length < min) {
      toast.error(
        mode === "image_to_video"
          ? "Add a source image for image-to-video."
          : "Add at least one reference image.",
      )
      return
    }

    setIsGenerating(true)
    setVideoUrl(null)
    setVideoJobId(null)

    try {
      const imagePayload =
        max > 0 && images.length ? await Promise.all(images.slice(0, max).map(fileToImageInput)) : []

      const response = await api.post<GenerateResponse>(
        '/api/v1/video-generation/generate',
        { prompt: prompt.trim(), mode, aspectRatio, durationSeconds, images: imagePayload },
        { requireAuth: true },
      )
      setJobId(response.jobId)
      setVideoJobId(response.videoJobId)
      toast.success("Generation started!")
    } catch (error) {
      toast.error("Generation Failed", { description: getApiErrorMessage(error, "Failed to start generation.") })
      setIsGenerating(false)
      setJobId(null)
    }
  }

  return {
    prompt, setPrompt,
    mode, setMode: changeMode,
    aspectRatio, setAspectRatio,
    durationSeconds, setDurationSeconds,
    images, setImages,
    isGenerating, isSurprising, isTyping,
    progress: sse.progress, statusMessage: sse.statusMessage,
    videoUrl, videoJobId,
    pastJobs, isLoadingJobs, fetchPastJobs,
    surpriseMe, handleGenerate, cancelGeneration,
  }
}
