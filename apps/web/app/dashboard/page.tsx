"use client"

import { useState, useEffect } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { DashboardHome } from "@/components/dashboard/main/DashboardHome";
import { DashboardSkeleton } from "@/components/dashboard/main/skeleton/DashboardSkeleton";
import { connectYoutubeChannel, isGoogleProvider } from "@/lib/connectYT";
import { toast } from "sonner";
import { GmailPromptDialog } from "@/components/dashboard/gmail-prompt-dialog";
import type { Script } from "@/lib/api/getScripts";
import type { ThumbnailJob } from "@/lib/api/getThumbnails";
import type { DubbingProject } from "@/lib/api/getDubbings";
import { api } from "@/lib/api-client";
import type { IdeationJob, SubtitleResponse } from "@repo/validation"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@repo/ui/alert-dialog";

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
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true)

      // Called directly rather than through the toasting helpers in lib/api: on this
      // page five lists load at once, so one backend hiccup used to stack a separate
      // toast per feature. Empty lists are the normal result for a new account.
      const [scripts, thumbnails, dubbings, ideationRes, subtitles] = await Promise.allSettled([
        api.get<Script[]>("/api/v1/script", { requireAuth: true }),
        api.get<ThumbnailJob[]>("/api/v1/thumbnail", { requireAuth: true }),
        api.get<DubbingProject[]>("/api/v1/dubbing", { requireAuth: true }),
        api.get<{ data: IdeationJob[] }>("/api/v1/ideation?limit=50", { requireAuth: true }),
        api.get<SubtitleResponse[]>("/api/v1/subtitle", { requireAuth: true }),
      ])

      setData({
        scripts: scripts.status === "fulfilled" ? (scripts.value ?? []) : [],
        thumbnails: thumbnails.status === "fulfilled" ? (thumbnails.value ?? []) : [],
        dubbings: dubbings.status === "fulfilled" ? (dubbings.value ?? []) : [],
        ideations: ideationRes.status === "fulfilled" ? (ideationRes.value?.data ?? []) : [],
        subtitles: subtitles.status === "fulfilled" ? (subtitles.value ?? []) : [],
      })

      if ([scripts, thumbnails, dubbings, ideationRes, subtitles].some((r) => r.status === "rejected")) {
        toast.error("Some dashboard data failed to load")
      }
      setIsLoading(false)
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
      // The style profile is derived entirely from the connected channel, so it goes
      // with it. Generated content (scripts, thumbnails, subtitles, dubs) is the
      // user's work and is deliberately left alone.
      const { error: styleError } = await supabase
        .from("user_style")
        .delete()
        .eq("user_id", user.id)

      if (styleError) throw styleError

      const { error } = await supabase
        .from("profiles")
        .update({ ai_trained: false, youtube_connected: false })
        .eq("user_id", user.id)
        .single()

      if (error) throw error
      setShowDisconnectDialog(false)
      toast.success("YouTube channel disconnected. Your trained style data has been deleted.")
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
        disconnectYoutubeChannel={() => setShowDisconnectDialog(true)}
        disconnectingYoutube={isDisconnectingYoutube}
      />

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect your YouTube channel?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  Disconnecting also deletes the AI style profile we trained on your channel —
                  your tone, pacing, humour, structure and the video analysis behind them.
                  This cannot be undone.
                </p>
                <p>
                  Everything you have already created stays safe: your scripts, thumbnails,
                  subtitles, dubs and ideas are untouched.
                </p>
                <p>
                  To get personalised results again you would need to reconnect and train
                  from scratch
                  {profile?.free_training_used
                    ? ", which costs credits — the free first training has already been used."
                    : "."}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnectingYoutube}>Keep my channel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDisconnectYoutube() }}
              disabled={isDisconnectingYoutube}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDisconnectingYoutube ? "Disconnecting..." : "Disconnect and delete style data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GmailPromptDialog
        open={showGmailDialog}
        onOpenChange={setShowGmailDialog}
        onSubmit={handleGmailSubmit}
        isLoading={isConnectingYoutube}
      />
    </div>
  )
}
