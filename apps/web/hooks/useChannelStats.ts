"use client";

import { useState, useCallback } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";
import { ChannelStats } from "@repo/validation";



export function useChannelStats() {
    const [stats, setStats] = useState<ChannelStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);


    const fetchStats = useCallback(async (forceSync = false) => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.get<ChannelStats>(`/api/v1/youtube/channel-stats?forceSync=${forceSync}`, {
                requireAuth: true,

            });
            setStats(data);
        } catch (err) {
            const message =
                err instanceof ApiClientError ? err.message : "Failed to load channel stats";
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    return { stats, loading, error, fetchStats };
}