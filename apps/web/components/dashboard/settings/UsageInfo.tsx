"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Progress } from "@repo/ui/progress";
import { Skeleton } from "@repo/ui/skeleton";
import { Badge } from "@repo/ui/badge";
import { useBilling } from "@/hooks/useBilling";
import { api } from "@/lib/api-client";
import {
  BarChart3,
  TrendingUp,
  Zap,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

type UsageRange = "daily" | "weekly" | "monthly";

interface UsageEntry {
  date: string;
  credits: number;
}

interface UsageResponse {
  usage: UsageEntry[];
  totalUsed: number;
  range: UsageRange;
}

const RANGE_CONFIG: Record<UsageRange, { label: string; description: string }> = {
  daily: { label: "Daily", description: "Last 7 days" },
  weekly: { label: "Weekly", description: "Last 4 weeks" },
  monthly: { label: "Monthly", description: "Last 6 months" },
};

function formatDateLabel(date: string, range: UsageRange): string {
  const d = new Date(date);
  if (range === "daily") {
    return d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
  }
  if (range === "weekly") {
    return `Week of ${d.toLocaleDateString("en", { month: "short", day: "numeric" })}`;
  }
  return d.toLocaleDateString("en", { month: "short", year: "2-digit" });
}

export function UsageInfo() {
  const { billingInfo, loading: billingLoading } = useBilling();
  const [range, setRange] = useState<UsageRange>("daily");
  const [usageData, setUsageData] = useState<UsageEntry[]>([]);
  const [totalUsed, setTotalUsed] = useState(0);
  const [usageLoading, setUsageLoading] = useState(true);

  const fetchUsage = useCallback(async (r: UsageRange) => {
    setUsageLoading(true);
    try {
      const data = await api.get<UsageResponse>(
        `/api/v1/billing/usage?range=${r}`,
        { requireAuth: true },
      );
      setUsageData(data.usage);
      setTotalUsed(data.totalUsed);
    } catch {
      setUsageData([]);
      setTotalUsed(0);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage(range);
  }, [range, fetchUsage]);

  const chartData = useMemo(
    () =>
      usageData.map((entry) => ({
        ...entry,
        label: formatDateLabel(entry.date, range),
      })),
    [usageData, range],
  );

  const credits = billingInfo?.credits ?? 0;
  const totalPool = totalUsed + credits;
  const usagePercent = totalPool > 0 ? Math.round((totalUsed / totalPool) * 100) : 0;
  const avgPerPeriod =
    chartData.length > 0
      ? Math.round(totalUsed / chartData.length)
      : 0;

  const trend = useMemo(() => {
    if (chartData.length < 2) return 0;
    const recent = chartData[chartData.length - 1]!.credits;
    const previous = chartData[chartData.length - 2]!.credits;
    if (previous === 0) return recent > 0 ? 100 : 0;
    return Math.round(((recent - previous) / previous) * 100);
  }, [chartData]);

  if (billingLoading) return <UsageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Credits Remaining
                </span>
                <Zap className="h-4 w-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                {credits.toLocaleString()}
              </div>
              <Progress
                value={100 - usagePercent}
                className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-indigo-500"
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Used
                </span>
                <BarChart3 className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {totalUsed.toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {RANGE_CONFIG[range].description}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.16 }}
        >
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Avg / Period
                </span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {avgPerPeriod.toLocaleString()}
                </span>
                {trend !== 0 && (
                  <Badge
                    variant="outline"
                    className={
                      trend > 0
                        ? "border-rose-200 text-rose-600 dark:border-rose-800 dark:text-rose-400 text-xs"
                        : "border-emerald-200 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400 text-xs"
                    }
                  >
                    {trend > 0 ? (
                      <ArrowUpRight className="h-3 w-3 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 mr-0.5" />
                    )}
                    {Math.abs(trend)}%
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                credits per {range === "daily" ? "day" : range === "weekly" ? "week" : "month"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Usage Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  Credit Usage
                </CardTitle>
                <CardDescription className="mt-1">
                  Track how your credits are consumed over time
                </CardDescription>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                {(["daily", "weekly", "monthly"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      range === r
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {RANGE_CONFIG[r].label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={range}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="h-[280px] mt-2"
              >
                {usageLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-pulse text-sm text-slate-400">
                      Loading usage data...
                    </div>
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <BarChart3 className="h-10 w-10 text-slate-200 dark:text-slate-700 mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No usage data for this period
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      Start creating content to see your usage here
                    </p>
                  </div>
                ) : range === "daily" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(148, 163, 184, 0.15)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(15, 23, 42, 0.95)",
                          border: "none",
                          borderRadius: "10px",
                          color: "#e2e8f0",
                          fontSize: "12px",
                          padding: "10px 14px",
                        }}
                        cursor={{ fill: "rgba(168, 85, 247, 0.08)" }}
                        formatter={(value: number) => [`${value} credits`, "Used"]}
                      />
                      <Bar
                        dataKey="credits"
                        fill="url(#barGradient)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(148, 163, 184, 0.15)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(15, 23, 42, 0.95)",
                          border: "none",
                          borderRadius: "10px",
                          color: "#e2e8f0",
                          fontSize: "12px",
                          padding: "10px 14px",
                        }}
                        formatter={(value: number) => [`${value} credits`, "Used"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="credits"
                        stroke="#a855f7"
                        strokeWidth={2.5}
                        fill="url(#areaGradient)"
                        animationDuration={1000}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Usage Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Credit Balance</CardTitle>
            <CardDescription>
              Your current plan allocation and consumption
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Plan: {billingInfo?.currentPlan?.name ?? "Starter"}
              </span>
              <span className="text-sm font-medium">
                {billingInfo?.currentPlan?.credits_monthly?.toLocaleString() ?? 500} credits/mo
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Used</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {totalUsed.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Remaining</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {credits.toLocaleString()}
                </span>
              </div>
              <Progress
                value={usagePercent}
                className="h-2.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-indigo-500 [&>div]:transition-all [&>div]:duration-700"
              />
              <p className="text-xs text-slate-400 text-right">{usagePercent}% used</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function UsageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardContent className="pt-5 pb-4">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-7 w-16 mb-2" />
              <Skeleton className="h-1.5 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}
