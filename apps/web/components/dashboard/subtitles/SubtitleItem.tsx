"use client";

import React, { memo, useCallback, useState } from 'react';
import { Trash2, Edit2, X, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { SubtitleLine } from '@repo/validation';
import { cn } from "@/lib/utils";
import { timeToSeconds, secondsToTime } from '@/utils/timeUtils';

type SubtitleItemProps = {
    subtitle: SubtitleLine;
    index: number;
    isCurrent: boolean;
    isEditing: boolean;
    onUpdate: (idx: number, field: keyof SubtitleLine, val: string) => void;
    onDelete: (idx: number) => void;
    onSetEditing: (idx: number | null) => void;
    onSeek: (time: string) => void;
};

export const SubtitleItem = memo(function SubtitleItem({
    subtitle,
    index,
    isCurrent,
    isEditing,
    onUpdate,
    onDelete,
    onSetEditing,
    onSeek
}: SubtitleItemProps) {
    const handleSave = useCallback(() => onSetEditing(null), [onSetEditing]);
    const handleEdit = useCallback(() => onSetEditing(index), [onSetEditing, index]);
    const handleSeek = useCallback(() => onSeek(subtitle.start), [onSeek, subtitle.start]);

    const adjustTime = useCallback((field: 'start' | 'end', delta: number) => {
        const currentSeconds = timeToSeconds(subtitle[field]);
        const newSeconds = Math.max(0, currentSeconds + delta);
        onUpdate(index, field, secondsToTime(newSeconds));
    }, [subtitle, index, onUpdate]);

    return (
        <div
            className={cn(
                "group relative border-b border-violet-100 dark:border-violet-900/20 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-300 hover:shadow-sm",
                isCurrent && "bg-violet-50/50 dark:bg-violet-900/10",
                isEditing && "bg-white dark:bg-slate-900 shadow-lg dark:shadow-black/50 z-10 my-2 -mx-2 md:mx-0 md:rounded-xl ring-1 ring-violet-500/20 dark:ring-violet-500/40 animate-in fade-in slide-in-from-top-2 duration-300"
            )}
        >
            {isCurrent && !isEditing && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-600 animate-pulse" />
            )}

            <div className={cn("p-4 sm:p-6 transition-all duration-300", isEditing && "sm:p-6 md:p-8")}>
                {isEditing ? (
                    <EditMode
                        subtitle={subtitle}
                        index={index}
                        onUpdate={onUpdate}
                        onSave={handleSave}
                        onAdjustTime={adjustTime}
                    />
                ) : (
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <div className="flex-grow space-y-2 relative">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSeek}
                                    className={cn(
                                        "font-mono text-xs px-2 py-0.5 rounded transition-all duration-200 hover:scale-105 active:scale-95",
                                        isCurrent
                                            ? "text-violet-600 dark:text-violet-400 font-medium bg-white dark:bg-slate-800 shadow-sm border border-violet-100 dark:border-violet-800 hover:shadow-md"
                                            : "text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-400"
                                    )}
                                >
                                    {subtitle.start} → {subtitle.end}
                                </button>
                                {isCurrent && (
                                    <span className="relative flex h-2 w-2 animate-in fade-in zoom-in duration-300">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-600 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-600" />
                                    </span>
                                )}
                            </div>
                            <p
                                onClick={handleEdit}
                                className={cn(
                                    "text-base sm:text-lg leading-relaxed cursor-text transition-colors duration-200",
                                    isCurrent
                                        ? "text-slate-900 dark:text-white font-medium"
                                        : "text-slate-700 dark:text-slate-300 font-normal hover:text-slate-900 dark:hover:text-white"
                                )}
                            >
                                {subtitle.text}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 md:self-center self-end animate-in fade-in slide-in-from-right-2">
                            <button
                                onClick={handleEdit}
                                className={cn(
                                    "p-2 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95",
                                    isCurrent
                                        ? "text-violet-600 bg-white dark:bg-slate-800 shadow-sm border border-violet-100 dark:border-violet-800 hover:bg-violet-600 hover:text-white hover:shadow-md"
                                        : "text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-400"
                                )}
                                title="Edit"
                            >
                                <Edit2 className="h-5 w-5" />
                            </button>
                            {!isCurrent && (
                                <button
                                    onClick={() => onDelete(index)}
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
                                    title="Delete"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}, (prev, next) =>
    prev.subtitle.text === next.subtitle.text &&
    prev.subtitle.start === next.subtitle.start &&
    prev.subtitle.end === next.subtitle.end &&
    prev.isCurrent === next.isCurrent &&
    prev.isEditing === next.isEditing
);

const EditMode = memo(({
    subtitle,
    index,
    onUpdate,
    onSave,
    onAdjustTime
}: {
    subtitle: SubtitleLine;
    index: number;
    onUpdate: (idx: number, field: keyof SubtitleLine, val: string) => void;
    onSave: () => void;
    onAdjustTime: (field: 'start' | 'end', delta: number) => void;
}) => {
    const [charCount, setCharCount] = useState(subtitle.text.length);

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Start</label>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => onAdjustTime('start', -0.1)}
                            className="p-1 hover:bg-violet-100 dark:hover:bg-violet-900/30 rounded transition-all duration-200 hover:scale-110 active:scale-95"
                            title="Decrease by 0.1s"
                        >
                            <ChevronDown className="h-3 w-3 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors" />
                        </button>
                        <input
                            type="text"
                            value={subtitle.start}
                            onChange={(e) => onUpdate(index, 'start', e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border-none rounded px-2 sm:px-3 py-1.5 font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-violet-500/30 dark:focus:ring-violet-500/30 focus:bg-white dark:focus:bg-slate-800 w-24 sm:w-32 outline-none transition-all duration-200"
                        />
                        <button
                            onClick={() => onAdjustTime('start', 0.1)}
                            className="p-1 hover:bg-violet-100 dark:hover:bg-violet-900/30 rounded transition-all duration-200 hover:scale-110 active:scale-95"
                            title="Increase by 0.1s"
                        >
                            <ChevronUp className="h-3 w-3 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors" />
                        </button>
                    </div>
                </div>
                <span className="text-slate-300 mt-4 hidden sm:inline">→</span>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">End</label>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => onAdjustTime('end', -0.1)}
                            className="p-1 hover:bg-violet-100 dark:hover:bg-violet-900/30 rounded transition-all duration-200 hover:scale-110 active:scale-95"
                            title="Decrease by 0.1s"
                        >
                            <ChevronDown className="h-3 w-3 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors" />
                        </button>
                        <input
                            type="text"
                            value={subtitle.end}
                            onChange={(e) => onUpdate(index, 'end', e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border-none rounded px-2 sm:px-3 py-1.5 font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-violet-500/30 dark:focus:ring-violet-500/30 focus:bg-white dark:focus:bg-slate-800 w-24 sm:w-32 outline-none transition-all duration-200"
                        />
                        <button
                            onClick={() => onAdjustTime('end', 0.1)}
                            className="p-1 hover:bg-violet-100 dark:hover:bg-violet-900/30 rounded transition-all duration-200 hover:scale-110 active:scale-95"
                            title="Increase by 0.1s"
                        >
                            <ChevronUp className="h-3 w-3 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="relative">
                <textarea
                    autoFocus
                    value={subtitle.text}
                    onChange={(e) => {
                        setCharCount(e.target.value.length);
                        onUpdate(index, 'text', e.target.value);
                    }}
                    className="w-full bg-transparent border-2 border-violet-600/30 dark:border-violet-500/50 rounded-lg p-3 sm:p-4 text-base sm:text-xl text-slate-900 dark:text-white focus:outline-none focus:border-violet-600 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:focus:ring-violet-500/20 transition-all duration-200 resize-none leading-relaxed placeholder-slate-300 dark:placeholder-slate-600 font-normal"
                    rows={3}
                    placeholder="Enter subtitle text..."
                />
                <span className="absolute right-2 sm:right-3 bottom-2 sm:bottom-3 text-xs text-slate-400">
                    {charCount} chars
                </span>
            </div>

            <div className="flex items-center justify-end gap-2 sm:gap-3 pt-2">
                <button
                    onClick={onSave}
                    className="px-4 sm:px-5 py-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    className="flex items-center gap-2 bg-black hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black px-4 sm:px-6 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                >
                    <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Done
                </button>
            </div>
        </div>
    );
}, (prev, next) =>
    prev.subtitle.text === next.subtitle.text &&
    prev.subtitle.start === next.subtitle.start &&
    prev.subtitle.end === next.subtitle.end
);
EditMode.displayName = 'EditMode';
