"use client"

import { useState, useEffect } from "react";
import * as motion from "motion/react-m";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Input } from "@repo/ui/input";
import { toast } from "sonner";
import { useSupabase } from "@/components/supabase-provider";
import { Plus, Search } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { ContentCard } from "@/components/dashboard/common/ContentCard";
import ContentCardSkeleton from "@/components/dashboard/common/skeleton/ContentCardSkeleton";
import { EmptySvg } from "@/components/dashboard/common/EmptySvg";
import { getDubbings, deleteDubbing, DubbingProject } from "@/lib/api/getDubbings";
import { dubLanguageLabel } from "@repo/validation"

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

function languageNames(project: DubbingProject): string {
  return project.languages.map(dubLanguageLabel).join(", ")
}

function formatTitle(project: DubbingProject): string {
  const languages = languageNames(project)
  if (project.media_name) return languages ? `${project.media_name} (${languages})` : project.media_name
  const type = project.is_video ? "Video" : "Audio"
  return `${type} dubbed to ${languages}`
}

export default function DubbingList() {
  const { session } = useSupabase()
  const [dubbings, setDubbings] = useState<DubbingProject[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [dubbingToDelete, setDubbingToDelete] = useState<string | null>(null)

  useEffect(() => {
    const fetchDubbings = async () => {
      setLoading(true)
      const data = await getDubbings(session?.access_token)
      setDubbings(data)
      setLoading(false)
    }

    if (session?.access_token) {
      fetchDubbings()
    } else if (session === null) {
      setLoading(false)
    }
  }, [session])

  const handleDeleteDubbing = async () => {
    if (!dubbingToDelete) return

    const success = await deleteDubbing(dubbingToDelete, session?.access_token)

    if (success) {
      setDubbings(dubbings.filter((d) => d.project_id !== dubbingToDelete))
      toast.success("Dubbing deleted", {
        description: "Your dubbed media has been deleted successfully.",
      })
    } else {
      toast.error("Error deleting dubbing", {
        description: "Could not delete the dubbed media. Please try again.",
      })
    }
    setDubbingToDelete(null)
  }

  if (loading) {
    return <ContentCardSkeleton />
  }

  const filteredDubbings = dubbings.filter((d) => {
    const query = searchQuery.toLowerCase()
    const title = formatTitle(d).toLowerCase()
    return (
      title.includes(query) ||
      d.languages.some((code) => code.toLowerCase().includes(query)) ||
      (d.media_name?.toLowerCase().includes(query) ?? false)
    )
  })

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Dubbings</h1>
            <p className="hidden sm:block text-slate-600 dark:text-slate-400 mt-1">
              Manage all your dubbed audio and video files
            </p>
          </div>
          <Button
            className="shrink-0 px-3 sm:px-4 bg-slate-900 hover:bg-slate-800 text-white transition-all hover:shadow-lg hover:shadow-purple-500/10 dark:hover:shadow-purple-400/10"
            asChild
          >
            <Link href="/dashboard/dubbing/new">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">New Dubbing</span>
            </Link>
          </Button>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <Input
              placeholder="Search dubbings by name or language..."
              className="pl-10 focus-visible:ring-2 focus-visible:ring-purple-500/80"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {filteredDubbings.length > 0 ? (
            <motion.div
              key="dubbing-list"
              className="grid grid-cols-1 gap-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {filteredDubbings.map((dubbing) => (
                <ContentCard
                  key={dubbing.project_id}
                  id={dubbing.project_id}
                  title={formatTitle(dubbing)}
                  created_at={dubbing.created_at}
                  onDelete={handleDeleteDubbing}
                  setToDelete={setDubbingToDelete}
                  type="dubbing"
                  statusBadge={
                    <>
                      {dubbing.dub_count > 1 && (
                        <Badge variant="outline" className="text-xs">{dubbing.dub_count} dubs</Badge>
                      )}
                      {dubbing.status === "uploading" || (dubbing.status !== "completed" && dubbing.video_status === "uploading") ? (
                        <Badge variant="outline" className="text-xs">Upload unfinished</Badge>
                      ) : dubbing.status === "awaiting_video" ? (
                        <Badge variant="outline" className="text-xs">Waiting for video</Badge>
                      ) : dubbing.status === "failed" ? (
                        <Badge variant="outline" className="text-xs text-red-600 dark:text-red-400">Failed</Badge>
                      ) : null}
                    </>
                  }
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty-state-illustrated"
              variants={emptyStateVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="text-center py-16">
                <div className="flex flex-col items-center">
                  <EmptySvg className="h-32 w-auto mb-6 text-slate-300 dark:text-slate-700" />
                  <h3 className="font-semibold text-xl text-slate-800 dark:text-slate-200 mb-2">
                    No dubbed media yet
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    {searchQuery
                      ? `We couldn't find a dubbing matching "${searchQuery}".`
                      : "Dub your first audio or video into another language with AI."}
                  </p>
                  {!searchQuery && (
                    <Button
                      className="bg-slate-900 hover:bg-slate-800 text-white transition-all"
                      asChild
                    >
                      <Link href="/dashboard/dubbing/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Dubbing
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}