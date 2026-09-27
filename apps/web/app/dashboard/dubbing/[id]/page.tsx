"use client"

import { useState, useEffect, useCallback } from "react";
import * as motion from "motion/react-m";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Label } from "@repo/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/tooltip";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Trash2, CheckCircle2, Languages, Video, Music,
  XCircle, RotateCw, Coins, CalendarDays, Play, Cpu, Users, Mic, type LucideIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogFooter,
} from "@repo/ui/alert-dialog";
import { useSupabase } from "@/components/supabase-provider";
import { getDubbing, deleteDubbing, regenerateDubbing, resumeDubbing } from "@/lib/api/getDubbings";
import { DubResponse, DubStatus, dubEngineLabel, supportedLanguages } from "@repo/validation";
import { DubbingMediaPlayer } from "@/components/dashboard/dubbing/DubbingMediaPlayer"
import { DubbingResumeUpload } from "@/components/dashboard/dubbing/DubbingResumeUpload"
import { DubOutputsList } from "@/components/dashboard/dubbing/DubOutputsList"

const STATUS_LABELS: Record<DubStatus, string> = {
  uploading: "Uploading",
  queued: "Queued",
  processing: "Processing",
  cloning: "Dubbing",
  awaiting_video: "Waiting for video",
  completed: "Completed",
  failed: "Failed",
}

// A worker (or a pending upload elsewhere) will move these on by itself.
const POLLED_STATUSES: DubStatus[] = ["queued", "processing", "cloning", "awaiting_video"]

function getLanguageLabel(code: string): string {
  return supportedLanguages.find((l) => l.value === code)?.label ?? code
}

