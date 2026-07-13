"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { toast } from "sonner"
import { Plus, Search } from "lucide-react"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { VideoGenerationHistory } from "@/components/dashboard/video-generation/VideoGenerationHistory"
import type { VideoGenerationJob } from "@/hooks/useVideoGeneration"

export default function VideoGenerationHistoryPage() {
  const [jobs, setJobs] = useState<VideoGenerationJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState("")

  const fetchJobs = async () => {
    setIsLoading(true)
    try {
      const data = await api.get<{ jobs: VideoGenerationJob[] }>('/api/v1/video-generation', { requireAuth: true })
      setJobs(data.jobs ?? [])
    } catch (error) {
      toast.error("Failed to load videos", { description: getApiErrorMessage(error, "Please try again.") })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchJobs() }, [])

  const filtered = jobs.filter((j) => {
    const q = query.toLowerCase()
    return j.prompt.toLowerCase().includes(q) || j.status.toLowerCase().includes(q) || j.mode.toLowerCase().includes(q)
  })

  return (
    <motion.div
      className="container py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Videos</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Manage all your generated video clips</p>
        </div>
        <Link href="/dashboard/video-generation">
          <Button className="bg-slate-900 hover:bg-slate-800 text-white transition-all hover:shadow-lg hover:shadow-purple-500/10 dark:hover:shadow-purple-400/10">
            <Plus className="mr-2 h-4 w-4" />
            New Video
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <Input
            placeholder="Search by prompt, mode, or status..."
            className="pl-10 focus-visible:ring-2 focus-visible:ring-purple-500/80"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <VideoGenerationHistory jobs={filtered} isLoading={isLoading} onChanged={fetchJobs} />
    </motion.div>
  )
}
