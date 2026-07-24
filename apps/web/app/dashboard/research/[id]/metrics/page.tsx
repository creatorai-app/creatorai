"use client";

import { useEffect, useState } from "react";
import * as motion from "motion/react-m";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import { ArrowLeft, BarChart3 } from "lucide-react";
import ComparisonMetricsView from "@/components/dashboard/research/ComparisonMetricsView";
import { api } from "@/lib/api-client";
import type { IdeationJob } from "@repo/validation";

export default function IdeationMetricsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [job, setJob] = useState<IdeationJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await api.get<IdeationJob>(`/api/v1/ideation/${id}`, { requireAuth: true });
        setJob(data);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to load";
        toast.error("Error loading ideation", { description: message });
        router.push("/dashboard/research");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) {
    return (
      <div className="container max-w-5xl py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!job?.result || job.status !== "completed") {
    return (
      <div className="container max-w-5xl py-8">
        <p className="text-slate-500">Results not available yet.</p>
        <Button variant="link" className="mt-2 px-0" onClick={() => router.push(`/dashboard/research/${id}`)}>
          Back to ideation
        </Button>
      </div>
    );
  }

  const trendSnapshot = job.result.trendSnapshot ?? job.trend_snapshot;

  return (
    <motion.div
      className="container max-w-5xl py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Link
        href={`/dashboard/research/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to results
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
          <BarChart3 className="h-5 w-5" />
          <span className="text-sm font-medium">Comparison metrics</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Trends & keywords
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Compare opportunity scores, keywords, and niche trends across your generated ideas.
        </p>
      </div>

      <ComparisonMetricsView
        ideas={job.result.ideas}
        trendSnapshot={trendSnapshot}
        channelFit={job.result.channelFit}
      />
    </motion.div>
  );
}
