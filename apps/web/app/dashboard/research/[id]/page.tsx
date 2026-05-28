"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
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
        <Skeleton className="h-6 w-96" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
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
        <div className="flex flex-wrap gap-2">
          {result.ideas.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (hasComparisonMetrics) {
                  router.push(`/dashboard/research/${job.id}/metrics`);
                } else {
                  setPremiumOpen(true);
                }
              }}
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              Comparison metrics
            </Button>
          )}
          <IdeationExportMenu ideationId={job.id} />
          <Button
            onClick={() => router.push("/dashboard/research/new")}
            className="text-xs sm:text-sm bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-50 dark:hover:bg-slate-200 dark:text-slate-900"
          >
            <Sparkles className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> New Ideation
          </Button>
        </div>
      </div>

      <main className="max-w-3xl space-y-6">
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
