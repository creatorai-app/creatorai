"use client"

import { useState, useEffect } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { DashboardHome } from "@/components/dashboard/main/DashboardHome";
import { DashboardSkeleton } from "@/components/dashboard/main/skeleton/DashboardSkeleton";
import { connectYoutubeChannel, isGoogleProvider } from "@/lib/connectYT";
import { toast } from "sonner";
import { GmailPromptDialog } from "@/components/dashboard/gmail-prompt-dialog";
import { getScripts, type Script } from "@/lib/api/getScripts";
import { getThumbnails, type ThumbnailJob } from "@/lib/api/getThumbnails";
import { getDubbings, type DubbingProject } from "@/lib/api/getDubbings";
import { api } from "@/lib/api-client";
import type { IdeationJob, SubtitleResponse } from "@repo/validation"

export interface DashboardData {
  scripts: Script[];
  thumbnails: ThumbnailJob[];
  dubbings: DubbingProject[];
  ideations: IdeationJob[];
  subtitles: SubtitleResponse[];
}

export default function Dashboard() {
  const { supabase, user, profile, fetchUserProfile } = useSupabase()

  const [data, setData] = useState<DashboardData>({
    scripts: [], thumbnails: [], dubbings: [], ideations: [], subtitles: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isConnectingYoutube, setIsConnectingYoutube] = useState(false)
  const [isDisconnectingYoutube, setIsDisconnectingYoutube] = useState(false)
  const [showGmailDialog, setShowGmailDialog] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true)
      try {
        const [scripts, thumbnails, dubbings, ideationRes, subtitles] = await Promise.allSettled([
          getScripts(),
          getThumbnails(),
          getDubbings(),
          api.get<{ data: IdeationJob[] }>("/api/v1/ideation?limit=50", { requireAuth: true }),
          api.get<SubtitleResponse[]>("/api/v1/subtitle", { requireAuth: true }),
        ])

        setData({
          scripts: scripts.status === "fulfilled" ? scripts.value : [],
          thumbnails: thumbnails.status === "fulfilled" ? thumbnails.value : [],
          dubbings: dubbings.status === "fulfilled" ? dubbings.value : [],
          ideations: ideationRes.status === "fulfilled" ? (ideationRes.value?.data ?? []) : [],
          subtitles: subtitles.status === "fulfilled" ? (subtitles.value ?? []) : [],
        })
      } catch {
        toast.error("Failed to load dashboard data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchAll()
  }, [])

  const handleConnectYoutube = () => {
    if (!user) return
    if (!isGoogleProvider(user)) {
      setShowGmailDialog(true)
      return
    }
    connectYoutubeChannel({ supabase, user, setIsConnectingYoutube })
  }

  const handleGmailSubmit = (gmail: string) => {
    setShowGmailDialog(false)
    connectYoutubeChannel({ supabase, user, setIsConnectingYoutube, loginHint: gmail })
  }

  const handleDisconnectYoutube = async () => {
    if (!user || !supabase) return
    setIsDisconnectingYoutube(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ ai_trained: false, youtube_connected: false })
        .eq("user_id", user.id)
        .single()

      if (error) throw error
      toast.success("YouTube channel disconnected successfully.")
      await fetchUserProfile(user.id)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to disconnect YouTube channel."
      toast.error(message)
    } finally {
      setIsDisconnectingYoutube(false)
    }
  }

  if (!profile || isLoading) {
    return (
      <div className="container py-8">
        <DashboardSkeleton />
      </div>
    )
  }

  return (
    <div className="container py-8">
      <DashboardHome
        profile={profile}
        data={data}
        connectYoutubeChannel={handleConnectYoutube}
        connectingYoutube={isConnectingYoutube}
        disconnectYoutubeChannel={handleDisconnectYoutube}
        disconnectingYoutube={isDisconnectingYoutube}
      />

      <GmailPromptDialog
        open={showGmailDialog}
        onOpenChange={setShowGmailDialog}
        onSubmit={handleGmailSubmit}
        isLoading={isConnectingYoutube}
      />
    </div>
  )
}
