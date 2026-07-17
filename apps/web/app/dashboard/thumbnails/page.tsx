"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Badge } from "@repo/ui/badge"
import { toast } from "sonner"
import { useSupabase } from "@/components/supabase-provider"
import { Plus, Search } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { ContentCard } from "@/components/dashboard/common/ContentCard"
import ContentCardSkeleton from "@/components/dashboard/common/skeleton/ContentCardSkeleton"
import { EmptySvg } from "@/components/dashboard/common/EmptySvg"
import { getThumbnails, deleteThumbnail, type ThumbnailJob } from "@/lib/api/getThumbnails"

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.07 },
    },
}

const emptyStateVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.4 },
    },
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    queued: { label: "Queued", variant: "outline" },
    processing: { label: "Processing", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
}

export default function Thumbnails() {
    const { profileLoading } = useSupabase()
    const [thumbnails, setThumbnails] = useState<ThumbnailJob[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [thumbnailToDelete, setThumbnailToDelete] = useState<string | null>(null)

    useEffect(() => {
        const fetchThumbnails = async () => {
            setLoading(true)
            const data = await getThumbnails()
            setThumbnails(data)
            setLoading(false)
        }
        fetchThumbnails()
    }, [])

    const handleDeleteThumbnail = async () => {
        if (!thumbnailToDelete) return

        const success = await deleteThumbnail(thumbnailToDelete)
        if (success) {
            setThumbnails(thumbnails.filter((t) => t.id !== thumbnailToDelete))
            toast.success("Thumbnail deleted", {
                description: "Your thumbnail has been deleted successfully.",
            })
        } else {
            toast.error("Error deleting thumbnail", {
                description: "Could not delete the thumbnail. Please try again.",
            })
        }
        setThumbnailToDelete(null)
    }

    if (profileLoading || loading) {
        return <ContentCardSkeleton />
    }

    const filteredThumbnails = thumbnails.filter((t) =>
        (t.prompt ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <motion.div
            className="container py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Thumbnails</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Manage all your generated thumbnails
                    </p>
                </div>
                <Link href="/dashboard/thumbnails/new">
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white transition-all hover:shadow-lg hover:shadow-purple-500/10 dark:hover:shadow-purple-400/10">
                        <Plus className="mr-2 h-4 w-4" />
                        New Thumbnail
                    </Button>
                </Link>
            </div>

            <div className="mb-8">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                    <Input
                        placeholder="Search thumbnails..."
                        className="pl-10 focus-visible:ring-2 focus-visible:ring-purple-500/80"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <AnimatePresence mode="wait">
                {filteredThumbnails.length > 0 ? (
                    <motion.div
                        key="thumbnail-list"
                        className="grid grid-cols-1 gap-4"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {filteredThumbnails.map((job) => {
                            const config = (statusConfig[job.status] ?? statusConfig.queued)!
                            return (
                                <ContentCard
                                    key={job.id}
                                    id={job.id}
                                    title={job.prompt}
                                    created_at={job.created_at}
                                    onDelete={handleDeleteThumbnail}
                                    setToDelete={setThumbnailToDelete}
                                    type="thumbnails"
                                    imagePreview={job.image_urls?.[0]}
                                    statusBadge={
                                        <Badge variant={config.variant} className="text-xs">
                                            {config.label}
                                        </Badge>
                                    }
                                />
                            )
                        })}
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty-state-illustrated"
                        variants={emptyStateVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <div className="text-center py-16">
                            <div className="flex flex-col items-center">
                                <EmptySvg className="h-32 w-auto mb-6 text-slate-300 dark:text-slate-700" />
                                <h3 className="font-semibold text-xl text-slate-800 dark:text-slate-200 mb-2">
                                    Create your first thumbnail
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                                    {searchQuery
                                        ? `We couldn't find a thumbnail matching "${searchQuery}".`
                                        : "Generate AI-powered thumbnails tailored to your channel. Get started now."}
                                </p>
                                {!searchQuery && (
                                    <Link href="/dashboard/thumbnails/new">
                                        <Button className="bg-slate-900 hover:bg-slate-800 text-white transition-all">
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create Thumbnail
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
