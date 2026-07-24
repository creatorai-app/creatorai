"use client";

import * as motion from "motion/react-m";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { TrendingUp, Lightbulb, Zap, BarChart3 } from "lucide-react";

/**
 * @todo Fetch them from DB later on
 */

const TRENDY_IDEAS = [
  { label: "AI & Tech Trends", tag: "Tech", icon: Zap },
  { label: "Productivity & Habits", tag: "Lifestyle", icon: BarChart3 },
  { label: "Creator Economy", tag: "Business", icon: TrendingUp },
  { label: "Storytelling & Hooks", tag: "Content", icon: Lightbulb },
];

const BulbSvg = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
);

const SparkSvg = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);

interface PopularIdeasCardProps {
  onSelectIdea?: (idea: string) => void;
}

export default function PopularIdeasCard({ onSelectIdea }: PopularIdeasCardProps) {
  return (
    <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}>
            <BulbSvg className="h-5 w-5 text-purple-500" />
          </motion.div>
          <CardTitle className="text-base">Popular &amp; Trendy Ideas</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {TRENDY_IDEAS.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              type="button"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ x: 4 }}
              onClick={() => onSelectIdea?.(item.label)}
              className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center gap-3"
            >
              <motion.span whileHover={{ scale: 1.1 }}>
                <Icon className="h-4 w-4 text-purple-500 shrink-0" />
              </motion.span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{item.label}</span>
              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-700/80 px-2 py-0.5 rounded-full">
                {item.tag}
              </span>
            </motion.button>
          );
        })}
        <motion.div
          className="pt-2 flex justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <SparkSvg className="h-4 w-4 text-amber-400/80" />
        </motion.div>
      </CardContent>
    </Card>
  );
}
