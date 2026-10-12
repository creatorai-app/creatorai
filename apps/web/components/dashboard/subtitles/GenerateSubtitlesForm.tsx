"use client";

import React, { useEffect, useState } from 'react';
import { Button } from "@repo/ui/button";
import { Label } from "@repo/ui/label";
import { Loader2, Sparkles, Clock, Zap, Globe, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { subtitleLanguages, SUBTITLE_AUTO_DETECT, SUBTITLE_NO_TRANSLATION } from "@repo/validation";
import { LanguagePicker } from "@/components/dashboard/common/LanguagePicker";

type GenerateSubtitlesFormProps = {
    isGenerating: boolean;
    videoDuration: number | null;
    onGenerate: (sourceLanguage: string, targetLanguage: string) => void;
    /** Live job progress from the worker, 0-100. */
    progress?: number;
    statusMessage?: string;
};

const sourceLanguages = [
    { value: SUBTITLE_AUTO_DETECT, label: 'Auto Detect (Recommended)' },
    ...subtitleLanguages,
];

const targetLanguages = [
    { value: SUBTITLE_NO_TRANSLATION, label: 'Same as Source (No Translation)' },
    ...subtitleLanguages,
];

export function GenerateSubtitlesForm({
    isGenerating,
    videoDuration,
    onGenerate,
    progress = 0,
    statusMessage,
}: GenerateSubtitlesFormProps) {
    const [sourceLanguage, setSourceLanguage] = useState(SUBTITLE_AUTO_DETECT);
    const [targetLanguage, setTargetLanguage] = useState(SUBTITLE_NO_TRANSLATION);

    // Calculate estimates
    const getEstimatedTime = () => {
        if (!videoDuration) return null;
        const minutes = Math.ceil(videoDuration / 60);
        return Math.max(1, Math.ceil(minutes * 0.3));
    };

    const estimatedTime = getEstimatedTime();
    const isTranslating = targetLanguage !== SUBTITLE_NO_TRANSLATION;

    // Smart logic for language hints
    useEffect(() => {
        if (sourceLanguage !== SUBTITLE_AUTO_DETECT && targetLanguage !== SUBTITLE_NO_TRANSLATION && sourceLanguage === targetLanguage) {
            toast.info("Tip: You selected the same language for Source and Target. Switched to 'Same as Source' for better accuracy.");
            setTargetLanguage(SUBTITLE_NO_TRANSLATION);
        }
    }, [sourceLanguage, targetLanguage]);

    const handleSubmit = async () => {
        if (!videoDuration || videoDuration <= 0) {
            toast.error("Video metadata loading...");
            return;
        }
        if (videoDuration > 1200) {
            toast.warning("Long video detected. This might take a while.");
        }
        onGenerate(sourceLanguage, targetLanguage);
    };

    return (
        <div className="w-full space-y-6">

            {/* --- INPUTS SECTION --- */}
            <div className="space-y-5">

                {/* 1. Video Language */}
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        Video Language
                    </Label>
                    <LanguagePicker
                        value={sourceLanguage}
                        onChange={setSourceLanguage}
                        options={sourceLanguages}
                        placeholder="Select video language"
                        ariaLabel="Video language"
                        disabled={isGenerating}
                        className="h-12 bg-slate-50 dark:bg-slate-800 border-0 rounded-xl shadow-sm font-medium"
                    />
                </div>

                {/* 2. Subtitle Language */}
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <Languages className="w-3.5 h-3.5 text-slate-400" />
                        Subtitle Language
                    </Label>
                    <LanguagePicker
                        value={targetLanguage}
                        onChange={setTargetLanguage}
                        options={targetLanguages}
                        placeholder="Select subtitle language"
                        ariaLabel="Subtitle language"
                        disabled={isGenerating}
                        className="h-12 bg-slate-50 dark:bg-slate-800 border-0 rounded-xl shadow-sm font-medium"
                    />
                </div>
            </div>

            {/* --- INFO PILLS --- */}
            <div className="flex items-center gap-3 py-1">
                {/* Time Estimate */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                    <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {estimatedTime ? `~${estimatedTime} mins` : 'calculating...'}
                    </span>
                </div>


            </div>

            {/* --- ACTION BUTTON --- */}
            <div className="pt-2">
                <Button
                    onClick={handleSubmit}
                    disabled={isGenerating || !videoDuration || videoDuration <= 0}
                    className="w-full h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-xl font-bold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Thinking...
                        </>
                    ) : (
                        <>
                            <Sparkles className="mr-2 h-5 w-5" />
                            Generate Subtitles
                        </>
                    )}
                </Button>

                {isGenerating && (
                    <div className="mt-3 space-y-2">
                        <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Subtitle generation progress"
                        >
                            <div
                                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                                style={{ width: `${Math.max(progress, 5)}%` }}
                            />
                        </div>
                        <p className="text-xs text-center text-slate-400">
                            {statusMessage || `This usually takes about ${estimatedTime || 1} minute(s).`}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}