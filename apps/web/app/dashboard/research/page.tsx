"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Badge } from "@repo/ui/badge";
import { toast } from "sonner";
import { Search, Plus, Trash2, Download, MoreHorizontal, ExternalLink, Loader2 } from "lucide-react";
import { Card } from "@repo/ui/card";
import { EmptySvg } from "@/components/dashboard/common/EmptySvg";
import ContentCardSkeleton from "@/components/dashboard/common/skeleton/ContentCardSkeleton";
import { motion } from "motion/react";
import { useSupabase } from "@/components/supabase-provider";
import { downloadBlob } from "@/lib/download";
import { api, ApiClientError } from "@/lib/api-client";
import type { IdeationJob } from "@repo/validation";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@repo/ui/alert-dialog";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function IdeationListPage() {
  const [jobs, setJobs] = useState<IdeationJob[]>([]);
  const { profileLoading } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ data: IdeationJob[] }>("/api/v1/ideation?limit=50", { requireAuth: true });
        setJobs(res.data || []);
      } catch (error: unknown) {
        const msg = error instanceof ApiClientError ? error.message : "An unexpected error occurred";
        toast.error("Error fetching ideation jobs", { description: msg });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async () => {
    if (!jobToDelete) return;
    try {
      await api.delete(`/api/v1/ideation/${jobToDelete}`, { requireAuth: true });
      setJobs((prev) => prev.filter((j) => j.id !== jobToDelete));
      toast.success("Ideation job deleted");
    } catch (error: unknown) {
      const msg = error instanceof ApiClientError ? error.message : "Failed to delete";
      toast.error("Error", { description: msg });
    } finally {
      setJobToDelete(null);
    }
  };

  const handleExportPdf = async (id: string) => {
    try {
      const blob = await api.get<Blob>(`/api/v1/ideation/${id}/export/pdf`, {
        requireAuth: true,
        responseType: "blob",
      });
      downloadBlob(blob, `ideation_${id}.pdf`);
    } catch {
      toast.error("Export failed");
    }
  };

  const filteredJobs = jobs.filter((j) => {
    const q = searchQuery.toLowerCase();
    return (j.niche_focus || "").toLowerCase().includes(q) ||
      j.status.toLowerCase().includes(q);
  });

  if (profileLoading || loading) return <ContentCardSkeleton />;

  return (
    <div className="container py-8 md:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Ideation</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            AI-powered video idea generation with trend intelligence
          </p>
        </div>
        <Link href="/dashboard/research/new">
          <Button className="bg-slate-900 hover:bg-slate-800 text-white transition-all hover:shadow-lg hover:shadow-purple-500/10">
            <Plus className="mr-2 h-4 w-4" />
            Generate Ideas
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by niche or status..."
            className="pl-12 py-6 text-base focus:border-purple-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredJobs.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filteredJobs.map((job) => (
            <IdeationJobCard
              key={job.id}
              job={job}
              onDelete={handleDelete}
              setToDelete={setJobToDelete}
              onExport={handleExportPdf}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-20">
          <div className="flex flex-col items-center">
            <EmptySvg className="h-32 w-auto mb-6 text-slate-300 dark:text-slate-700" />
            <h3 className="font-semibold text-xl text-slate-800 dark:text-slate-200 mb-2">
              {searchQuery ? "No results found" : "Generate your first batch of ideas"}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              {searchQuery
                ? `No ideation jobs match "${searchQuery}".`
                : "Our AI engine analyzes trends, your channel DNA, and niche gaps to generate high-potential video ideas."}
            </p>
            {!searchQuery && (
              <Link href="/dashboard/research/new">
                <Button className="bg-slate-900 hover:bg-slate-800 text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Ideas
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function IdeationJobCard({ job, onDelete, setToDelete, onExport }: {
  job: IdeationJob;
  onDelete: () => Promise<void>;
  setToDelete: (id: string | null) => void;
  onExport: (id: string) => Promise<void>;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const date = new Date(job.created_at).toLocaleDateString();
  const ideaCount = job.result?.ideas?.length || job.idea_count;
  const linkHref = job.status === "completed" ? `/dashboard/research/${job.id}` : "#";

  const handleExport = async () => {
    if (job.status !== "completed") return;
    setIsExporting(true);
    try {
      await onExport(job.id);
    } finally {
      setIsExporting(false);
    }
  };

  const openDeleteDialog = () => {
    setToDelete(job.id);
    setMenuOpen(false);
    setDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDialogOpen(false);
    setToDelete(null);
  };

  const handleConfirmDelete = async () => {
    setDialogOpen(false);
    await onDelete();
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setToDelete(null);
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      whileHover={{ scale: 1.005 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card className="group relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 hover:shadow-lg hover:shadow-purple-500/5">
        <Link href={linkHref} className="block p-3.5 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 bg-purple-50 dark:bg-purple-900/20 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-center min-w-[44px] sm:min-w-[52px]">
              <span className="text-base sm:text-lg font-bold text-purple-600 dark:text-purple-400 leading-none">{ideaCount}</span>
              <span className="block text-[9px] sm:text-[10px] font-medium text-purple-500/70 dark:text-purple-400/60">
                {ideaCount === 1 ? "idea" : "ideas"}
              </span>
            </div>
            <div className="flex-grow min-w-0">
              <h3 className="font-semibold text-base sm:text-lg text-slate-800 dark:text-slate-100 truncate">
                {job.niche_focus || (job.auto_mode ? "AI Curated ideas" : "Custom ideation")}
              </h3>
              <div className="mt-1 sm:mt-1.5 flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                <span>{date}</span>
                <Badge variant="secondary" className={`text-[10px] sm:text-xs ${STATUS_COLORS[job.status] || ""}`}>
                  {job.status}
                </Badge>
                {job.credits_consumed > 0 && (
                  <span className="text-[10px] sm:text-xs">{job.credits_consumed} credits</span>
                )}
              </div>
            </div>
          </div>
        </Link>

        <div className="absolute top-4 right-4 z-10">
          <AlertDialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  className="h-8 w-8 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                {job.status === "completed" && (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => (window.location.href = `/dashboard/research/${job.id}`)}>
                    <ExternalLink className="mr-2 h-4 w-4" /> View
                  </DropdownMenuItem>
                )}
                {job.status === "completed" && (
                  isExporting ? (
                    <DropdownMenuItem disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={handleExport} className="cursor-pointer">
                      <Download className="mr-2 h-4 w-4" /> Export PDF
                    </DropdownMenuItem>
                  )
                )}
                <DropdownMenuItem
                  className="text-red-500 focus:text-red-500 cursor-pointer"
                  onClick={openDeleteDialog}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this ideation job?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete this ideation and all generated ideas.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDeleteDialog}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>
    </motion.div>
  );
}
