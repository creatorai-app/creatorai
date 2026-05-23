"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useSupabase } from "@/components/supabase-provider";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import {
  Youtube, Eye, Users, Video, Globe,
  ExternalLink, AlertCircle, Link2, RefreshCw,
  ThumbsUp, MessageSquare, Flame, Clock, PlaySquare,
  Crown, Timer, Zap, Brain,
} from "lucide-react";
import Link from "next/link";
import { useChannelStats } from "@/hooks/useChannelStats";
import { itemVariants, formatNumber, parseDuration } from "@/components/dashboard/channel-stats/util";
import ChannelStatsSkeleton from "@/components/dashboard/channel-stats/Skeleton";
import { ChannelStatsError } from "@/components/dashboard/channel-stats/ChannelStatsError";
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

export default function ChannelStatsPage() {
  const { profile } = useSupabase();
  const { stats: channel, loading, error, fetchStats } = useChannelStats();


  const isYtConnected = profile?.youtube_connected === true;
  useEffect(() => {
    if (isYtConnected) fetchStats();
  }, [isYtConnected, fetchStats]);

  if (loading) return <ChannelStatsSkeleton />;

  if (error || !profile?.youtube_connected || !channel) {
    return <ChannelStatsError error={error || "No channel connected"} />;
  }

  const usagePercentage = Math.min(100, (channel.usage_count / channel.daily_limit) * 100);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="container py-8 max-w-7xl mx-auto space-y-8 relative z-10"
    >
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-400/8 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-purple-400/8 rounded-full blur-[80px] -z-10 pointer-events-none" />

      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Channel Hub
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            Live analytics &amp; sync status for your connected channel.
          </p>
        </div>
        <Button
          onClick={() => fetchStats(true)}
          disabled={loading || !channel.can_use_now}
          className={`h-10 px-4 text-sm font-medium gap-2 rounded-xl border transition-all duration-300 shadow-sm ${channel.can_use_now
            ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-600 shadow-purple-500/20"
            : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed"
            }`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Syncing…" : channel.can_use_now ? "Sync Channel" : "Sync Unavailable"}
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

        <div className="space-y-6">

          <motion.div variants={itemVariants} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-sm group relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-pink-500" />

            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="relative mt-1">
                {channel.thumbnail ? (
                  <>
                    <div className="absolute inset-0 rounded-full bg-red-500 blur-lg opacity-20 group-hover:opacity-35 transition-opacity duration-500" />
                    <Image
                      src={channel.thumbnail}
                      alt={channel.channelName}
                      className="relative z-10 h-20 w-20 rounded-full object-cover ring-4 ring-white dark:ring-slate-900 shadow-lg"
                      width={100}
                      height={100}
                    />
                  </>
                ) : (
                  <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-4 ring-white dark:ring-slate-900">
                    <Youtube className="h-8 w-8 text-red-500" />
                  </div>
                )}
                {/* live badge */}
                <span className="absolute -bottom-1 -right-1 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full px-2 py-0.5 text-[10px] font-semibold text-emerald-600 shadow-sm z-20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                  Live
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 leading-tight">{channel.channelName}</h2>
                {channel.custom_url && (
                  <a
                    href={`https://youtube.com/${channel.custom_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
                  >
                    {channel.custom_url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="flex gap-2 flex-wrap justify-center">
                {channel.country && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full font-medium">
                    <Globe className="w-3 h-3" /> {channel.country.toUpperCase()}
                  </span>
                )}
                {channel.default_language && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full font-medium">
                    <MessageSquare className="w-3 h-3" /> {channel.default_language.toUpperCase()}
                  </span>
                )}
                {profile?.ai_trained && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2.5 py-1 rounded-full font-medium">
                    <Brain className="w-3 h-3" /> AI Trained
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Sync limits card */}
          <motion.div variants={itemVariants} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-500/20 rounded-md text-purple-600 dark:text-purple-400">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Sync Credits</span>
              </div>
              <Badge variant="outline" className="capitalize text-[10px] bg-white/50 dark:bg-slate-800/50 text-slate-500 border-slate-200 dark:border-slate-700">
                {channel.plan}
              </Badge>
            </div>

            {/* Credit count */}
            <div className="flex justify-between items-end">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{channel.remaining}</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">of {channel.daily_limit} remaining</span>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>Used: {channel.usage_count}</span>
                <span>Limit: {channel.daily_limit}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePercentage}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                  className={`h-full rounded-full ${usagePercentage >= 100 ? "bg-red-500" : "bg-gradient-to-r from-purple-500 to-indigo-500"}`}
                />
              </div>
            </div>

            {/* Cooldown banner */}
            {channel.cooldown_remaining > 0 && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3">
                <Timer className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">Cooldown Active</p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">
                    {channel.cooldown_remaining}m cooldown remaining — try again later.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── RIGHT CONTENT ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Stat metric cards — exact Quick Actions hover style */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Subscribers", value: channel.subscriberCount, icon: Users, color: "text-purple-600 dark:text-purple-400", bg: "bg-slate-100/80 dark:bg-slate-800" },
              { label: "Total Views", value: channel.totalViews, icon: Eye, color: "text-purple-600 dark:text-purple-400", bg: "bg-slate-100/80 dark:bg-slate-800" },
              { label: "Videos", value: channel.totalVideos, icon: Video, color: "text-purple-600 dark:text-purple-400", bg: "bg-slate-100/80 dark:bg-slate-800" },
              { label: "Avg Views", value: channel.avgViewsPerVideo, icon: Flame, color: "text-purple-600 dark:text-purple-400", bg: "bg-slate-100/80 dark:bg-slate-800" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-slate-800/50 rounded-2xl p-5 flex flex-col items-start gap-4 hover:shadow-[0_8px_30px_rgba(168,85,247,0.12)] hover:-translate-y-0.5 hover:border-purple-500/30 transition-all duration-300 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-purple-500/0 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:bg-purple-500/10 transition-all duration-300 transform group-hover:scale-110 relative z-10`}>
                  <stat.icon className={`w-5 h-5 ${stat.color} transition-transform duration-300 group-hover:rotate-3`} />
                </div>
                <div className="relative z-10">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">{stat.label}</p>
                  <h4 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">{formatNumber(stat.value)}</h4>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Top Performing Videos — visual card grid */}
          {channel.topVideos?.length > 0 && (
            <motion.div variants={itemVariants} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Top Videos</h3>
                </div>
                <span className="text-[11px] font-medium text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1 rounded-full">by views</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {channel.topVideos.slice(0, 3).map((video, idx) => (
                  <a
                    key={video.id}
                    href={`https://youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group block bg-white/70 dark:bg-slate-900/60 border border-white/60 dark:border-slate-800/50 rounded-xl overflow-hidden hover:shadow-[0_8px_30px_rgba(168,85,247,0.12)] hover:-translate-y-0.5 hover:border-purple-500/30 transition-all duration-300"
                  >
                    {/* thumbnail */}
                    <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <Image
                        src={video.thumbnail || ""}
                        alt={video.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        width={100}
                        height={100}
                      />
                      {/* rank badge */}
                      <span className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shadow-md ${idx === 0
                        ? "bg-amber-400 text-white"
                        : idx === 1
                          ? "bg-slate-400 text-white"
                          : "bg-slate-600/80 text-white"
                        }`}>
                        {idx + 1}
                      </span>
                      {/* duration */}
                      {video.duration && (
                        <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                          {parseDuration(video.duration)}
                        </span>
                      )}
                      {/* play overlay */}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg scale-90 group-hover:scale-100 transition-transform duration-300">
                          <PlaySquare className="w-4 h-4 text-red-600 ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* info */}
                    <div className="p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-50 line-clamp-2 leading-snug group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                        {video.title}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(video.viewCount)}</span>
                        <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{formatNumber(video.likeCount)}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{formatNumber(video.commentCount)}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </motion.div>
          )}

          {/* Recent Uploads */}
          {channel.recentVideos?.length > 0 && (
            <motion.div variants={itemVariants} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-6">
                <Clock className="w-4 h-4 text-blue-500" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Recent Uploads</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {channel.recentVideos.slice(0, 3).map((video) => (
                  <a
                    key={video.id}
                    href={`https://youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative rounded-xl overflow-hidden block aspect-video bg-slate-100 dark:bg-slate-800 shadow-sm"
                  >
                    <Image
                      src={video.thumbnail || ""}
                      alt={video.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      width={100}
                      height={100}
                    />
                    {/* gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* play button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-11 h-11 bg-white/90 dark:bg-white/90 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                        <PlaySquare className="w-5 h-5 text-red-600 ml-0.5" />
                      </div>
                    </div>

                    {/* duration */}
                    {video.duration && (
                      <span className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                        {parseDuration(video.duration)}
                      </span>
                    )}

                    {/* info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-[11px] font-semibold line-clamp-2 leading-snug mb-1.5">{video.title}</p>
                      <div className="flex items-center gap-2.5 text-[10px] text-white/75 font-medium">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(video.viewCount)}</span>
                        <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{formatNumber(video.likeCount)}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}


