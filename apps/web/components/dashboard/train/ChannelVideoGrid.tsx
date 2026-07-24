"use client"

import { useEffect, useState, useMemo } from "react";
import * as motion from "motion/react-m";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Loader2, RefreshCw, Upload, CheckCircle2, Eye, Search } from "lucide-react";
import { useChannelVideos, type ChannelVideo } from "@/hooks/useChannelVideos"

function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toString()
}

function VideoCard({
  video,
  selected,
  onToggle,
}: {
  video: ChannelVideo
  selected: boolean
  onToggle: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={onToggle}
      className={`
        relative cursor-pointer rounded-lg border overflow-hidden transition-all duration-200
        ${selected
          ? "border-purple-500 ring-2 ring-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        }
      `}
    >
      <div className="relative aspect-video">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {selected && (
          <div className="absolute inset-0 bg-purple-600/20 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-purple-600 drop-shadow-lg" />
          </div>
        )}
        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
          <Eye className="h-3 w-3" />
          {formatViewCount(video.viewCount)}
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
          {video.title}
        </p>
      </div>
    </motion.div>
  )
}

interface ChannelVideoGridProps {
  isYtConnected: boolean | undefined
  isAiTrained: boolean | undefined
  selectedVideoIds: string[]
  onToggleVideo: (video: ChannelVideo) => void
  uploading: boolean
  onStartTraining: () => void
}

export function ChannelVideoGrid({
  isYtConnected,
  isAiTrained,
  selectedVideoIds,
  onToggleVideo,
  uploading,
  onStartTraining,
}: ChannelVideoGridProps) {
  const { videos, loading, loadingMore, hasMore, fetchVideos, loadMore } = useChannelVideos()
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (isYtConnected) fetchVideos()
  }, [isYtConnected, fetchVideos])

  const filteredVideos = useMemo(() => {
    if (!search.trim()) return videos
    const q = search.toLowerCase()
    return videos.filter((v) => v.title.toLowerCase().includes(q))
  }, [videos, search])

  const selectionLabel = selectedVideoIds.length >= 3
    ? `${selectedVideoIds.length} selected`
    : `${selectedVideoIds.length}/3 min`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <Card className="shadow-lg relative">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle>Select Your Videos</CardTitle>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selectedVideoIds.length >= 3
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}>
                {selectionLabel}
              </span>
            </div>

            <Button
              onClick={onStartTraining}
              size="default"
              disabled={uploading || !isYtConnected || selectedVideoIds.length < 3}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg transition-shadow shrink-0"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  {isAiTrained ? (
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  {isAiTrained ? "Re-train Model" : "Start Training"}
                </>
              )}
            </Button>
          </div>

          {videos.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search videos by title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="aspect-video bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  <div className="p-2.5 space-y-1.5">
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-3.5 w-2/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No videos found on your channel.</p>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No videos match your search.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    selected={selectedVideoIds.includes(video.id)}
                    onToggle={() => onToggleVideo(video)}
                  />
                ))}
              </div>

              {hasMore && !search.trim() && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="opacity-50 hover:opacity-100"
                  >
                    <Loader2 className={`h-5 w-5 ${loadingMore ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>

        {!isYtConnected && (
          <div className="absolute inset-0 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
            <div className="text-center space-y-4 px-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Training Locked
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Please connect your YouTube account
              </p>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
