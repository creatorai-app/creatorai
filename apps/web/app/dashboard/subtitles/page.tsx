"use client";

import { useState, useEffect } from "react";
import * as motion from "motion/react-m";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Badge } from "@repo/ui/badge";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { ContentCard } from "@/components/dashboard/common/ContentCard";
import ContentCardSkeleton from "@/components/dashboard/common/skeleton/ContentCardSkeleton";
import { EmptySvg } from "@/components/dashboard/common/EmptySvg";
import { SubtitleResponse } from "@repo/validation";
import { api } from "@/lib/api-client";

const STATUS_COLORS: Record<string, string> = {
    done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    queued: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.07 },
    },
};

const emptyStateVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.4 },
    },
};

export default function SubtitlesPage() {
    const [subtitles, setSubtitles] = useState<SubtitleResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await api.get<SubtitleResponse[]>("/api/v1/subtitle", {
                    requireAuth: true,
                });
                setSubtitles(data);
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Unknown error";
                toast.error("Error fetching subtitles", { description: msg });
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleDelete = async () => {
        if (!itemToDelete) return;
        const prev = [...subtitles];
        setSubtitles((s) => s.filter((item) => item.id !== itemToDelete));

        try {
            const res = await api.delete<{ success: boolean; message: string }>(
                `/api/v1/subtitle/${itemToDelete}`,
                { requireAuth: true }
            );
            if (!res.success) throw new Error(res.message);
            toast.success("Subtitle project deleted");
        } catch {
            setSubtitles(prev);
            toast.error("Failed to delete. Item restored.");
        } finally {
            setItemToDelete(null);
        }
    };

    if (loading) return <ContentCardSkeleton />;

    const filteredSubtitles = subtitles
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .filter((s) => {
            const q = searchQuery.toLowerCase();
            const displayTitle = s.title || s.filename;
            return (
                displayTitle.toLowerCase().includes(q) ||
                s.language.toLowerCase().includes(q) ||
                s.status.toLowerCase().includes(q)
            );
        });

    return (
        <motion.div
            className="container py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Subtitles</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Manage all your generated subtitle projects
                    </p>
                </div>
                <Link href="/dashboard/subtitles/new">
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white transition-all hover:shadow-lg hover:shadow-purple-500/10 dark:hover:shadow-purple-400/10">
                        <Plus className="mr-2 h-4 w-4" />
                        New Subtitle
                    </Button>
                </Link>
            </div>

            <div className="mb-8">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                    <Input
                        placeholder="Search by title, language, or status..."
                        className="pl-10 focus-visible:ring-2 focus-visible:ring-purple-500/80"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <AnimatePresence mode="wait">
                {filteredSubtitles.length > 0 ? (
                    <motion.div
                        key="subtitle-list"
                        className="grid grid-cols-1 gap-4"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {filteredSubtitles.map((item) => (
                            <ContentCard
                                key={item.id}
                                id={item.id}
                                title={item.title || item.filename}
                                created_at={item.created_at}
                                onDelete={handleDelete}
                                setToDelete={setItemToDelete}
                                type="subtitles"
                                statusBadge={
                                    <Badge
                                        variant="secondary"
                                        className={STATUS_COLORS[item.status] || ""}
                                    >
                                        {item.status}
                                    </Badge>
                                }
                            />
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty-state"
                        variants={emptyStateVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <div className="text-center py-16">
                            <div className="flex flex-col items-center">
                                <EmptySvg className="h-32 w-auto mb-6 text-slate-300 dark:text-slate-700" />
                                <h3 className="font-semibold text-xl text-slate-800 dark:text-slate-200 mb-2">
                                    {searchQuery ? "No results found" : "Generate your first subtitles"}
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                                    {searchQuery
                                        ? `No subtitles matching "${searchQuery}".`
                                        : "Upload a video and let AI generate studio-quality subtitles in minutes."}
                                </p>
                                {!searchQuery && (
                                    <Link href="/dashboard/subtitles/new">
                                        <Button className="bg-slate-900 hover:bg-slate-800 text-white transition-all">
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create Subtitle
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
