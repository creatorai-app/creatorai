import { useState } from 'react';
import { toast } from 'sonner';
import { SubtitleLine } from "@repo/validation";
import { parseSRT } from '@/utils/srtUtils';
import { convertJsonToSrt } from '@repo/validation';
import { api, getApiErrorMessage } from '@/lib/api-client';
import { downloadFile, downloadBlob } from '@/lib/download';

export function useSubtitleFileOperations(
    id: string,
    subtitles: SubtitleLine[],
    setSubtitles: (subtitles: SubtitleLine[]) => void,
    videoPath?: string,
    videoUrl?: string
) {
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!id) return;
        setIsSaving(true);
        try {
            const res = await api.patch<{ success: boolean, message: string, subtitles: SubtitleLine[] }>(`/api/v1/subtitle/${id}`, {
                subtitle_json: subtitles,
            }, {
                requireAuth: true,
            });
            if (!res.success) throw new Error(res.message || 'Save failed');
            setSubtitles(res.subtitles);
            toast.success('Saved successfully!');
        } catch (error) {
            toast.error('Failed to save subtitles', {
                description: getApiErrorMessage(error, 'Please try again.'),
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = () => {
        const srt = convertJsonToSrt(subtitles);
        if (!srt) return;
        const baseName = (videoPath || 'subtitles').split('/').pop()?.replace(/\.[^/.]+$/, '') ?? 'subtitles';
        downloadBlob(new Blob([srt], { type: 'text/plain' }), `${baseName}.srt`);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                try {
                    const parsed = parseSRT(content);
                    if (parsed.length === 0) {
                        throw new Error("Could not find any valid subtitle blocks.");
                    }
                    setSubtitles(parsed);
                    toast.success(`Uploaded and parsed ${parsed.length} subtitle lines.`);
                } catch (err) {
                    const message = err instanceof Error ? err.message : "Unknown parsing error";
                    toast.error(`Failed to parse SRT file: ${message}`);
                }
            } else {
                toast.error("File is empty or could not be read.");
            }
        };
        reader.onerror = () => toast.error("An error occurred while reading the file.");
        reader.readAsText(file);
        e.target.value = '';
    };

    const [downloadVideoLoading, setDownloadVideoLoading] = useState(false);

    const handleDownloadVideo = async () => {
        if (!videoUrl || !subtitles || subtitles.length === 0) {
            toast.error('Video URL and subtitles are required');
            return;
        }

        setDownloadVideoLoading(true);
        try {
            const blob = await api.post<Blob>(
                '/api/v1/subtitle/burn',
                { videoUrl, subtitles },
                { requireAuth: true, responseType: 'blob' },
            );

            downloadBlob(blob, "video_with_subs.mp4");
            toast.success('Video downloaded successfully!');
        } catch (error) {
            toast.error('Failed to process video', {
                description: getApiErrorMessage(error, 'Please try again.'),
            });
        } finally {
            setDownloadVideoLoading(false);
        }
    };

    return {
        isSaving,
        handleSave,
        handleDownload,
        handleFileUpload,
        handleDownloadVideo,
        downloadVideoLoading,
    };
}