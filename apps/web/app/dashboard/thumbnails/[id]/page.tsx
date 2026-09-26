"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@repo/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card"
import { Badge } from "@repo/ui/badge"
import { toast } from "sonner"
import { downloadFile } from "@/lib/download"
import {
    ArrowLeft, Download, ImageIcon, Clock, Ratio, Sparkles,
    AlertCircle, Trash2, Coins, Link as LinkIcon, Pencil, RefreshCw,
} from "lucide-react"
import { Skeleton } from "@repo/ui/skeleton"
import { getThumbnail, type ThumbnailJob } from "@/lib/api/getThumbnails"
import {
    ViewImageModal,
    EditThumbnailModal,
    DeleteImageModal,
    RegenerateThumbnailModal,
    DeleteBatchModal,
} from "@/components/dashboard/thumbnails/thumbnail-modals"

type ModalState =
    | { type: null }
    | { type: "view"; index: number; url: string }
    | { type: "edit"; index: number }
    | { type: "delete-image"; index: number; url: string }
    | { type: "regenerate" }
    | { type: "delete-batch" }

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    queued: { label: "Queued", variant: "outline" },
    processing: { label: "Processing", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
}

export default function ThumbnailPage() {
    const router = useRouter()
    const params = useParams()
    const [job, setJob] = useState<ThumbnailJob | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [modal, setModal] = useState<ModalState>({ type: null })

    const jobId = params.id as string
    const closeModal = () => setModal({ type: null })

    useEffect(() => {
        if (!jobId) return
        let cancelled = false
        let intervalId: ReturnType<typeof setInterval> | null = null

        const fetchJob = async () => {
            const data = await getThumbnail(jobId)
            if (cancelled) return null
            if (!data) {
                toast.error("Thumbnail not found")
                router.push("/dashboard/thumbnails")
                return null
            }
            setJob(data)
            setIsLoading(false)
            return data
        }

        fetchJob().then((data) => {
            if (cancelled || !data) return
            if (data.status === "queued" || data.status === "processing") {
                intervalId = setInterval(async () => {
                    const updated = await fetchJob()
                    if (!updated || (updated.status !== "queued" && updated.status !== "processing")) {
                        if (intervalId) clearInterval(intervalId)
                    }
                }, 3000)
            }
        })

        return () => {
            cancelled = true
            if (intervalId) clearInterval(intervalId)
        }
    }, [jobId, router])

    const handleDownload = useCallback(
        (imageUrl: string, index: number) => downloadFile(imageUrl, `thumbnail_${index + 1}.png`),
        [],
    )

    const handleDeleteImage = (index: number) => {
        if (!job) return
        setJob({ ...job, image_urls: job.image_urls.filter((_, i) => i !== index) })
        toast.success("Image removed from view")
    }

    if (isLoading) {
        return (
            <div className="container py-8 space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-6 w-full max-w-96" />
                <Skeleton className="h-[140px] rounded-lg mt-8" />
                <Skeleton className="h-[400px] rounded-lg" />
            </div>
        )
    }

    if (!job) return null

    const config = statusConfig[job.status] ?? { label: "Unknown", variant: "outline" as const }
    const imageCount = job.image_urls?.length ?? 0

    return (
        <div className="container py-8">
            <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Thumbnail Details</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">View your generated thumbnail</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => router.push("/dashboard/thumbnails")}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 shadow-sm hover:bg-muted hover:text-foreground transition"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Thumbnails
                </Button>
            </div>

            <div className="space-y-6">
                {/* ─── Details Card ─── */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <CardTitle>Details</CardTitle>
                            {job.status === "completed" && imageCount > 0 && (
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5"
                                        onClick={() => setModal({ type: "regenerate" })}
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30 hover:border-red-500/50"
                                        onClick={() => setModal({ type: "delete-batch" })}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                            <li className="flex items-start gap-3">
                                <Sparkles className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                <div className="text-sm min-w-0">
                                    <strong className="font-medium text-slate-800 dark:text-slate-200">Prompt:</strong>{" "}
                                    <span className="text-slate-700 dark:text-slate-300">{job.prompt}</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <Ratio className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                <div className="text-sm">
                                    <strong className="font-medium text-slate-800 dark:text-slate-200">Aspect Ratio:</strong>{" "}
                                    <span className="text-slate-700 dark:text-slate-300">{job.ratio}</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <ImageIcon className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                <div className="text-sm">
                                    <strong className="font-medium text-slate-800 dark:text-slate-200">Status:</strong>{" "}
                                    <Badge variant={config.variant} className="ml-1">{config.label}</Badge>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <Clock className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                <div className="text-sm">
                                    <strong className="font-medium text-slate-800 dark:text-slate-200">Created:</strong>{" "}
                                    <span className="text-slate-700 dark:text-slate-300">{new Date(job.created_at).toLocaleString()}</span>
                                </div>
                            </li>
                            {job.video_link && (
                                <li className="flex items-start gap-3">
                                    <LinkIcon className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                    <div className="text-sm min-w-0">
                                        <strong className="font-medium text-slate-800 dark:text-slate-200">Video:</strong>{" "}
                                        <a
                                            href={job.video_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-purple-600 hover:underline truncate inline-block max-w-[200px] align-bottom"
                                        >
                                            {job.video_link}
                                        </a>
                                    </div>
                                </li>
                            )}
                            <li className="flex items-start gap-3">
                                <Coins className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                <div className="text-sm">
                                    <strong className="font-medium text-slate-800 dark:text-slate-200">Credits:</strong>{" "}
                                    <span className="text-slate-700 dark:text-slate-300">
                                        {job.credits_consumed > 0 ? `${job.credits_consumed} credit${job.credits_consumed > 1 ? "s" : ""}` : "Pending"}
                                    </span>
                                </div>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* ─── Generated Images Card ─── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Generated Images</CardTitle>
                        <CardDescription>
                            {imageCount
                                ? `${imageCount} thumbnail${imageCount > 1 ? "s" : ""} generated`
                                : "No images generated yet"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {job.status === "failed" && job.error_message && (
                            <div className="flex items-start gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-4">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>{job.error_message}</span>
                            </div>
                        )}

                        {imageCount > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                                {job.image_urls.map((url, i) => (
                                    <div key={url} className="relative group rounded-lg overflow-hidden border bg-slate-50 dark:bg-slate-800/50">
                                        <img
                                            src={url}
                                            alt={`Thumbnail ${i + 1}`}
                                            className="w-full h-auto object-cover cursor-pointer"
                                            loading="lazy"
                                            onClick={() => setModal({ type: "view", index: i, url })}
                                        />
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                            <IconBtn
                                                title="Download"
                                                onClick={() => handleDownload(url, i)}
                                                icon={<Download className="h-3.5 w-3.5" />}
                                            />
                                            <IconBtn
                                                title="Edit"
                                                onClick={() => setModal({ type: "edit", index: i })}
                                                icon={<Pencil className="h-3.5 w-3.5" />}
                                            />
                                            <IconBtn
                                                title="Regenerate"
                                                onClick={() => setModal({ type: "regenerate" })}
                                                icon={<RefreshCw className="h-3.5 w-3.5" />}
                                            />
                                            <IconBtn
                                                title="Delete"
                                                onClick={() => setModal({ type: "delete-image", index: i, url })}
                                                icon={<Trash2 className="h-3.5 w-3.5" />}
                                                destructive
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                                <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
                                <p>
                                    {job.status === "queued" || job.status === "processing"
                                        ? "Thumbnails are being generated..."
                                        : "No images available"}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ─── Modals ─── */}
            {modal.type === "view" && (
                <ViewImageModal open onClose={closeModal} imageUrl={modal.url} imageIndex={modal.index} />
            )}
            {modal.type === "edit" && (
                <EditThumbnailModal open onClose={closeModal} job={job} imageIndex={modal.index} />
            )}
            {modal.type === "delete-image" && (
                <DeleteImageModal
                    open
                    onClose={closeModal}
                    imageUrl={modal.url}
                    imageIndex={modal.index}
                    onConfirm={() => handleDeleteImage(modal.index)}
                />
            )}
            {modal.type === "regenerate" && (
                <RegenerateThumbnailModal open onClose={closeModal} job={job} />
            )}
            {modal.type === "delete-batch" && (
                <DeleteBatchModal
                    open
                    onClose={closeModal}
                    jobId={jobId}
                    imageCount={imageCount}
                    onSuccess={() => router.push("/dashboard/thumbnails")}
                />
            )}
        </div>
    )
}

function IconBtn({ title, onClick, icon, destructive }: {
    title: string
    onClick: () => void
    icon: React.ReactNode
    destructive?: boolean
}) {
    return (
        <Button
            variant="secondary"
            size="icon"
            className={`h-8 w-8 rounded-full bg-white/90 dark:bg-slate-900/90 shadow-sm ${destructive
                ? "hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500"
                : "hover:bg-white dark:hover:bg-slate-900"
                }`}
            onClick={onClick}
            title={title}
        >
            {icon}
        </Button>
    )
}
