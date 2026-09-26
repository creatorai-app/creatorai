"use client"

import * as motion from "motion/react-m";
import { Badge } from "@repo/ui/badge";
import { CheckCircle2, XCircle, Youtube, Bot, Coins } from "lucide-react"

interface TrainAIHeaderProps {
  isYtConnected: boolean
  isAiTrained: boolean
  /** True once the account has spent its one free run — survives disconnect/reconnect. */
  freeTrainingUsed?: boolean
  lastCreditsConsumed: number | null
}

export function TrainAIHeader({ isYtConnected, isAiTrained, freeTrainingUsed, lastCreditsConsumed }: TrainAIHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Studio</h1>
        <p className="hidden sm:block text-slate-600 dark:text-slate-400 mt-1">
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
            {lastCreditsConsumed === 0
              ? "Free training"
              : `${lastCreditsConsumed} credit${lastCreditsConsumed !== 1 ? "s" : ""} used`}
          </Badge>
        )}

        {/* The free run is once per account, so key it off freeTrainingUsed, not
            isAiTrained — a reconnected channel resets isAiTrained but still pays. */}
        {!freeTrainingUsed && (
          <Badge
            variant="outline"
            className="gap-1.5 py-1 px-2.5 border-green-300 text-green-700 dark:border-green-800 dark:text-green-400"
          >
            <Coins className="h-3.5 w-3.5" />
            First training free
          </Badge>
        )}
      </div>
    </motion.div>
  )
}
