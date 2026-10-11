import { useState } from 'react';
import { toast } from 'sonner';
import { useSupabase } from "@/components/supabase-provider";
import { api, getApiErrorMessage } from '@/lib/api-client';
import { useSSE } from './useSSE';

export function useSubtitleGeneration(
    id: string,
    videoDuration: number | null,
    refetchData: () => Promise<void>
) {
    const [jobId, setJobId] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const { user, fetchUserProfile } = useSupabase();

    // Generation runs in the `subtitle` worker, so the page follows the job over SSE
    // instead of holding a request open for the length of the video.
    const { isActive, progress, statusMessage } = useSSE({
        jobId,
        endpoint: '/api/v1/subtitle/status',
        onComplete: async () => {
            toast.success('Subtitles ready!');
            await refetchData();
            if (user?.id) await fetchUserProfile(user.id);
        },
        onFailed: (error) => {
            toast.error('Subtitle generation failed', { description: error });
            void refetchData();
        },
        onFinished: () => setJobId(null),
    });

    const handleGenerate = async (language: string, targetLanguage: string) => {
        setIsStarting(true);
        try {
            const res = await api.post<{ success: boolean; jobId: string; message?: string }>(
                '/api/v1/subtitle',
                {
                    duration: videoDuration,
                    language,
                    targetLanguage,
                    subtitleId: id,
                },
                { requireAuth: true }
            );

            if (!res.success || !res.jobId) {
                throw new Error(res.message || 'Subtitle generation failed to start.');
            }
            setJobId(res.jobId);
            await refetchData();
        } catch (error) {
            toast.error("Subtitle generation failed", {
                description: getApiErrorMessage(error, 'Please try again.'),
            });
        } finally {
            setIsStarting(false);
        }
    };

    const handleCancel = async () => {
        if (!jobId) return;
        try {
            await api.post(`/api/v1/subtitle/cancel/${jobId}`, undefined, { requireAuth: true });
            toast.info('Subtitle generation cancelled');
            setJobId(null);
            await refetchData();
        } catch (error) {
            toast.error('Failed to cancel', {
                description: getApiErrorMessage(error, 'Please try again.'),
            });
        }
    };

    return {
        isGenerating: isStarting || isActive,
        progress,
        statusMessage,
        handleGenerate,
        handleCancel,
    };
}
