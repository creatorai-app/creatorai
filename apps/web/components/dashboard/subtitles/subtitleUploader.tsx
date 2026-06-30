"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import axios from "axios";
import { UploadCloud, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

// UI Components
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";

// Hooks & Utils
import { api, getApiErrorMessage } from "@/lib/api-client";
import { formatUploadLimit, SUBTITLE_PAID_UPLOAD_BYTES, SUBTITLE_PAID_MAX_DURATION_SECONDS } from "@repo/validation";

type SubtitleUploaderProps = {
    onUploadSuccess: () => void;
    scriptId?: string;
};

export function SubtitleUploader({ onUploadSuccess, scriptId }: SubtitleUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [duration, setDuration] = useState<number | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    // Plan-based limits; assume the highest tier until the API confirms the user's limit.
    const [maxSize, setMaxSize] = useState(SUBTITLE_PAID_UPLOAD_BYTES);
    const [maxDuration, setMaxDuration] = useState(SUBTITLE_PAID_MAX_DURATION_SECONDS);
    const router = useRouter();

    useEffect(() => {
        api.get<{ maxBytes: number; maxDurationSeconds: number }>("/api/v1/subtitle/upload/limit", { requireAuth: true })
            .then((res) => { setMaxSize(res.maxBytes); setMaxDuration(res.maxDurationSeconds); })
            .catch(() => { /* keep defaults; the sign step enforces the real limit anyway */ });
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(null);
        setDuration(null);

        if (selectedFile.size > maxSize) {
            toast.error("Upload limit reached", {
                description: `Your current plan allows up to ${formatUploadLimit(maxSize)} for subtitle uploads. Please upgrade to upload larger videos.`,
            });
            e.target.value = "";
            return;
        }

        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            URL.revokeObjectURL(video.src);
            const videoDuration = video.duration;
            if (videoDuration > maxDuration) {
                toast.error("Duration limit reached", {
                    description: `Your current plan allows videos up to ${Math.round(maxDuration / 60)} minutes for subtitle generation. Please upgrade for longer videos.`,
                });
                e.target.value = "";
                return;
            }

            setFile(selectedFile);
            setDuration(videoDuration);
        };
        video.onerror = () => {
            toast.error("Could not load video metadata. The file may be corrupt.");
            e.target.value = "";
        };
        video.src = URL.createObjectURL(selectedFile);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!file || !duration) return toast.warning("Please select a valid file.");

        setIsUploading(true);
        setProgress(0);

        try {
            // 1. Ask the API for a signed URL to upload straight to storage.
            const { uploadUrl, objectName, contentType } = await api.post<{
                uploadUrl: string;
                objectName: string;
                contentType: string;
            }>(
                "/api/v1/subtitle/upload/sign",
                {
                    filename: file.name,
                    contentType: file.type || "video/mp4",
                    fileSize: file.size,
                    duration: String(duration),
                    ...(scriptId ? { scriptId } : {}),
                },
                { requireAuth: true },
            );

            // 2. Upload the file directly to storage (bypasses our API — no auth header on a signed URL).
            await axios.put(uploadUrl, file, {
                headers: { "Content-Type": contentType },
                onUploadProgress: (progressEvent) => {
                    setProgress(Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1)));
                },
            });

            // 3. Create the subtitle job now that the file is in storage.
            const { subtitleId } = await api.post<{ subtitleId: string }>(
                "/api/v1/subtitle/upload/finalize",
                {
                    objectName,
                    filename: title.trim() || file.name,
                    duration: String(duration),
                    ...(scriptId ? { scriptId } : {}),
                },
                { requireAuth: true },
            );

            toast.success("Upload successful! Processing has started.");
            onUploadSuccess();
            router.push(`/dashboard/subtitles/${subtitleId}`);

            setFile(null);
            setTitle("");
            setDuration(null);
        } catch (error) {
            const message = getApiErrorMessage(error, "Failed to upload video.");
            toast.error("Upload failed", { description: message });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Card className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <CardHeader className="p-8 pb-4">
                <div className="flex items-center">
                    <div className="p-2.5 bg-violet-50 rounded-xl mr-4 border border-violet-100">
                        <UploadCloud className="text-violet-600 h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-bold text-slate-900">Upload Video</CardTitle>
                        <CardDescription className="text-slate-500">Supported formats: MP4, MOV, MKV</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <form onSubmit={handleSubmit} className="p-8 pt-2">
                <CardContent className="p-0">
                    <Label
                        htmlFor="file-upload"
                        className={`group relative flex w-full cursor-pointer flex-col items-center justify-center space-y-5 rounded-xl border-2 border-dashed py-16 px-8 transition-all duration-300 ${
                            isUploading
                                ? "cursor-not-allowed opacity-50 bg-slate-50 border-slate-200"
                                : "border-violet-200 bg-violet-50/30 hover:bg-violet-50 hover:border-violet-300"
                        }`}
                    >
                        <motion.div
                            whileHover={!isUploading ? { scale: 1.05 } : {}}
                            whileTap={!isUploading ? { scale: 0.95 } : {}}
                            className={`h-16 w-16 rounded-full flex items-center justify-center shadow-lg transition-colors duration-300 ${
                                file ? "bg-violet-600" : "bg-slate-900"
                            }`}
                        >
                            {isUploading ? (
                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                            ) : (
                                <UploadCloud className="h-8 w-8 text-white" />
                            )}
                        </motion.div>

                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-slate-900">
                                {file ? file.name : "Drag & Drop your video"}
                            </h3>
                            <p className="text-sm text-slate-500 mt-2">
                                {file
                                    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                                    : <>or <span className="text-violet-600 font-medium underline underline-offset-2">browse files</span> from computer</>
                                }
                            </p>
                        </div>

                        <div className="flex items-center space-x-4 text-xs text-slate-400 uppercase tracking-widest font-bold">
                            <span>Max {formatUploadLimit(maxSize)}</span>
                            <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                            <span>{Math.round(maxDuration / 60)} Min Limit</span>
                        </div>
                    </Label>
                    <Input
                        id="file-upload"
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={isUploading}
                    />
                </CardContent>

                {file && (
                    <div className="mt-6">
                        <Label htmlFor="subtitle-title" className="text-sm font-medium text-slate-700 mb-1.5 block">
                            Title (optional)
                        </Label>
                        <Input
                            id="subtitle-title"
                            type="text"
                            placeholder="Enter a title for this subtitle project"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={isUploading}
                            className="focus-visible:ring-2 focus-visible:ring-violet-500/80"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            If empty, the video file name will be used
                        </p>
                    </div>
                )}

                <div className="mt-8 flex flex-col sm:flex-row items-center justify-end gap-4">

                    <Button
                        type="submit"
                        disabled={!file || !duration || isUploading}
                        className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-10 h-12 rounded-xl text-base font-bold shadow-lg shadow-slate-200 transition-all active:scale-95"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                {progress > 0 && progress < 100 ? `Uploading ${progress}%` : "Processing..."}
                            </>
                        ) : "Generate Subtitles"}
                    </Button>
                </div>
            </form>
        </Card>
    );
}