"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as motion from "motion/react-m";
import { Card, CardContent, CardHeader } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@repo/ui/collapsible";
import {
  ChevronDown, TrendingUp, TrendingDown, Minus,
  ExternalLink, FileText, Clapperboard, ImageIcon, Target,
} from "lucide-react";
import type { IdeationIdea } from "@repo/validation";

const MOMENTUM_CONFIG = {
  rising: { icon: TrendingUp, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
  stable: { icon: Minus, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  declining: { icon: TrendingDown, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
};

interface IdeaCardProps {
  idea: IdeationIdea;
  index: number;
  ideationId: string;
}

export default function IdeaCard({ idea, index, ideationId }: IdeaCardProps) {
  const router = useRouter();
  const [talkingPointsOpen, setTalkingPointsOpen] = useState(false);
  const momentum = MOMENTUM_CONFIG[idea.trendMomentum] || MOMENTUM_CONFIG.stable;
  const MomentumIcon = momentum.icon;

  const scoreBg = idea.opportunityScore >= 70
    ? "from-green-500 to-emerald-500"
    : idea.opportunityScore >= 40
      ? "from-yellow-500 to-amber-500"
      : "from-red-500 to-rose-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300">
        <CardHeader className="pb-2 sm:pb-3">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                <span className="text-[10px] sm:text-xs font-bold tracking-wider text-purple-600 dark:text-purple-400">IDEA {index + 1}</span>
                <Badge variant="secondary" className={`${momentum.bg} ${momentum.color} text-[10px] sm:text-xs px-1.5 sm:px-2`}>
                  <MomentumIcon className="h-3 w-3 mr-0.5 sm:mr-1" />
                  {idea.trendMomentum}
                </Badge>
                <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2">{idea.suggestedFormat}</Badge>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug">{idea.title}</h3>
              {idea.titleVariations?.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-2">
                  {idea.titleVariations.map((v, i) => (
                    <span key={i} className="text-[10px] sm:text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">{v}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center shrink-0">
              <div className={`relative w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br ${scoreBg} flex items-center justify-center shadow-sm`}>
                <span className="text-sm sm:text-lg font-bold text-white">{idea.opportunityScore}</span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Score</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 sm:space-y-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-2.5 sm:p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-lg border border-blue-100/60 dark:border-blue-900/20">
              <h4 className="text-[10px] sm:text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1">Why This Works</h4>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{idea.whyItWorks}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg border border-amber-100/60 dark:border-amber-900/20">
              <h4 className="text-[10px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Hook Angle</h4>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{idea.hookAngle}</p>
            </div>
          </div>

          {idea.targetKeywords?.length > 0 && (
            <div>
              <h4 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Target Keywords</h4>
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {idea.targetKeywords.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] sm:text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5">{kw}</Badge>
                ))}
              </div>
            </div>
          )}

          {idea.searchIntentSummary && (
            <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-700/40">
              <h4 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                <Target className="h-3 w-3 inline mr-1" />
                Search Intent
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{idea.searchIntentSummary}</p>
            </div>
          )}

          {idea.talkingPoints?.length > 0 && (
            <Collapsible open={talkingPointsOpen} onOpenChange={setTalkingPointsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  Talking Points ({idea.talkingPoints.length})
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${talkingPointsOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ol className="space-y-1.5 mt-2 pl-4">
                  {idea.talkingPoints.map((point, i) => (
                    <li key={i} className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 list-decimal leading-relaxed">{point}</li>
                  ))}
                </ol>
              </CollapsibleContent>
            </Collapsible>
          )}

          {idea.referenceSignals?.length > 0 && (
            <div>
              <h4 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reference Signals</h4>
              <div className="space-y-1">
                {idea.referenceSignals.map((ref, i) => (
                  <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                    <ExternalLink className="h-3 w-3 shrink-0" /> {ref.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              size="sm" variant="outline"
              className="text-xs sm:text-sm h-8 sm:h-9"
              onClick={() => router.push(`/dashboard/scripts/new?ideationId=${ideationId}&ideaIndex=${index}`)}
            >
              <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" /> Create Script
            </Button>
            <Button
              size="sm" variant="outline"
              className="text-xs sm:text-sm h-8 sm:h-9"
              onClick={() => router.push(`/dashboard/story-builder/new?topic=${encodeURIComponent(idea.title)}&ideationId=${ideationId}&ideaIndex=${index}`)}
            >
              <Clapperboard className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" /> Story Builder
            </Button>
            <Button
              size="sm" variant="outline"
              className="text-xs sm:text-sm h-8 sm:h-9"
              onClick={() => router.push(`/dashboard/thumbnails/new?prompt=${encodeURIComponent(idea.title)}`)}
            >
              <ImageIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" /> Thumbnail
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
