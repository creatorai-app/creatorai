"use client";

import React, { useState } from 'react';
import { Button } from "@repo/ui/button";
import { Plus, Trash2, Search, MoreVertical } from 'lucide-react';
import { SubtitleLine } from '@repo/validation';
import { SubtitleEmptyState } from './SubtitleEmptyState';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { SubtitleList } from "@/components/dashboard/subtitles/SubtitleList";

type SubtitleEditorPanelProps = {
    subtitles: SubtitleLine[];
    currentSub: SubtitleLine | undefined;
    editingIndex: number | null;
    isGenerating: boolean;
    progress?: number;
    statusMessage?: string;
    videoDuration: number | null;
    onAddLine: () => void;
    onUpdate: (idx: number, field: keyof SubtitleLine, val: string) => void;
    onDelete: (idx: number) => void;
    onSetEditing: (idx: number | null) => void;
    onSeek: (time: string) => void;
    onGenerate: (language: string, targetLanguage: string) => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
};

export function SubtitleEditorPanel({
    subtitles,
    currentSub,
    editingIndex,
    isGenerating,
    progress,
    statusMessage,
    videoDuration,
    onAddLine,
    onUpdate,
    onDelete,
    onSetEditing,
    onSeek,
    onGenerate,
    onFileChange,
    onClear
}: SubtitleEditorPanelProps) {
    const hasSubtitles = subtitles.length > 0;
    const [searchQuery, setSearchQuery] = useState('');

    const filteredSubtitles = hasSubtitles
        ? subtitles
            .map((sub, idx) => ({ sub, idx }))
            .filter(({ sub }) =>
                sub.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                sub.start.includes(searchQuery) ||
                sub.end.includes(searchQuery)
            )
        : [];

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-950">
            {!hasSubtitles ? (
                <div className="flex-1 overflow-y-auto">
                    <SubtitleEmptyState
                        isGenerating={isGenerating}
                        progress={progress}
                        statusMessage={statusMessage}
                        videoDuration={videoDuration}
                        onGenerate={onGenerate}
                        onFileChange={onFileChange}
                        onAddLineManually={onAddLine}
                    />
                </div>
            ) : (
                <>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
                                Editor
                            </h1>
                            <p className="text-xs sm:text-sm font-medium text-slate-400 dark:text-slate-500 font-mono tracking-widest">
                                {subtitles.length} {subtitles.length === 1 ? 'LINE' : 'LINES'}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                            <div className="relative group flex-1 sm:flex-initial sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-violet-600 dark:group-focus-within:text-violet-400 transition-colors" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search subtitles..."
                                    className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-violet-600 dark:focus:border-violet-500 transition-all placeholder-slate-400 dark:text-slate-200 shadow-sm"
                                />
                            </div>
                            <Button
                                size="sm"
                                onClick={onAddLine}
                                className="h-9 sm:h-10 bg-black hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-black text-white px-4 sm:px-6 shadow-lg hover:shadow-xl active:scale-95 whitespace-nowrap text-xs sm:text-sm"
                            >
                                <Plus className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Add</span>
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 sm:h-10 w-9 sm:w-10 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <MoreVertical className="h-4 w-4 text-slate-400" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem
                                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                        onClick={onClear}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                                        Clear All
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        <SubtitleList
                            subtitles={filteredSubtitles.map(({ sub }) => sub)}
                            originalIndices={filteredSubtitles.map(({ idx }) => idx)}
                            allSubtitles={subtitles}
                            currentSub={currentSub}
                            editingIndex={editingIndex}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            onSetEditing={onSetEditing}
                            onSeek={onSeek}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
