"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@repo/ui/button";
import { Youtube, Unlink, BarChart3, ChevronRight, LayoutTemplate } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useRouter } from "next/navigation";
import {
  CHART_COLORS, containerVariants, itemVariants, ACTIVITY_ICONS
} from "./types";
import type { SharedProps, ActivityPeriod } from "./types";
import { buildActivityData, buildRecentActivity, formatTimeAgo } from "./utils";
import {
  BackgroundGlow,
  DashboardHeader,
  QuickActionsGrid,
  ResourceCreditsCard,
  SubscriptionCard
} from "./SharedComponents";

export function ConnectedDashboardView(props: SharedProps) {
  const router = useRouter();
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>("weekly");
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  const getRouteForActivity = (type: string, id: string) => {
    switch (type) {
      case "script": return `/dashboard/scripts/${id}`;
      case "ideation": return `/dashboard/research/${id}`;
      case "thumbnail": return `/dashboard/thumbnails/${id}`;
      case "subtitle": return `/dashboard/subtitles/${id}`;
      case "dubbing": return `/dashboard/dubbing/${id}`;
      default: return "#";
    }
  };

  const activityData = useMemo(() => buildActivityData(props.data, activityPeriod), [props.data, activityPeriod]);
  const recentActivity = useMemo(() => buildRecentActivity(props.data), [props.data]);

  const stats = useMemo(() => {
    return [
      { label: "Scripts", count: props.data.scripts.length },
      { label: "Ideas", count: props.data.ideations.length },
      { label: "Thumbnails", count: props.data.thumbnails.length },
      { label: "Subtitles", count: props.data.subtitles.length },
    ];
  }, [props.data]);

  const pieData = useMemo(() => stats.filter((s) => s.count > 0).map((s) => ({ name: s.label, value: s.count })), [stats]);
  const totalContent = stats.reduce((a, s) => a + s.count, 0);

  const totalActivity = activityData.reduce((acc, curr) => acc + curr.scripts + curr.ideas + curr.thumbnails + curr.subtitles, 0);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex-1 max-w-[1440px] w-full mx-auto space-y-8 relative z-10">
      <BackgroundGlow />
      <DashboardHeader profile={props.profile} isSetupComplete={true} />

      <QuickActionsGrid isSetupComplete={true} />

      <motion.section variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

        {/* Main Content Area (Left 2 Columns) */}
        <div className="lg:col-span-2 flex flex-col gap-6 lg:gap-8">

          {/* Activity Chart */}
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-4">Activity Overview</h2>
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-2xl p-6 lg:p-8 flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <div className="space-y-1">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Items this period</span>
                  <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50">{totalActivity}</div>
                </div>
                <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                  {(["weekly", "monthly", "yearly"] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setActivityPeriod(period)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 capitalize ${
                        activityPeriod === period
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      {period === "weekly" ? "7 Days" : period === "monthly" ? "30 Days" : "This Year"}
                    </button>
                  ))}
                </div>
              </div>

              {/* The Graph */}
              <div className="h-[280px] w-full mt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradPink" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis hide={true} domain={['auto', 'auto']} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} dy={10} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", border: "none", borderRadius: "8px", color: "#e2e8f0", fontSize: "12px", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                      itemStyle={{ fontSize: "12px", fontWeight: 500 }}
                    />
                    <Area type="monotone" dataKey="scripts" stroke="#ec4899" strokeWidth={2} fill="url(#gradPink)" />
                    <Area type="monotone" dataKey="ideas" stroke="#a855f7" strokeWidth={3} fill="url(#gradPurple)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 pb-0 flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Recent Activity</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/30">
                    <th className="py-3 px-6 text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wider">Project Name</th>
                    <th className="py-3 px-6 text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wider">Type</th>
                    <th className="py-3 px-6 text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wider">Status</th>
                    <th className="py-3 px-6 text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wider text-right">Modified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                  {recentActivity.map((item, i) => {
                    const cfg = ACTIVITY_ICONS[item.type] ?? ACTIVITY_ICONS.script!;
                    const Icon = cfg.icon;
                    return (
                      <tr
                        key={item.id + i}
                        onClick={() => router.push(getRouteForActivity(item.type, item.id))}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      >
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 text-slate-400 group-hover:${cfg.color} transition-colors`} />
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{item.title}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-sm text-slate-500 dark:text-slate-400 capitalize">{item.type}</td>
                        <td className="py-3.5 px-6">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${item.status === 'completed' || item.status === 'done' || item.status === 'dubbed'
                            ? 'bg-purple-50/80 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-500/20'
                            : 'bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50'
                            }`}>
                            {item.status || 'In Progress'}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-sm text-slate-500 dark:text-slate-400 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span>{formatTimeAgo(item.date)}</span>
                            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-purple-500 transition-all transform group-hover:translate-x-1" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {recentActivity.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
                            <LayoutTemplate className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                          </div>
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No recent activity</p>
                          <p className="text-xs mt-1">Start creating to see your projects here.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Sidebar Area */}
        <div className="flex flex-col gap-6 lg:gap-8">

          {/* Connected Channels */}
          {props.isYoutubeConnected && (
            <div className="shrink-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group shadow-sm">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-pink-500"></div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100/80 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Youtube className="h-6 w-6 text-red-500" />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate block">{props.profile?.youtube_channel_name || "Connected Channel"}</h3>
                    <span className="shrink-0 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-sm text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">YT</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">Language • {props.profile?.language || "EN"}</p>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded text-slate-500 dark:text-slate-400 text-[11px] font-medium shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  <span className="hidden sm:inline">Connected</span>
                </div>
              </div>

              <div className="flex gap-2 w-full pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/50">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex-1 h-8 gap-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:text-purple-400 dark:hover:bg-purple-500/10" 
                  onClick={() => router.push("/dashboard/channel-stats")}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  View Details
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={props.disconnectYoutubeChannel}
                  disabled={props.disconnectingYoutube}
                  className="h-8 gap-1.5 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Disconnect</span>
                </Button>
              </div>
            </div>
          )}

          <ResourceCreditsCard {...props} />

          {/* Content Mix */}
          <div className="shrink-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-4">Content Mix</h3>
            {totalContent > 0 ? (
              <>
              <div className="h-44 w-full relative mb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                      onMouseEnter={(_, index) => setActivePieIndex(index)}
                      onMouseLeave={() => setActivePieIndex(null)}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          style={{
                            opacity: activePieIndex !== null && activePieIndex !== index ? 0.6 : 1,
                            transition: "opacity 0.2s ease",
                            outline: "none"
                          }}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 dark:bg-slate-800 text-slate-50 text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                              {payload[0]?.name} : {payload[0]?.value}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[28px] font-bold text-slate-900 dark:text-slate-50 tracking-tight leading-none">
                    {activePieIndex !== null ? pieData[activePieIndex]?.value ?? totalContent : totalContent}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 capitalize">
                    {activePieIndex !== null ? pieData[activePieIndex]?.name.toLowerCase() ?? "Items" : "Items"}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS[i] }}></div>
                      <span className="text-xs text-slate-500 dark:text-slate-400" style={{ fontWeight: activePieIndex === i ? 600 : 400, transition: "font-weight 0.2s ease" }}>{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-50">
                      {Math.round((d.value / totalContent) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
            ) : (
              <div className="h-44 w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 mb-5">
                <div className="w-20 h-20 rounded-full border-[6px] border-dashed border-slate-100 dark:border-slate-800 flex items-center justify-center mb-3">
                  <span className="text-xl font-bold text-slate-300 dark:text-slate-600">0</span>
                </div>
                <p className="text-xs font-medium">No items yet</p>
              </div>
            )}
          </div>

          <SubscriptionCard {...props} />

        </div>
      </motion.section>
    </motion.div>
  );
}
