"use client"

import * as motion from "motion/react-m";
import { Badge } from "@repo/ui/badge";
import { CheckCircle2, XCircle, Youtube, Bot, Coins } from "lucide-react"

interface TrainAIHeaderProps {
  isYtConnected: boolean
  isAiTrained: boolean
  lastCreditsConsumed: number | null
}

export function TrainAIHeader({ isYtConnected, isAiTrained, lastCreditsConsumed }: TrainAIHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Studio</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Train your model on your unique content style.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant={isYtConnected ? "default" : "secondary"}
          className={`gap-1.5 py-1 px-2.5 ${
            isYtConnected
              ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
              : "bg-slate-100 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {isYtConnected ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          <Youtube className="h-3.5 w-3.5" />
          {isYtConnected ? "Connected" : "Not Connected"}
        </Badge>

        <Badge
          variant={isAiTrained ? "default" : "secondary"}
          className={`gap-1.5 py-1 px-2.5 ${
            isAiTrained
              ? "bg-purple-100 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400"
              : "bg-slate-100 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {isAiTrained ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          <Bot className="h-3.5 w-3.5" />
          {isAiTrained ? "Trained" : "Not Trained"}
        </Badge>

        {isAiTrained && lastCreditsConsumed !== null && (
          <Badge
            variant="outline"
            className="gap-1.5 py-1 px-2.5 text-slate-600 dark:text-slate-400"
          >
            <Coins className="h-3.5 w-3.5" />
            {lastCreditsConsumed} credit{lastCreditsConsumed !== 1 ? "s" : ""} used
          </Badge>
        )}
      </div>
    </motion.div>
  )
}
