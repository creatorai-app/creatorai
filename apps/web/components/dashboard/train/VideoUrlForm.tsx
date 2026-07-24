"use client"
import * as motion from "motion/react-m";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Progress } from "@repo/ui/progress";
import { X, Loader2, RefreshCw, Upload, Plus } from "lucide-react";
import React from "react"

type Video = {
    id: number;
    url: string;
    title?: string;
    thumbnail?: string;
    status: 'empty' | 'loading' | 'loaded' | 'error';
    error?: string;
};

type VideoUrlFormProps = {
    videos: Video[];
    uploading: boolean;
    isAiTrained: boolean | undefined;
    isYtConnected: boolean | undefined;
    isTraining: boolean;
    progress: number;
    statusMessage: string;
    onUrlChange: (index: number, value: string) => void;
    onUrlBlur: (index: number) => void;
    onAddUrl: () => void;
    onRemoveUrl: (index: number) => void;
    onStartTraining: () => void;
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
};

function VideoPreview({ video, onRemove }: { video: Video, onRemove: () => void }) {
    return (
        <div className="flex items-center w-full gap-4 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <img
                src={video.thumbnail}
                alt={video.title}
                className="w-24 h-14 rounded-md object-cover border border-slate-200 dark:border-slate-700"
            />
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate text-slate-800 dark:text-slate-200">{video.title}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onRemove} className="shrink-0">
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}

export function VideoUrlForm({
    videos,
    uploading,
    isAiTrained,
    isYtConnected,
    isTraining,
    progress,
    statusMessage,
    onUrlChange,
    onUrlBlur,
    onAddUrl,
    onRemoveUrl,
    onStartTraining,
}: VideoUrlFormProps) {
    const filledVideosCount = (videos || []).filter(v => v.url.trim() !== "").length;

    return (
        <motion.div variants={itemVariants} className="relative">
            <Card className="shadow-lg relative">
                <CardHeader>
                    <CardTitle>Add Your YouTube Videos</CardTitle>
                    <CardDescription>
                        Provide links to 3-5 of your videos that best represent your style.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-2">
                    {(videos || []).map((video, index) => (
                        <motion.div
                            key={video.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            {video.status === "loaded" ? (
                                <VideoPreview video={video} onRemove={() => onRemoveUrl(index)} />
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2 group">
                                        <div className="relative w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                            <Input
                                                placeholder={`Paste a YouTube link here... (Video ${index + 1})`}
                                                value={video.url}
                                                onChange={(e) => onUrlChange(index, e.target.value)}
                                                onBlur={() => onUrlBlur(index)}
                                                disabled={uploading || isTraining}
                                                className={`bg-transparent border-0 border-b-2 rounded-none px-1 focus-visible:ring-0 ${video.status === "error"
                                                    ? "border-red-500"
                                                    : "border-slate-200 dark:border-slate-700 focus-visible:border-purple-500"
                                                    }`}
                                            />
                                            {video.status === "loading" && (
                                                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-slate-200/40 via-slate-300/50 to-slate-200/40 dark:from-slate-700/30 dark:via-slate-600/40 dark:to-slate-700/30 animate-[shimmer_2s_infinite]" />
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onRemoveUrl(index)}
                                            disabled={uploading || isTraining}
                                            className="shrink-0"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {video.status === "error" && video?.error && (
                                        <p className="text-xs text-red-500 px-1">{video.error}</p>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    ))}

                    {(videos || []).length < 5 && (
                        <Button
                            variant="ghost"
                            onClick={onAddUrl}
                            disabled={uploading || isTraining}
                            className="mt-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Another Video
                        </Button>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900/50 p-6 border-t">
                    {/* Progress during training */}
                    {isTraining && (
                        <div className="w-full space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {statusMessage || "Processing..."}
                                </span>
                                <span className="text-slate-500">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-3" />
                            <p className="text-xs text-slate-500 text-center">
                                This may take 0-5 minutes depending on video length
                            </p>
                        </div>
                    )}

                    {/* Helper text when not training */}
                    {!isTraining && filledVideosCount < 3 && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center w-full">
                            Please add {3 - filledVideosCount} more video(s) to continue
                        </p>
                    )}

                    {/* Action button */}
                    <div className="flex justify-end w-full">
                        <Button
                            onClick={onStartTraining}
                            size="lg"
                            disabled={uploading || isTraining || !isYtConnected || filledVideosCount < 3}
                            className="min-w-48"
                        >
                            {isTraining ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Training in progress...
                                </>
                            ) : uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Preparing...
                                </>
                            ) : (
                                <>
                                    {isAiTrained ? (
                                        <RefreshCw className="mr-2 h-5 w-5" />
                                    ) : (
                                        <Upload className="mr-2 h-5 w-5" />
                                    )}
                                    {isAiTrained ? "Re-train AI" : "Start Training"}
                                </>
                            )}
                        </Button>
                    </div>
                </CardFooter>

                {/* Overlay when YT not connected */}
                {!isYtConnected && (
                    <div className="absolute inset-0 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
                        <div className="text-center space-y-4 px-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                🚧 Training Locked
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                                Please connect your YouTube account
                            </p>
                        </div>
                    </div>
                )}
            </Card>
        </motion.div>
    );
}