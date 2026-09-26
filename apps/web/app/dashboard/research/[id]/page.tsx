"use client";

import { useEffect, useState } from "react";
import * as motion from "motion/react-m";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@repo/ui/button";
import { Card, CardContent } from "@repo/ui/card";
import { Skeleton } from "@repo/ui/skeleton";
import { ArrowLeft, Sparkles, Clock, Coins, BarChart3 } from "lucide-react";
import IdeaCard from "@/components/dashboard/research/IdeaCard";
import IdeationExportMenu from "@/components/dashboard/research/IdeationExportMenu";
import PremiumGateModal from "@/components/dashboard/research/PremiumGateModal";
import { useCurrentPlan } from "@/hooks/useCurrentPlan";
import { api } from "@/lib/api-client";
import type { IdeationJob } from "@repo/validation";

export default function IdeationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [job, setJob] = useState<IdeationJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const { hasComparisonMetrics } = useCurrentPlan();

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await api.get<IdeationJob>(`/api/v1/ideation/${id}`, { requireAuth: true });
        setJob(data);
      } catch (error: any) {
        toast.error("Error loading ideation", { description: error.message });
        router.push("/dashboard/research");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) {
    return (
      <div className="container py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-full max-w-96" />
        <div className="space-y-4 sm:space-y-6 mt-8">
          <Skeleton className="h-72 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!job) return null;

  const result = job.result;

  if (job.status === "failed") {
    return (
      <div className="container py-8">
        <Link href="/dashboard/research" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Ideation
        </Link>
        <Card className="border-red-200 dark:border-red-800/40">
          <CardContent className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400 font-medium mb-2">Ideation failed</p>
            <p className="text-sm text-slate-500">{job.error_message || "An unknown error occurred"}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard/research/new")}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (job.status !== "completed" || !result) {
    return (
      <div className="container py-8">
        <Link href="/dashboard/research" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Ideation
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600 dark:text-slate-300 font-medium mb-2">This job is still {job.status}</p>
            <p className="text-sm text-slate-400">Please wait for it to complete.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      className="container py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Link href="/dashboard/research" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Ideation
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 break-words">
            {job.niche_focus || (job.auto_mode ? "Auto-generated Ideas" : "Ideation Results")}
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {new Date(job.created_at).toLocaleDateString()}</span>
            <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {result.ideas.length} ideas</span>
            {result.metadata?.creditsConsumed && (
              <span className="flex items-center gap-1"><Coins className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {result.metadata.creditsConsumed} credits</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {result.ideas.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 flex-1 sm:flex-none text-xs sm:text-sm border-slate-200 dark:border-slate-700 hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-500/10 dark:hover:text-purple-300"
              onClick={() => {
                if (hasComparisonMetrics) {
                  router.push(`/dashboard/research/${job.id}/metrics`);
                } else {
                  setPremiumOpen(true);
                }
              }}
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              <span className="sm:hidden">Metrics</span>
              <span className="hidden sm:inline">Comparison metrics</span>
            </Button>
          )}
          <IdeationExportMenu ideationId={job.id} />
          <Button
            size="sm"
            onClick={() => router.push("/dashboard/research/new")}
            className="h-9 flex-1 sm:flex-none text-xs sm:text-sm bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-50 dark:hover:bg-slate-200 dark:text-slate-900 transition-all hover:shadow-lg hover:shadow-purple-500/10"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> New Ideation
          </Button>
        </div>
      </div>

      <main className="w-full space-y-4 sm:space-y-6">
        {result.ideas.map((idea, index) => (
          <IdeaCard key={idea.id || index} idea={idea} index={index} ideationId={job.id} />
        ))}
      </main>

      <PremiumGateModal
        open={premiumOpen}
        onClose={() => setPremiumOpen(false)}
        featureLabel="Comparison metrics"
      />
    </motion.div>
  );
}
