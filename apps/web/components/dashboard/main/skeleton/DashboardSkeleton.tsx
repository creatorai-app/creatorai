import { Skeleton } from "@repo/ui/skeleton";

function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex-1 max-w-[1440px] w-full mx-auto space-y-8 relative z-10">

      {/* Header */}
      <header className="space-y-2 mb-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-80" />
      </header>

      {/* Quick Actions — 6 columns to match real grid */}
      <section aria-label="Quick Actions skeleton">
        <Skeleton className="h-5 w-28 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-slate-800/50 rounded-2xl p-5 flex flex-col items-start gap-4"
            >
              <Skeleton className="w-10 h-10 rounded-lg" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </section>

      {/* Main 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

        {/* Left — col-span-2 */}
        <div className="lg:col-span-2 flex flex-col gap-6 lg:gap-8">

          {/* Activity Chart */}
          <div>
            <Skeleton className="h-6 w-40 mb-4" />
            <GlassPanel className="p-6 lg:p-8">
              <div className="flex justify-between items-start mb-2">
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-9 w-16" />
                </div>
                {/* Period toggle buttons */}
                <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50 gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-16 rounded-md" />
                  ))}
                </div>
              </div>
              <Skeleton className="h-[280px] w-full rounded-lg mt-6" />
            </GlassPanel>
          </div>

          {/* Recent Activity Table */}
          <GlassPanel className="overflow-hidden">
            <div className="p-6 pb-0 mb-4">
              <Skeleton className="h-5 w-36" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/30">
                    {["Project Name", "Type", "Status", "Modified"].map((col) => (
                      <th key={col} className="py-3 px-6">
                        <Skeleton className="h-3 w-20" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-4 h-4 rounded" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                      </td>
                      <td className="py-3.5 px-6"><Skeleton className="h-4 w-14" /></td>
                      <td className="py-3.5 px-6"><Skeleton className="h-5 w-20 rounded" /></td>
                      <td className="py-3.5 px-6 flex justify-end"><Skeleton className="h-4 w-14" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassPanel>
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-6 lg:gap-8">

          {/* YouTube Channel Card */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden shadow-sm">
            {/* Left gradient accent bar */}
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-pink-500" />
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded shrink-0" />
            </div>
            <div className="flex gap-2 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/50">
              <Skeleton className="flex-1 h-8 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>

          {/* Resource Credits Card */}
          <GlassPanel className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Skeleton className="w-7 h-7 rounded-md" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-3 w-14" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </div>
          </GlassPanel>

          {/* Content Mix Card */}
          <GlassPanel className="p-6">
            <Skeleton className="h-4 w-24 mb-4" />
            {/* Donut placeholder */}
            <div className="h-44 w-full flex items-center justify-center mb-5">
              <div className="relative w-40 h-40">
                <Skeleton className="w-40 h-40 rounded-full" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-[88px] h-[88px] rounded-full bg-white dark:bg-slate-950" />
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-2.5 h-2.5 rounded-sm" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* Subscription Card */}
          <div className="bg-gradient-to-br from-purple-600/30 to-indigo-700/30 dark:from-purple-900/50 dark:to-indigo-950/50 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-purple-200/30 dark:border-purple-800/20">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
