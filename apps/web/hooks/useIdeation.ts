"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { useSSE, type SSEEvent } from "./useSSE";
import { useSupabase } from "@/components/supabase-provider";
import type { IdeationResult, IdeationJob } from "@repo/validation";

interface CreateResponse {
  id: string;
  jobId: string;
  status: string;
  message: string;
}

interface ListResponse {
  data: IdeationJob[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_MESSAGES = (p: number, state: string): string => {
  if (state === "waiting" && p === 0) return "Preparing your ideation job...";
  if (p > 0 && p < 10) return "Loading channel intelligence...";
  if (p >= 10 && p < 25) return "Gathering trend signals...";
  if (p >= 25 && p < 45) return "Analyzing niche trends & competitors...";
  if (p >= 45 && p < 75) return "Synthesizing video ideas...";
  if (p >= 75 && p < 90) return "Running differentiation check...";
  if (p >= 90 && p < 100) return "Saving results...";
  return "Processing...";
};

export function useIdeation() {
  const { profile, profileLoading, fetchUserProfile, user } = useSupabase();

  const [context, setContext] = useState("");
  const [nicheFocus, setNicheFocus] = useState("");
  const [ideaCount, setIdeaCount] = useState(1);
  const [autoMode, setAutoMode] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [activeJobDbId, setActiveJobDbId] = useState<string | null>(null);

  const [generatedResult, setGeneratedResult] = useState<IdeationResult | null>(null);
  const [jobs, setJobs] = useState<IdeationJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  const aiTrained = profile?.ai_trained ?? false;
  const credits = profile?.credits ?? 0;
  const isLoadingProfile = profileLoading;

  const fetchJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const res = await api.get<ListResponse>("/api/v1/ideation?limit=20", { requireAuth: true });
      setJobs(res.data || []);
      return res.data || [];
    } catch (error) {
      toast.error("Failed to load ideation jobs", {
        description: getApiErrorMessage(error, "Please try again."),
      });
      return [];
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fetched = await fetchJobs();
      if (cancelled) return;

      const activeJob = fetched.find(
        (j: IdeationJob) => j.status === "pending" || j.status === "processing",
      );
      if (activeJob?.job_id) {
        setActiveJobDbId(activeJob.id);
        setJobId(activeJob.job_id);
        setIsGenerating(true);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchJobs]);

  const sse = useSSE<IdeationResult>({
    jobId,
    endpoint: "/api/v1/ideation/status",
    getStatusMessages: STATUS_MESSAGES,
    extractResult: (data: SSEEvent) => (data as any).result ?? null,
    onComplete: (result) => {
      if (result) {
        setGeneratedResult(result);
        toast.success("Ideas generated!", { description: `${result.ideas.length} ideas ready` });
        fetchJobs();
        if (user?.id) fetchUserProfile(user.id);
      }
    },
    onFailed: (error) => {
      let errorMessage = error;
      try {
        const parsed = JSON.parse(error);
        errorMessage = parsed.error?.message || parsed.message || error;
      } catch { /* use raw */ }
      toast.error("Ideation Failed", { description: errorMessage });
      setIsGenerating(false);
      setJobId(null);
    },
    onFinished: () => {
      setIsGenerating(false);
      setJobId(null);
    },
  });

  const handleGenerate = async (countOverride?: number) => {
    const effectiveCount = countOverride ?? ideaCount;
    setIsGenerating(true);
    setGeneratedResult(null);

    try {
      const response = await api.post<CreateResponse>(
        "/api/v1/ideation",
        {
          context: context.trim() || undefined,
          nicheFocus: nicheFocus.trim() || undefined,
          ideaCount: effectiveCount,
          autoMode,
        },
        { requireAuth: true },
      );

      setActiveJobDbId(response.id);
      setJobId(response.jobId);
      toast.success("Ideation started!", { description: response.message });
    } catch (error: unknown) {
      toast.error("Ideation Failed", {
        description: getApiErrorMessage(error, "Failed to start ideation."),
      });
      setIsGenerating(false);
      setJobId(null);
    }
  };

  const handleDeleteJob = useCallback(async (id: string) => {
    try {
      await api.delete(`/api/v1/ideation/${id}`, { requireAuth: true });
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast.success("Job deleted");
    } catch (error: unknown) {
      toast.error("Delete failed", {
        description: getApiErrorMessage(error, "Failed to delete job."),
      });
    }
  }, []);

  const clearForm = () => {
    setContext("");
    setNicheFocus("");
    setIdeaCount(1);
    setAutoMode(false);
    setGeneratedResult(null);
  };

  return {
    context, setContext,
    nicheFocus, setNicheFocus,
    ideaCount, setIdeaCount,
    autoMode, setAutoMode,
    isGenerating,
    progress: sse.progress,
    statusMessage: sse.statusMessage,
    generatedResult,
    activeJobDbId,
    jobs, isLoadingJobs,
    aiTrained, credits, isLoadingProfile,
    handleGenerate,
    handleDeleteJob,
    clearForm,
    fetchJobs,
  };
}
