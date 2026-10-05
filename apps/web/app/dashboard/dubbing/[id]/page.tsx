"use client"

import { useState, useEffect, useCallback } from "react";
import * as motion from "motion/react-m";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Label } from "@repo/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/tooltip";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Trash2, CheckCircle2, Languages, Video, Music,
  XCircle, Coins, CalendarDays, Play, Cpu, Users, Mic, Activity, type LucideIcon,
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
import { getDubbing, deleteDubbing } from "@/lib/api/getDubbings";
import { DubResponse, DubStatus, DUB_JOB_STATUSES, dubEngineLabel, dubLanguageLabel } from "@repo/validation";
import { DubbingMediaPlayer } from "@/components/dashboard/dubbing/DubbingMediaPlayer"
import { DubOutputsList } from "@/components/dashboard/dubbing/DubOutputsList"

const STATUS_LABELS: Record<DubStatus, string> = {
  uploading: "Upload unfinished",
  queued: "Queued",
  processing: "Processing",
  cloning: "Dubbing",
  awaiting_video: "Waiting for video",
  completed: "Completed",
  failed: "Failed",
}

/** Glassy stat card, mirroring the main dashboard's Quick Actions card design. */
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

/**
 * A dub's details, status and finished media. Running, resuming and finishing a dub all
 * happen on the generation page, which this hands off to.
 */
export default function DubbingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { session } = useSupabase()
  const projectId = params.id as string

  const [dubbing, setDubbing] = useState<DubResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  const refresh = useCallback(async () => {
    const fresh = await getDubbing(projectId, session?.access_token)
    if (fresh) setDubbing(fresh)
    return fresh
  }, [projectId, session?.access_token])

  useEffect(() => {
    if (!projectId || !session?.access_token) return
    setLoading(true)
    void refresh().then((data) => {
      setLoading(false)
      if (!data) router.push("/dashboard/dubbing")
    })
  }, [projectId, session?.access_token, refresh, router])

  // The status is the point of this page, so it follows a dub that is still moving.
  const status = dubbing?.status
  useEffect(() => {
    if (!status || status === "completed" || status === "failed") return
    const iv = setInterval(refresh, 5000)
    return () => clearInterval(iv)
  }, [status, refresh])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      if (!(await deleteDubbing(projectId, session?.access_token))) throw new Error("Failed to delete dubbing.")
      toast.success("Dubbing deleted!", { description: "The dubbed media has been successfully deleted." })
      router.push("/dashboard/dubbing")
    } catch (error: any) {
      toast.error("Error deleting dubbing", { description: error.message || "Failed to delete dubbing." })
    } finally {
      setIsDeleting(false)
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

  const languageLabel = dubbing.outputs.map((o) => dubLanguageLabel(o.language)).join(", ")
  const isCompleted = dubbing.status === "completed"
  const isFailed = dubbing.status === "failed"
  const isRunning = !isCompleted && !isFailed
  const finished = dubbing.outputs.filter((o) => o.status === "completed")

  const StatusIcon = isCompleted ? CheckCircle2 : isFailed ? XCircle : Loader2
  const statusColor = isCompleted
    ? "text-green-600 dark:text-green-400"
    : isFailed
      ? "text-red-500"
      : "text-purple-600 dark:text-purple-400"

  const description = isCompleted
    ? `Dubbed into ${languageLabel}.`
    : isFailed
      ? finished.length
        ? "Some languages did not finish. Only the finished ones were charged. Retry to continue the rest from where they stopped."
        : "This dubbing did not finish, so nothing was charged. Retry to continue from where it stopped."
      : dubbing.status === "uploading"
        ? "The upload stopped before dubbing could start. Nothing has been charged."
        : dubbing.status === "awaiting_video"
          ? "The dubbed audio is ready. The dub finishes once the video upload does."
          : "Your dubbing is in progress. This page updates automatically."

  const createdLabel = new Date(dubbing.createdAt).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })

  return (
    <div className="container py-8">
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Details</h1>
      </div>

      <motion.div className="space-y-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <section aria-label="Details">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard icon={dubbing.isVideo ? Video : Music} label="Media Type" value={dubbing.isVideo ? "Video" : "Audio"} />
            {dubbing.engine && <StatCard icon={Cpu} label="Engine" value={dubEngineLabel(dubbing.engine)} />}
            <StatCard icon={Languages} label={dubbing.outputs.length > 1 ? "Languages" : "Target Language"} value={languageLabel} />
            {dubbing.speakerCount ? <StatCard icon={Users} label="Speakers" value={`${dubbing.speakerCount}`} /> : null}
            {dubbing.sourceLanguage ? <StatCard icon={Mic} label="Spoken language" value={dubLanguageLabel(dubbing.sourceLanguage)} /> : null}
            <StatCard icon={StatusIcon} label="Status" value={STATUS_LABELS[dubbing.status] ?? dubbing.status} iconClassName={`${statusColor} ${isRunning ? "[&>svg]:animate-spin" : ""}`} />
            <StatCard icon={Coins} label="Credits Used" value={dubbing.creditsConsumed ? `${dubbing.creditsConsumed}` : "0"} />
            <StatCard icon={CalendarDays} label="Created" value={createdLabel} />
          </div>
        </section>

        <section aria-label="Status and media">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <StatusIcon className={`h-5 w-5 shrink-0 ${statusColor} ${isRunning ? "animate-spin" : ""}`} />
                  <span className="truncate">{dubbing.mediaName || STATUS_LABELS[dubbing.status]}</span>
                </CardTitle>
                <CardDescription className="mt-1.5">{description}</CardDescription>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isFailed && (
                  <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
                    <Link href={`/dashboard/dubbing/new?dub=${projectId}&retry=1`}>
                      <Play className="mr-2 h-4 w-4" /> Retry
                    </Link>
                  </Button>
                )}
                {isRunning && (
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/dubbing/new?dub=${projectId}`}>
                      <Activity className="mr-2 h-4 w-4" /> View progress
                    </Link>
                  </Button>
                )}

                {/* A dub with a job running can't be deleted (the API refuses it too). */}
                {!DUB_JOB_STATUSES.includes(dubbing.status) && (
                  <AlertDialog>
                    <TooltipProvider delayDuration={0}>
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
                    </TooltipProvider>
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
                )}
              </div>
            </CardHeader>

            {/* The API hands out media only for finished languages; the rest show their state. */}
            {dubbing.status !== "uploading" && (
              <CardContent className="space-y-8">
                {dubbing.originalMediaUrl && finished.length > 0 && (
                  <div className="space-y-3">
                    <Label>Original Media</Label>
                    <DubbingMediaPlayer url={dubbing.originalMediaUrl} isVideo={dubbing.isVideo} title="Original media" />
                  </div>
                )}
                <DubOutputsList outputs={dubbing.outputs} isVideo={dubbing.isVideo} mediaName={dubbing.mediaName} />
              </CardContent>
            )}
          </Card>
        </section>
      </motion.div>
    </div>
  )
}
