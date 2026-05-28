"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { BarChart3, Hash, TrendingUp } from "lucide-react";
import OpportunityScoreChart from "@/components/dashboard/research/OpportunityScoreChart";
import TrendSnapshotPanel from "@/components/dashboard/research/TrendSnapshotPanel";
import type { IdeationIdea, IdeationResult, TrendSnapshot } from "@repo/validation";

interface ComparisonMetricsViewProps {
  ideas: IdeationIdea[];
  trendSnapshot?: TrendSnapshot | null;
  channelFit?: IdeationResult["channelFit"];
}

export default function ComparisonMetricsView({
  ideas,
  trendSnapshot,
  channelFit,
}: ComparisonMetricsViewProps) {
  const keywordMap = new Map<string, { count: number; totalScore: number }>();

  for (const idea of ideas) {
    for (const kw of idea.targetKeywords ?? []) {
      const key = kw.toLowerCase();
      const existing = keywordMap.get(key) ?? { count: 0, totalScore: 0 };
      keywordMap.set(key, {
        count: existing.count + 1,
        totalScore: existing.totalScore + idea.opportunityScore,
      });
    }
  }

  const rankedKeywords = [...keywordMap.entries()]
    .map(([keyword, stats]) => ({
      keyword,
      count: stats.count,
      avgScore: Math.round(stats.totalScore / stats.count),
    }))
    .sort((a, b) => b.avgScore - a.avgScore || b.count - a.count);

  const trendRanked = [...ideas].sort((a, b) => b.opportunityScore - a.opportunityScore);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OpportunityScoreChart ideas={ideas} />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              Idea ranking by opportunity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {trendRanked.map((idea, i) => (
              <div
                key={idea.id ?? i}
                className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400">#{i + 1}</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {idea.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs capitalize">
                    {idea.trendMomentum}
                  </Badge>
                  <span className="text-sm font-semibold text-purple-600 dark:text-purple-400 w-8 text-right">
                    {idea.opportunityScore}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {rankedKeywords.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Hash className="h-4 w-4 text-blue-500" />
              Keyword comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-2 font-medium">Keyword</th>
                    <th className="pb-2 font-medium text-center">Ideas</th>
                    <th className="pb-2 font-medium text-right">Avg. score</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedKeywords.map((row) => (
                    <tr
                      key={row.keyword}
                      className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                    >
                      <td className="py-2.5 capitalize text-slate-700 dark:text-slate-300">
                        {row.keyword}
                      </td>
                      <td className="py-2.5 text-center text-slate-500">{row.count}</td>
                      <td className="py-2.5 text-right font-medium text-slate-800 dark:text-slate-200">
                        {row.avgScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {channelFit && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              Channel fit signals
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            {channelFit.bestFormats?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Best formats</p>
                <div className="flex flex-wrap gap-1">
                  {channelFit.bestFormats.map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </div>
            )}
            {channelFit.contentGaps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Content gaps</p>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                  {channelFit.contentGaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {channelFit.titlePatterns?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Title patterns</p>
                <div className="flex flex-wrap gap-1">
                  {channelFit.titlePatterns.map((p, i) => (
                    <span
                      key={i}
                      className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {trendSnapshot && <TrendSnapshotPanel snapshot={trendSnapshot} />}
    </div>
  );
}
