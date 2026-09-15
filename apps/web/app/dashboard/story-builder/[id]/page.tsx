"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@repo/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card"
import { Badge } from "@repo/ui/badge"
import { toast } from "sonner"
import {
    ArrowLeft, Trash2, RefreshCw, Plus, Loader2,
    Film, Clock, Clapperboard, Users, GraduationCap, Palette, ImageIcon, Coins,
} from "lucide-react"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter,
} from "@repo/ui/alert-dialog"
import { StoryBuilderResults } from "@/components/dashboard/story-builder/StoryBuilderResults"
import { ScriptLoaderSkeleton } from "@/components/dashboard/scripts/skeleton/scriptLoaderSkeleton"
import { api } from "@/lib/api-client"
import {
    CONTENT_TYPE_LABELS,
    VIDEO_DURATION_LABELS,
    STORY_MODE_LABELS,
    AUDIENCE_LEVEL_LABELS,
} from "@repo/validation"
import type { StoryBuilderJob } from "@/hooks/useStoryBuilder"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    queued: { label: "Queued", variant: "outline" },
    processing: { label: "Processing", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
}

export default function StoryBuilderDetailPage() {
    const router = useRouter()
    const params = useParams()
    const [job, setJob] = useState<StoryBuilderJob | null>(null)
    const [loading, setLoading] = useState(false)
    const [isLoadingJob, setIsLoadingJob] = useState(true)

    const jobId = params.id as string

    useEffect(() => {
        const fetchJob = async () => {
            if (!jobId) return
            setIsLoadingJob(true)
            try {
                const data = await api.get<StoryBuilderJob>(`/api/v1/story-builder/${jobId}`, { requireAuth: true })
                setJob(data)
            } catch (error: unknown) {
                toast.error("Error loading blueprint", {
                    description: error instanceof Error ? error.message : "Failed to fetch blueprint details.",
                })
                router.push("/dashboard/story-builder")
            } finally {
                setIsLoadingJob(false)
            }
        }
        fetchJob()
    }, [jobId, router])

    const handleDelete = async () => {
        setLoading(true)
        try {
            await api.delete(`/api/v1/story-builder/${jobId}`, { requireAuth: true })
            toast.success("Blueprint deleted!")
            router.push("/dashboard/story-builder")
        } catch (error: unknown) {
            toast.error("Error deleting blueprint", {
                description: error instanceof Error ? error.message : "Failed to delete.",
            })
        } finally {
            setLoading(false)
        }
    }

    if (isLoadingJob) return <ScriptLoaderSkeleton />
    if (!job) return null

    const config = statusConfig[job.status] ?? { label: "Unknown", variant: "outline" as const }

    return (
        <div className="container py-8">
            <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Blueprint Details</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">View your story blueprint</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => router.push("/dashboard/story-builder")}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 shadow-sm hover:bg-muted hover:text-foreground transition"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Blueprints
                </Button>
            </div>

            <div className="space-y-6">
                {/* Details Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="space-y-1 min-w-0">
                                <CardTitle className="line-clamp-2">{job.video_topic}</CardTitle>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Generated on {new Date(job.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <Link href={`/dashboard/thumbnails/new?storyBuilderId=${jobId}&title=${encodeURIComponent(job.video_topic || "")}`}>
                                    <Button variant="outline" size="sm" className="gap-1.5">
                                        <ImageIcon className="h-3.5 w-3.5" />
                                        Thumbnail
                                    </Button>
                                </Link>
                                <Link href="/dashboard/story-builder/new">
                                    <Button variant="outline" size="sm" className="gap-1.5">
                                        <Plus className="h-3.5 w-3.5" />
                                        New Blueprint
                                    </Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => router.push("/dashboard/story-builder/new")}
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Regenerate
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30 hover:border-red-500/50"
                                            disabled={loading}
                                        >
                                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                            Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete this story blueprint. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                            <li className="flex items-start gap-3">
                                <Film className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                <div className="text-sm">
                                    <strong className="font-medium text-slate-800 dark:text-slate-200">Content Type:</strong>{" "}
                                    <span className="text-slate-700 dark:text-slate-300">{CONTENT_TYPE_LABELS[job.content_type] || job.content_type}</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <Clapperboard className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                <div className="text-sm">
                                    <strong className="font-medium text-slate-800 dark:text-slate-200">Story Mode:</strong>{" "}
                                    <span className="text-slate-700 dark:text-slate-300">{STORY_MODE_LABELS[job.story_mode] || job.story_mode}</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <Clock className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                <div className="text-sm">
                                    <strong className="font-medium text-slate-800 dark:text-slate-200">Duration:</strong>{" "}
                                    <span className="text-slate-700 dark:text-slate-300">{VIDEO_DURATION_LABELS[job.video_duration]}</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <GraduationCap className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                <div className="text-sm">
                                    <strong className="font-medium text-slate-800 dark:text-slate-200">Audience Level:</strong>{" "}
                                    <span className="text-slate-700 dark:text-slate-300">{AUDIENCE_LEVEL_LABELS[job.audience_level] || job.audience_level}</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <Badge variant={config.variant} className="mt-0.5 shrink-0">{config.label}</Badge>
                                <div className="text-sm">
                                    <strong className="font-medium text-slate-800 dark:text-slate-200">Status</strong>
                                </div>
                            </li>
                            {job.credits_consumed > 0 && (
                                <li className="flex items-start gap-3">
                                    <Coins className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                    <div className="text-sm">
                                        <strong className="font-medium text-slate-800 dark:text-slate-200">Credits:</strong>{" "}
                                        <span className="text-slate-700 dark:text-slate-300">
                                            {job.credits_consumed} credit{job.credits_consumed > 1 ? "s" : ""}
                                        </span>
                                    </div>
                                </li>
                            )}
                            {job.target_audience && (
                                <li className="flex items-start gap-3">
                                    <Users className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                    <div className="text-sm">
                                        <strong className="font-medium text-slate-800 dark:text-slate-200">Target Audience:</strong>{" "}
                                        <span className="text-slate-700 dark:text-slate-300">{job.target_audience}</span>
                                    </div>
                                </li>
                            )}
                            {job.tone && (
                                <li className="flex items-start gap-3">
                                    <Palette className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                    <div className="text-sm">
                                        <strong className="font-medium text-slate-800 dark:text-slate-200">Tone:</strong>{" "}
                                        <span className="text-slate-700 dark:text-slate-300">{job.tone}</span>
                                    </div>
                                </li>
                            )}
                        </ul>
                    </CardContent>
                </Card>

                {/* Blueprint Results */}
                {job.result && (
                    <StoryBuilderResults
                        result={job.result}
                        onRegenerate={() => router.push("/dashboard/story-builder/new")}
                        isGenerating={false}
                    />
                )}
            </div>
        </div>
    )
}
