"use client"

import { useState, useCallback, useEffect } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { toast } from "sonner";
import { connectYoutubeChannel } from "@/lib/connectYT";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { useSSE } from "./useSSE";
import type { ChannelVideo } from "./useChannelVideos"

interface TrainAiResponse {
  message: string;
  jobId: string;
}

const STATUS_MESSAGES = (p: number, state: string): string => {
  if (state === "waiting" && p === 0) return "Preparing your training job..."
  if (p > 0 && p < 30) return "Analyzing your videos..."
  if (p >= 30 && p < 70) return "Processing content and training model..."
  if (p >= 70 && p < 100) return "Finalizing your model..."
  return "Processing..."
}

export function useAITraining() {
  const { profile, user, session, supabase, profileLoading: pageLoading, fetchUserProfile } = useSupabase()

  const [selectedVideos, setSelectedVideos] = useState<ChannelVideo[]>([])
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isConnectingYoutube, setIsConnectingYoutube] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [isTraining, setIsTraining] = useState(false)
  const [lastCreditsConsumed, setLastCreditsConsumed] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.id || !profile?.ai_trained || !supabase) return
    supabase
      .from("user_style")
      .select("credits_consumed")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.credits_consumed) setLastCreditsConsumed(data.credits_consumed)
      })
  }, [user?.id, profile?.ai_trained, supabase])

  const sse = useSSE({
    jobId,
    endpoint: "/api/v1/train-ai/status",
    getStatusMessages: STATUS_MESSAGES,
    onComplete: () => {
      toast.success("Model Training Complete!")
      setShowModal(true)
      fetchUserProfile(user?.id || "")
    },
    onFailed: (error) => {
      let errorMessage = error
      try {
        const parsed = JSON.parse(error)
        errorMessage = parsed.error?.message || parsed.message || error
      } catch { }
      toast.error("Training Failed", { description: errorMessage })
    },
    onFinished: () => {
      setIsTraining(false)
      setUploading(false)
      setJobId(null)
    },
  })

  const handleStopTraining = async () => {
    if (!jobId) return
    try {
      await api.post("/api/v1/train-ai/stop/" + jobId, undefined, { requireAuth: true })
      sse.close()
      setIsTraining(false)
      setUploading(false)
      setJobId(null)
      toast.info("Training stopped")
    } catch (error) {
      toast.error("Failed to stop training", {
        description: getApiErrorMessage(error, "Please try again."),
      })
    }
  }

  const handleToggleVideo = useCallback((video: ChannelVideo) => {
    setSelectedVideos((prev) => {
      const exists = prev.find((v) => v.id === video.id)
      if (exists) return prev.filter((v) => v.id !== video.id)
      if (prev.length >= 5) {
        toast.error("Maximum 5 videos allowed")
        return prev
      }
      return [...prev, video]
    })
  }, [])

  const handleStartTraining = async () => {
    if (!profile?.youtube_connected) {
      toast.error("Please connect your YouTube channel first.")
      return
    }
    if (selectedVideos.length < 3) {
      toast.error("Please select at least 3 videos.")
      return
    }

    setUploading(true)
    setIsTraining(true)

    try {
      const videoUrls = selectedVideos.map(
        (v) => `https://www.youtube.com/watch?v=${v.id}`,
      )

      const { jobId } = await api.post<TrainAiResponse>("/api/v1/train-ai", {
        videoUrls,
        isRetraining: profile?.ai_trained ?? false,
      }, {
        requireAuth: true,
      })

      setJobId(jobId)
      toast.success("Training started! Analyzing your videos...")
    } catch (error: unknown) {
      toast.error("Training Failed to Start", {
        description: getApiErrorMessage(error, "Failed to start training."),
      })
      setIsTraining(false)
      setUploading(false)
    }
  }

  const handleConnectYoutube = () => {
    connectYoutubeChannel({ supabase, user, setIsConnectingYoutube })
  }

  return {
    profile,
    pageLoading,
    uploading,
    showModal,
    isConnectingYoutube,
    isTraining,
    progress: sse.progress,
    statusMessage: sse.statusMessage,
    selectedVideos,
    selectedVideoIds: selectedVideos.map((v) => v.id),
    lastCreditsConsumed,
    setShowModal,
    handleToggleVideo,
    handleStartTraining,
    handleStopTraining,
    handleConnectYoutube,
  }
}