/** Glassy stat card — mirrors the main dashboard's Quick Actions card design. */
function StatCard({ icon: Icon, label, value, iconClassName }: {
  icon: LucideIcon
  label: string
  value: string
  iconClassName?: string
}) {
  return (
    <div className="group bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-slate-800/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-2 sm:gap-4 hover:shadow-[0_8px_30px_rgba(168,85,247,0.12)] hover:-translate-y-1 hover:border-purple-500/50 transition-all duration-300">
      <div className={`w-10 h-10 rounded-lg bg-slate-100/80 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:bg-purple-500/10 transition-all duration-300 group-hover:scale-110 shrink-0 ${iconClassName ?? ""}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="font-semibold text-slate-900 dark:text-slate-50">{value}</p>
      </div>
    </div>
  )
}

export default function DubbingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { session } = useSupabase()
  const projectId = params.id as string

  const [dubbing, setDubbing] = useState<DubResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isResuming, setIsResuming] = useState(false)

  useEffect(() => {
    const fetchDubbing = async () => {
      if (!projectId || !session?.access_token) return

      setLoading(true)
      try {
        const data = await getDubbing(projectId, session.access_token)
        if (!data) {
          toast.error("Dubbing not found")
          router.push("/dashboard/dubbing")
          return
        }
        setDubbing(data);
      } catch (error: any) {
        toast.error("Error loading dubbing", {
          description: error.message || "Failed to fetch dubbing details.",
        })
        router.push("/dashboard/dubbing")
      } finally {
        setLoading(false)
      }
    }

    fetchDubbing()
  }, [projectId, session?.access_token, router])

  const refresh = useCallback(async () => {
    const fresh = await getDubbing(projectId, session?.access_token).catch(() => null)
    if (fresh) setDubbing(fresh)
  }, [projectId, session?.access_token])

  // Poll while a job is in flight; this page has no SSE.
  const status = dubbing?.status
  useEffect(() => {
    if (!session?.access_token || !status || !POLLED_STATUSES.includes(status)) return
    const iv = setInterval(refresh, 4000)
    return () => clearInterval(iv)
  }, [status, session?.access_token, refresh])

  const handleDelete = async () => {
    if (!projectId) return
    setIsDeleting(true)
    try {
      const success = await deleteDubbing(projectId, session?.access_token)
      if (success) {
        toast.success("Dubbing deleted!", { description: "The dubbed media has been successfully deleted." })
        router.push("/dashboard/dubbing")
      } else {
        throw new Error("Failed to delete")
      }
    } catch (error: any) {
      toast.error("Error deleting dubbing", { description: error.message || "Failed to delete dubbing." })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    try {
      await regenerateDubbing(projectId, session?.access_token)
      toast.success("Regeneration started", { description: "Re-dubbing your media with the same settings." })
      const fresh = await getDubbing(projectId, session?.access_token).catch(() => null)
      if (fresh) setDubbing(fresh)
    } catch (error: any) {
      toast.error("Could not regenerate", { description: error?.message || "Please try again." })
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleResume = async () => {
    setIsResuming(true)
    try {
      await resumeDubbing(projectId, session?.access_token)
      toast.success("Retrying", { description: "Picking up from where it stopped." })
      await refresh()
    } catch (error: any) {
      toast.error("Could not retry", { description: error?.message || "Please try again." })
    } finally {
      setIsResuming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }
  if (!dubbing) return null

  const languageLabel = dubbing.outputs.map((o) => getLanguageLabel(o.language)).join(", ")
  // Lifecycle: uploading → queued → processing → cloning → (awaiting_video) → completed | failed
  const isCompleted = dubbing.status === "completed"
  const isFailed = dubbing.status === "failed"
  const isProcessing = !isCompleted && !isFailed
  // The browser's upload stopped: the audio never landed, or the video is still partial.
  const needsUpload = dubbing.status === "uploading" || (!isCompleted && dubbing.videoStatus === "uploading")
  const finishedCount = dubbing.outputs.filter((o) => o.status === "completed").length
  const hasAnyAudio = dubbing.outputs.some((o) => o.dubbedAudioUrl || o.dubbedUrl)
  const deliveredButUnmuxed = dubbing.outputs.some((o) => o.status === "failed" && o.dubbedAudioUrl)

  const StatusIcon = isCompleted ? CheckCircle2 : isFailed ? XCircle : Loader2
  const statusColor = isCompleted
    ? "text-green-600 dark:text-green-400"
    : isFailed
      ? "text-red-500"
      : "text-purple-600 dark:text-purple-400"

  const createdLabel = new Date(dubbing.createdAt).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })

  return (
    <div className="container py-8">
      {/* Header — icon-only back button on the left */}
      <div className="mb-8 flex items-center gap-4">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => router.push("/dashboard/dubbing")} className="shrink-0" aria-label="Back to Dubbings">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to Dubbings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Details</h1>
        </div>
      </div>

      <motion.div className="space-y-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        {/* 1. Details — glassy quick-action-style cards, full width */}
        <section aria-label="Details">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard icon={dubbing.isVideo ? Video : Music} label="Media Type" value={dubbing.isVideo ? "Video" : "Audio"} />
            {dubbing.engine && <StatCard icon={Cpu} label="Engine" value={dubEngineLabel(dubbing.engine)} />}
            <StatCard icon={Languages} label={dubbing.outputs.length > 1 ? "Languages" : "Target Language"} value={languageLabel} />
            {dubbing.speakerCount ? <StatCard icon={Users} label="Speakers" value={`${dubbing.speakerCount}`} /> : null}
            {dubbing.sourceLanguage ? <StatCard icon={Mic} label="Spoken language" value={getLanguageLabel(dubbing.sourceLanguage)} /> : null}
            <StatCard icon={StatusIcon} label="Status" value={STATUS_LABELS[dubbing.status] ?? dubbing.status} iconClassName={`${statusColor} ${isProcessing ? "[&>svg]:animate-spin" : ""}`} />
            <StatCard icon={Coins} label="Credits Used" value={dubbing.creditsConsumed ? `${dubbing.creditsConsumed}` : "—"} />
            <StatCard icon={CalendarDays} label="Created" value={createdLabel} />
          </div>
        </section>

        {/* 2. Main media section — full width */}
        <section aria-label="Preview">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <StatusIcon className={`h-5 w-5 shrink-0 ${statusColor} ${isProcessing ? "animate-spin" : ""}`} />
                  <span className="truncate">
                    {dubbing.mediaName || (isCompleted ? "Dubbing Complete" : isFailed ? "Dubbing Failed" : "Processing…")}
                  </span>
                </CardTitle>
                <CardDescription className="mt-1.5">
                  {isCompleted
                    ? `Dubbed into ${languageLabel}. Preview and download below.`
                    : isFailed
                      ? deliveredButUnmuxed
                        ? "The dubbed audio is ready, but adding it to the video failed. Retry to finish it at no extra cost."
                        : finishedCount
                          ? "Some languages did not finish and were not charged. Retry to continue them from where they stopped."
                          : "This dubbing did not complete. No credits were charged. Retry to continue from where it stopped."
                      : dubbing.status === "awaiting_video"
                        ? "The dubbed audio is ready. The video is added as soon as its upload finishes."
                        : "Your dubbing is being processed. This page updates automatically."}
                </CardDescription>
              </div>

              {/* Icon toolbar — before the preview */}
              <TooltipProvider delayDuration={0}>
                <div className="flex items-center gap-2 shrink-0">
                  {isFailed && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" onClick={handleResume} disabled={isResuming} className="bg-purple-600 hover:bg-purple-700 text-white" aria-label="Retry from where it stopped">
                          {isResuming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Retry from where it stopped</TooltipContent>
                    </Tooltip>
                  )}

                  {!isProcessing && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleRegenerate} disabled={isRegenerating} aria-label="Regenerate">
                          {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Regenerate with same input</TooltipContent>
                    </Tooltip>
                  )}

                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" disabled={isDeleting} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30 hover:border-red-500/50" aria-label="Delete dubbing">
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Delete dubbing</TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete this dubbed media.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TooltipProvider>
            </CardHeader>

            <CardContent className="space-y-8">
              {needsUpload && <DubbingResumeUpload projectId={projectId} onProgressed={refresh} />}

              {dubbing.originalMediaUrl && hasAnyAudio && (
                <div className="space-y-3">
                  <Label>Original Media</Label>
                  <DubbingMediaPlayer url={dubbing.originalMediaUrl} isVideo={dubbing.isVideo} title="Original media" />
                </div>
              )}

              {(!needsUpload || hasAnyAudio) && (
                <DubOutputsList outputs={dubbing.outputs} isVideo={dubbing.isVideo} mediaName={dubbing.mediaName} />
              )}
            </CardContent>
          </Card>
        </section>
      </motion.div>
    </div>
  )
}
