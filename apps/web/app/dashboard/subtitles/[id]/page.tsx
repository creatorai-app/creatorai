"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { X, ArrowLeft } from 'lucide-react';
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import Link from 'next/link';

import { SubtitleHeader } from '@/components/dashboard/subtitles/SubtitleHeader';
import { VideoPlayer } from '@/components/dashboard/subtitles/VideoPlayer';
import { SubtitleEditorPanel } from '@/components/dashboard/subtitles/SubtitleEditorPanel';

import { useSubtitleData } from '@/hooks/useSubtitleData';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import { useSubtitleEditor } from '@/hooks/useSubtitleEditor';
import { useSubtitleFileOperations } from '@/hooks/useSubtitleFileOperations';
import { useSubtitleGeneration } from '@/hooks/useSubtitleGeneration';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { convertJsonToVTT } from "@/utils/vttHelper";
import { useDebounce } from "@/hooks/useDebounce";
import { SubtitleEditorSkeleton } from "@/components/dashboard/subtitles/skeleton/SubtitleEditorSkeleton";



export default function SubtitleEditorPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { id } = useParams();

    const { subtitleData, subtitles, setSubtitles, isLoading, error, refetch } = useSubtitleData(id as string);
    const { currentTime, videoDuration, currentSubtitle, seekTo } = useVideoPlayer(
        videoRef,
        subtitleData?.video_url,
        subtitles
    );
    const { editingIndex, setEditingIndex, updateSubtitle, handleAddLine, handleDeleteLine, handleClear } = useSubtitleEditor(
        subtitles,
        setSubtitles,
        currentTime
    );
    const { isSaving, handleSave, handleDownload, handleFileUpload, handleDownloadVideo, downloadVideoLoading } = useSubtitleFileOperations(
        id as string,
        subtitles,
        setSubtitles,
        subtitleData?.video_path,
        subtitleData?.video_url
    );
    const { isGenerating, handleGenerate } = useSubtitleGeneration(id as string, videoDuration, refetch);
    const { undo, redo, canUndo, canRedo } = useUndoRedo(subtitles, setSubtitles);
    const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
    const debouncedSubtitles = useDebounce(subtitles, 500);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (canUndo) undo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                if (canRedo) redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, canUndo, canRedo]);

    useEffect(() => {
        if (!debouncedSubtitles || debouncedSubtitles.length === 0) {
            if (subtitleUrl) {
                URL.revokeObjectURL(subtitleUrl);
                setSubtitleUrl(null);
            }
            return;
        }

        const vttContent = convertJsonToVTT(debouncedSubtitles);
        const blob = new Blob([vttContent], { type: 'text/vtt' });
        const newSubtitleUrl = URL.createObjectURL(blob);
        setSubtitleUrl(newSubtitleUrl);

        return () => {
            URL.revokeObjectURL(newSubtitleUrl);
        };
    }, [debouncedSubtitles]);

    if (isLoading) {
        return (
            <SubtitleEditorSkeleton />
        );
    }

    if (error) {
        return (
            <div className="h-screen flex items-center justify-center p-8">
                <Card className="p-8 border-slate-200 dark:border-slate-800 max-w-md">
                    <X className="w-12 h-12 mx-auto text-slate-400" />
                    <h2 className="mt-4 text-xl font-semibold text-center">Error Loading Job</h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-center">{error}</p>
                    <Button asChild className="mt-6 w-full bg-slate-900 hover:bg-slate-800">
                        <Link href="/dashboard/subtitles">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
                        </Link>
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <SubtitleHeader
                filename={subtitleData?.filename || 'Loading...'}
                videoPath={subtitleData?.video_path || 'Loading...'}
                isSaving={isSaving}
                hasSubtitles={subtitles.length > 0}
                totalTokens={subtitleData?.total_tokens}
                onSave={handleSave}
                onDownload={handleDownload}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
            />

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden border-t border-slate-200 dark:border-slate-800">
                <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-3 sm:p-4 lg:p-6 overflow-y-auto bg-white dark:bg-slate-950 h-1/2 lg:h-full">
                    <VideoPlayer
                        ref={videoRef}
                        videoUrl={subtitleData?.video_url || ''}
                        subtitleUrl={subtitleUrl}
                        title={subtitleData?.video_path || 'Video Player'}
                        onDownloadVideo={handleDownloadVideo}
                        isDownloadDisabled={!subtitles.length || isSaving}
                        downloadVideoLoading={downloadVideoLoading}
                        detectedLanguage={subtitleData?.detected_language}
                        targetLanguage={subtitleData?.language}
                        language={subtitleData?.language}
                    />
                </div>

                <div className="w-full lg:w-1/2 h-1/2 lg:h-full">
                    <SubtitleEditorPanel
                        subtitles={subtitles}
                        currentSub={currentSubtitle}
                        editingIndex={editingIndex}
                        isGenerating={isGenerating}
                        videoDuration={videoDuration}
                        onAddLine={handleAddLine}
                        onUpdate={updateSubtitle}
                        onDelete={handleDeleteLine}
                        onClear={handleClear}
                        onSetEditing={setEditingIndex}
                        onSeek={seekTo}
                        onGenerate={handleGenerate}
                        onFileChange={handleFileUpload}
                    />
                </div>
            </div>
        </div>
    );
}