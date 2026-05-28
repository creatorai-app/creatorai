"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import { ArrowLeft, BarChart3, Lock } from "lucide-react";
import ComparisonMetricsView from "@/components/dashboard/research/ComparisonMetricsView";
import PremiumGateModal from "@/components/dashboard/research/PremiumGateModal";
import { useCurrentPlan } from "@/hooks/useCurrentPlan";
import { api } from "@/lib/api-client";
import type { IdeationJob } from "@repo/validation";

export default function IdeationMetricsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { hasComparisonMetrics, loading: planLoading } = useCurrentPlan();
  const [job, setJob] = useState<IdeationJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [premiumOpen, setPremiumOpen] = useState(false);

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

  useEffect(() => {
    if (!planLoading && !hasComparisonMetrics) {
      setPremiumOpen(true);
    }
  }, [planLoading, hasComparisonMetrics]);

  if (loading || planLoading) {
    return (
      <div className="container max-w-5xl py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!hasComparisonMetrics) {
    return (
      <div className="container max-w-5xl py-8">
        <Link
          href={`/dashboard/research/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to results
        </Link>
        <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Lock className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300 font-medium">Comparison metrics require Creator+ or Enterprise</p>
          <Button variant="outline" className="mt-4" onClick={() => setPremiumOpen(true)}>
            View plans
          </Button>
        </div>
        <PremiumGateModal
          open={premiumOpen}
          onClose={() => router.push(`/dashboard/research/${id}`)}
          featureLabel="Comparison metrics"
        />
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
