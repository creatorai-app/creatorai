"use client"

import { useState, useEffect } from "react";
import * as motion from "motion/react-m";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Badge } from "@repo/ui/badge";
import { toast } from "sonner";
import { useSupabase } from "@/components/supabase-provider";
import { Plus, Search } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { ContentCard } from "@/components/dashboard/common/ContentCard";
import ContentCardSkeleton from "@/components/dashboard/common/skeleton/ContentCardSkeleton";
import { EmptySvg } from "@/components/dashboard/common/EmptySvg";
import {
  getStoryBuilderJobs,
  deleteStoryBuilderJob,
  type StoryBuilderJob,
} from "@/lib/api/getStoryBuilderJobs"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
}

const emptyStateVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4 },
  },
}

export default function StoryBuilderListPage() {
  const { profileLoading } = useSupabase()
  const [jobs, setJobs] = useState<StoryBuilderJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [jobToDelete, setJobToDelete] = useState<string | null>(null)

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true)
      const fetched = await getStoryBuilderJobs()
      setJobs(fetched.filter(j => j.status === "completed"))
      setLoading(false)
    }
    fetchJobs()
  }, [])

  const handleDeleteJob = async () => {
    if (!jobToDelete) return
    const success = await deleteStoryBuilderJob(jobToDelete)
    if (success) {
      setJobs(jobs.filter(j => j.id !== jobToDelete))
      toast.success("Blueprint deleted", { description: "Your story blueprint has been deleted." })
    } else {
      toast.error("Error deleting blueprint", { description: "Could not delete. Please try again." })
    }
    setJobToDelete(null)
  }

  if (profileLoading || loading) {
    return <ContentCardSkeleton />
  }

  const filteredJobs = jobs.filter(j =>
    (j.video_topic ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <motion.div
      className="container py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Story Blueprints</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage all your generated story blueprints
          </p>
        </div>
        <Link href="/dashboard/story-builder/new">
          <Button className="bg-slate-900 hover:bg-slate-800 text-white transition-all hover:shadow-lg hover:shadow-purple-500/10 dark:hover:shadow-purple-400/10">
            <Plus className="mr-2 h-4 w-4" />
            New Blueprint
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <Input
            placeholder="Search blueprints..."
            className="pl-10 focus-visible:ring-2 focus-visible:ring-purple-500/80"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {filteredJobs.length > 0 ? (
          <motion.div
            key="job-list"
            className="grid grid-cols-1 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredJobs.map(job => (
              <ContentCard
                key={job.id}
                id={job.id}
                title={job.video_topic}
                created_at={job.created_at}
                onDelete={handleDeleteJob}
                setToDelete={setJobToDelete}
                type="story-builder"
                statusBadge={
                  job.result?.tensionMapping ? (
                    <Badge variant="outline" className="text-xs">
                      Score: {job.result.tensionMapping.retentionScore}/10
                    </Badge>
                  ) : undefined
                }
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="empty-state"
            variants={emptyStateVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="text-center py-16">
              <div className="flex flex-col items-center">
                <EmptySvg className="h-32 w-auto mb-6 text-slate-300 dark:text-slate-700" />
                <h3 className="font-semibold text-xl text-slate-800 dark:text-slate-200 mb-2">
                  Build your first story blueprint
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                  {searchQuery
                    ? `No blueprints matching "${searchQuery}".`
                    : "Create structured story blueprints with hooks, escalation, and retention scoring."}
                </p>
                {!searchQuery && (
                  <Link href="/dashboard/story-builder/new">
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white transition-all">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Blueprint
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
