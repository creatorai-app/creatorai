"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SubtitleUploader } from "@/components/dashboard/subtitles/subtitleUploader";
import { UpgradePromoCard } from "@/components/dashboard/subtitles/UpgradePromoCard";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Sparkles, ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Skeleton } from "@repo/ui/skeleton";

function NewSubtitlePageInner() {
    const searchParams = useSearchParams();
    const scriptId = searchParams.get("scriptId") ?? undefined;

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 lg:py-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <Link href="/dashboard/subtitles">
                            <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-slate-500 hover:text-slate-900">
                                <ArrowLeft className="mr-1 h-4 w-4" />
                                Back to Subtitles
                            </Button>
                        </Link>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">
                            Subtitle Generator
                        </h1>
                        <p className="text-lg text-slate-500 max-w-2xl">
                            Transform your videos with studio-quality AI subtitles in minutes.
                        </p>
                        {scriptId && (
                            <div className="mt-3 flex items-center gap-2">
                                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                                    <FileText className="h-3 w-3 mr-1" /> Linked to Script
                                </Badge>
                            </div>
                        )}
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                            <SubtitleUploader onUploadSuccess={() => {}} scriptId={scriptId} />
                        </motion.div>
                    </div>

                    <div className="lg:col-span-4 space-y-6">
                        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                                    How It Works
                                    <Sparkles className="h-4 w-4 text-violet-500" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm text-slate-600">
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center">1</span>
                                    <p>Upload your video file (MP4, MOV, etc.)</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center">2</span>
                                    <p>AI transcribes and generates timed subtitles</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center">3</span>
                                    <p>Edit, style, and export in SRT or VTT format</p>
                                </div>
                            </CardContent>
                        </Card>

                        <UpgradePromoCard />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function NewSubtitlePage() {
    return (
        <Suspense fallback={
            <div className="container py-8 space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-6 w-96" />
                <Skeleton className="h-[400px] rounded-lg mt-8" />
            </div>
        }>
            <NewSubtitlePageInner />
        </Suspense>
    );
}
