"use client"

import { useState, useEffect, useCallback } from "react";
import * as motion from "motion/react-m";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@repo/ui/button";
import { Label } from "@repo/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Trash2, CheckCircle2, Languages, Video, Music, RefreshCw,
  XCircle, Coins, CalendarDays, Play, Cpu, Users, Mic, Activity, Plus, type LucideIcon,
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
import { getDubbingGroup, deleteDubbing } from "@/lib/api/getDubbings";
import { DubResponse, DubStatus, DUB_JOB_STATUSES, DUB_OUTPUT_FORMAT_INFO, dubEngineLabel, dubLanguageLabel, dubOutputFormatOf } from "@repo/validation";
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

const isSettled = (dub: DubResponse) => dub.status === "completed" || dub.status === "failed"
const languagesOf = (dub: DubResponse) => dub.outputs.map((o) => dubLanguageLabel(o.language)).join(", ")

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

/** Delete behind a confirmation. `what` is what goes, in the dialog's words. */
function DeleteButton({ label, what, busy, disabled, onConfirm }: {
  label: string
  what: string
  busy: boolean
  disabled?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" disabled={busy || disabled} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30 hover:border-red-500/50" aria-label={label}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone. {what}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * One media and every dub of it: the original beside the dub picked (stacked on smaller
 * screens), its status and details. Running, resuming and finishing a dub all happen on
 * the generation page, which this hands off to, as does dubbing the media again.
 */
export default function DubbingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { session } = useSupabase()
  const projectId = params.id as string

  // The original first, then each dub regenerated from it.
  const [dubs, setDubs] = useState<DubResponse[] | null>(null)
  const [selectedId, setSelectedId] = useState(projectId)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const fresh = await getDubbingGroup(projectId, session?.access_token)
    if (fresh) setDubs(fresh)
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

  // The status is the point of this page, so it follows any dub that is still moving.
  const moving = !!dubs?.some((d) => !isSettled(d))
  useEffect(() => {
    if (!moving) return
    const iv = setInterval(refresh, 5000)
    return () => clearInterval(iv)
  }, [moving, refresh])

  const handleDelete = async (target: DubResponse, isOriginal: boolean) => {
    setDeleting(target.projectId)
    try {
      if (!(await deleteDubbing(target.projectId, session?.access_token))) throw new Error("Failed to delete dubbing.")
      toast.success("Dubbing deleted!", {
        description: isOriginal ? "The media and every dub of it have been deleted." : "The dub has been deleted.",
      })
      if (isOriginal) {
        router.push("/dashboard/dubbing")
      } else {
        setDubs((current) => current?.filter((d) => d.projectId !== target.projectId) ?? null)
        setSelectedId(dubs?.[0]?.projectId ?? projectId)
      }
    } catch (error: any) {
      toast.error("Error deleting dubbing", { description: error.message || "Failed to delete dubbing." })
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }
  if (!dubs?.length) return null

  const original = dubs[0]!
  const dub = dubs.find((d) => d.projectId === selectedId) ?? dubs[dubs.length - 1]!
  const isOriginal = dub.projectId === original.projectId
  const isCompleted = dub.status === "completed"
  const isFailed = dub.status === "failed"
  const isRunning = !isCompleted && !isFailed
  const finished = dub.outputs.filter((o) => o.status === "completed")
  const anyRunning = dubs.some((d) => DUB_JOB_STATUSES.includes(d.status))

  const StatusIcon = isCompleted ? CheckCircle2 : isFailed ? XCircle : Loader2
  const statusColor = isCompleted
    ? "text-green-600 dark:text-green-400"
    : isFailed
      ? "text-red-500"
      : "text-purple-600 dark:text-purple-400"

  const description = isCompleted
    ? `Dubbed into ${languagesOf(dub)}.`
    : isFailed
      ? finished.length
        ? "Some languages did not finish. Only the finished ones were charged. Retry to continue the rest from where they stopped."
        : "This dubbing did not finish, so nothing was charged. Retry to continue from where it stopped."
      : dub.status === "uploading"
        ? "The upload stopped before dubbing could start. Nothing has been charged."
        : dub.status === "awaiting_video"
          ? "The dubbed audio is ready. The dub finishes once the video upload does."
          : "Your dubbing is in progress. This page updates automatically."

  const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
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
          <h1 className="truncate text-2xl sm:text-3xl font-bold tracking-tight">{original.mediaName || "Details"}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* The media must be fully uploaded before it can be dubbed again. */}
          {original.status !== "uploading" && (
            <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
              <Link href={`/dashboard/dubbing/new?from=${original.projectId}`}>
                <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/dashboard/dubbing/new">
              <Plus className="mr-2 h-4 w-4" /> Dub another file
            </Link>
          </Button>
          {/* A dub with a job running can't be deleted (the API refuses it too). */}
          <DeleteButton
            label={dubs.length > 1 ? "Delete media and all its dubs" : "Delete dubbing"}
            what={dubs.length > 1
              ? `This will permanently delete this media and all ${dubs.length} dubs of it.`
              : "This will permanently delete this dubbed media."}
            busy={deleting === original.projectId}
            disabled={anyRunning}
            onConfirm={() => handleDelete(original, true)}
          />
        </div>
      </div>

      <motion.div className="space-y-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        {dubs.length > 1 && (
          <section aria-label="Dubs of this media">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-3">Dubs</h2>
            <div role="tablist" aria-label="Dubs" className="flex gap-2 overflow-x-auto pb-1">
              {dubs.map((d, i) => {
                const active = d.projectId === dub.projectId
                return (
                  <button
                    key={d.projectId}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedId(d.projectId)}
                    className={cn(
                      "shrink-0 rounded-xl border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-purple-500 bg-purple-50/70 ring-1 ring-purple-500 dark:bg-purple-900/20"
                        : "border-slate-200 bg-white hover:border-purple-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-purple-700",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Dub {i + 1}
                      {d.status === "failed" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                      {!isSettled(d) && <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {[d.engine && dubEngineLabel(d.engine), languagesOf(d)].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <section aria-label="Status and media" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                <StatusIcon className={`h-5 w-5 shrink-0 ${statusColor} ${isRunning ? "animate-spin" : ""}`} />
                <span className="truncate">{languagesOf(dub) || STATUS_LABELS[dub.status]}</span>
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isFailed && (
                <Button asChild variant="outline">
                  <Link href={`/dashboard/dubbing/new?dub=${dub.projectId}&retry=1`}>
                    <Play className="mr-2 h-4 w-4" /> Retry
                  </Link>
                </Button>
              )}
              {isRunning && (
                <Button asChild variant="outline">
                  <Link href={`/dashboard/dubbing/new?dub=${dub.projectId}`}>
                    <Activity className="mr-2 h-4 w-4" /> View progress
                  </Link>
                </Button>
              )}
              {/* The original's own dub goes only with the media (the delete above). */}
              {!isOriginal && (
                <DeleteButton
                  label="Delete this dub"
                  what="This will permanently delete this dub. The original media and its other dubs stay."
                  busy={deleting === dub.projectId}
                  disabled={DUB_JOB_STATUSES.includes(dub.status)}
                  onConfirm={() => handleDelete(dub, false)}
                />
              )}
            </div>
          </div>

          {/* The API hands out media only for finished languages; the rest show their state. */}
          {dub.status !== "uploading" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
              <div className="space-y-3 lg:sticky lg:top-6">
                <Label>Original</Label>
                {original.originalMediaUrl ? (
                  <DubbingMediaPlayer url={original.originalMediaUrl} isVideo={original.sourceHasVideo} title="Original media" />
                ) : (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    The original shows here once its upload finishes.
                  </p>
                )}
              </div>
              <div className="space-y-3">
                <Label>Dubbed</Label>
                <DubOutputsList projectId={dub.projectId} outputs={dub.outputs} isVideo={dub.isVideo} mediaName={dub.mediaName} />
              </div>
            </div>
          )}
        </section>

        <section aria-label="Details">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard icon={dub.isVideo ? Video : Music} label="Output" value={DUB_OUTPUT_FORMAT_INFO[dubOutputFormatOf(dub)].label} />
            {dub.engine && <StatCard icon={Cpu} label="Engine" value={dubEngineLabel(dub.engine)} />}
            <StatCard icon={Languages} label={dub.outputs.length > 1 ? "Languages" : "Target Language"} value={languagesOf(dub)} />
            {dub.speakerCount ? <StatCard icon={Users} label="Speakers" value={`${dub.speakerCount}`} /> : null}
            {dub.sourceLanguage ? <StatCard icon={Mic} label="Spoken language" value={dubLanguageLabel(dub.sourceLanguage)} /> : null}
            <StatCard icon={StatusIcon} label="Status" value={STATUS_LABELS[dub.status] ?? dub.status} iconClassName={`${statusColor} ${isRunning ? "[&>svg]:animate-spin" : ""}`} />
            <StatCard icon={Coins} label="Credits Used" value={dub.creditsConsumed ? `${dub.creditsConsumed}` : "0"} />
            <StatCard icon={CalendarDays} label="Created" value={dateLabel(dub.createdAt)} />
          </div>
        </section>
      </motion.div>
    </div>
  )
}
