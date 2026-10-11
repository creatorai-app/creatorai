"use client";

import React from 'react';
import { Button } from "@repo/ui/button";
import { Upload, Sparkles, FileText } from 'lucide-react';
import { GenerateSubtitlesForm } from './GenerateSubtitlesForm';

type SubtitleEmptyStateProps = {
    isGenerating: boolean;
    progress?: number;
    statusMessage?: string;
    videoDuration: number | null;
    onGenerate: (language: string, targetLanguage: string) => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onAddLineManually: () => void;
};

export function SubtitleEmptyState({
    isGenerating,
    progress,
    statusMessage,
    videoDuration,
    onGenerate,
    onFileChange,
    onAddLineManually
}: SubtitleEmptyStateProps) {
    return (
        <div className="h-full overflow-y-auto px-4 sm:px-6 py-8 sm:py-12
            [&::-webkit-scrollbar]:hidden
            [-ms-overflow-style]:none
            [scrollbar-width]:none">
            <div className="max-w-lg mx-auto space-y-6 sm:space-y-8">
                {/* Header */}
                <div className="text-center space-y-2 sm:space-y-3 pt-4 sm:pt-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30">
                        <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-violet-600 dark:text-violet-400" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
                        Create Subtitles
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto px-4">
                        Choose how you'd like to add subtitles to your video
                    </p>
                </div>

                <div className="space-y-4 sm:space-y-6">
                    {/* Auto-Generate Option */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600 dark:text-violet-400" />
                            </div>
                            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                                Auto-Generate
                            </span>
                        </div>

                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/30">
                            <GenerateSubtitlesForm
                                isGenerating={isGenerating}
                                progress={progress}
                                statusMessage={statusMessage}
                                videoDuration={videoDuration}
                                onGenerate={onGenerate}
                            />

                            <div className="mt-4 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <div className="w-1 h-1 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                                <p>
                                    AI will transcribe your video and generate accurate subtitles
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-white dark:bg-slate-950 px-4 text-xs text-slate-400 font-medium">
                                or
                            </span>
                        </div>
                    </div>

                    {/* Upload Option */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 sm:gap-2.5">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    Upload File
                                </span>
                            </div>
                            <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Free
                            </div>
                        </div>

                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            accept=".srt"
                            onChange={onFileChange}
                        />
                        <label
                            htmlFor="file-upload"
                            className="block cursor-pointer group"
                        >
                            <div className="h-24 sm:h-28 border-2 border-dashed border-slate-300 dark:border-slate-700 group-hover:border-violet-400 dark:group-hover:border-violet-600 bg-slate-50 dark:bg-slate-900/30 group-hover:bg-violet-50/50 dark:group-hover:bg-violet-950/20 rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-2 sm:gap-3 p-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                                    <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 dark:text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
                                </div>
                                <div className="text-center">
                                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                                        Drop .SRT file here
                                    </span>
                                    <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                                        or click to browse
                                    </span>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-4 sm:pt-6 border-t border-slate-200 dark:border-slate-800 pb-6 sm:pb-8">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onAddLineManually}
                        className="w-full text-xs sm:text-sm text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
                    >
                        <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                        Create manually
                    </Button>
                </div>
            </div>
        </div>
    );
}
