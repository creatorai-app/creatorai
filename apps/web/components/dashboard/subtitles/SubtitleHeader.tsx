"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from "@repo/ui/button";
import { Save, Download, Loader2, Undo2, Redo2, ArrowLeft, Coins } from 'lucide-react';

type SubtitleHeaderProps = {
    filename: string;
    videoPath: string;
    isSaving: boolean;
    hasSubtitles: boolean;
    totalTokens?: number;
    onSave: () => void;
    onDownload: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
};

export function SubtitleHeader({
    filename,
    isSaving,
    hasSubtitles,
    totalTokens,
    onSave,
    onDownload,
    onUndo,
    onRedo,
    canUndo,
    canRedo
}: SubtitleHeaderProps) {
    return (
        <div className="h-auto sm:h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-3 sm:px-4 lg:px-6 py-2 sm:py-0 shrink-0 gap-2 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                    <Link href="/dashboard/subtitles">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="min-w-0 flex-1">
                    <h1 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {filename}
                    </h1>
                </div>
                {totalTokens ? (
                    <span
                        title="Total Gemini tokens used to generate these subtitles"
                        className="hidden sm:inline-flex items-center gap-1 shrink-0 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900 px-2.5 py-1 text-xs font-medium"
                    >
                        <Coins className="h-3.5 w-3.5" />
                        {totalTokens.toLocaleString()} tokens
                    </span>
                ) : null}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-800 pr-1.5 sm:pr-2 mr-1.5 sm:mr-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onUndo}
                        disabled={!canUndo}
                        className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRedo}
                        disabled={!canRedo}
                        className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </Button>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onDownload}
                    disabled={!hasSubtitles}
                    className="h-8 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs"
                >
                    <Download className="h-3.5 w-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline text-xs">Download SRT</span>
                    <span className="sm:hidden text-xs">SRT</span>
                </Button>
                <Button
                    size="sm"
                    onClick={onSave}
                    disabled={isSaving || !hasSubtitles}
                    className="h-8 bg-black hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-black text-white text-xs"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 sm:mr-1.5 animate-spin" />
                            <span className="hidden sm:inline text-xs">Saving...</span>
                            <span className="sm:hidden text-xs">...</span>
                        </>
                    ) : (
                        <>
                            <Save className="h-3.5 w-3.5 sm:mr-1.5" />
                            <span className="text-xs">Save</span>
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
