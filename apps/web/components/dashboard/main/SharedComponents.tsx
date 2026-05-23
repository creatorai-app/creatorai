"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/tooltip";
import { Zap, Crown } from "lucide-react";
import { QUICK_ACTIONS, itemVariants } from "./types";

export function BackgroundGlow() {
  return (
    <>
      <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-purple-400/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-[80px] -z-10 pointer-events-none" />
    </>
  );
}

export function DashboardHeader({ profile, isSetupComplete }: { profile: any; isSetupComplete: boolean }) {
  return (
    <motion.header variants={itemVariants} className="space-y-2 mb-4">
      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
        Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
      </h1>
      <p className="text-lg text-slate-500 dark:text-slate-400">
        {isSetupComplete
          ? "Here is an overview of your creative workspace today."
          : "Let's get your AI personalized to start creating."}
      </p>
    </motion.header>
  );
}

export function QuickActionsGrid({ isSetupComplete }: { isSetupComplete: boolean }) {
  return (
    <motion.section variants={itemVariants} aria-label="Quick Actions">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {QUICK_ACTIONS.map((action) => {
          const locked = !isSetupComplete;
          return (
            <TooltipProvider key={action.label} delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={locked ? "cursor-not-allowed" : "h-full"}>
                    <Link
                      href={locked ? "#" : action.href}
                      className={`block h-full ${locked ? "pointer-events-none opacity-60 grayscale-[50%]" : ""}`}
                      aria-disabled={locked}
                      tabIndex={locked ? -1 : undefined}
                    >
                      <button className="w-full h-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/60 dark:border-slate-800/50 rounded-2xl p-5 flex flex-col items-start gap-4 hover:shadow-[0_8px_30px_rgba(168,85,247,0.12)] hover:-translate-y-1 hover:border-purple-500/50 transition-all duration-300 group text-left relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-purple-500/0 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="w-10 h-10 rounded-lg bg-slate-100/80 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:bg-purple-500/10 transition-all duration-300 transform group-hover:scale-110 relative z-10">
                          <action.icon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-3" />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-50 relative z-10 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">{action.label}</span>
                      </button>
                    </Link>
                  </div>
                </TooltipTrigger>
                {locked && <TooltipContent><p>Complete AI setup to unlock</p></TooltipContent>}
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </motion.section>
  );
}

export function ResourceCreditsCard({ profile, creditsUsed, totalCredits, creditsPercentage }: any) {
  return (
    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-100 dark:bg-purple-500/20 rounded-md text-purple-600 dark:text-purple-400">
            <Zap className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Resource Credits</span>
        </div>
        <Badge variant="outline" className="bg-white/50 dark:bg-slate-800/50 text-[10px] text-slate-500 border-slate-200 dark:border-slate-700">
          Standard
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{profile?.credits || 0}</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Available</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Used: {creditsUsed}</span>
            <span>Total: {totalCredits}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, creditsPercentage)}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionCard({ currentPlanName, subscription }: any) {
  return (
    <div className="bg-gradient-to-br from-purple-600 to-indigo-700 dark:from-purple-900 dark:to-indigo-950 rounded-2xl p-6 text-white relative overflow-hidden group shadow-lg shadow-purple-500/20 h-full flex flex-col justify-center">
      <div className="absolute -top-6 -right-6 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500 ease-in-out transform group-hover:scale-110">
        <Crown className="w-32 h-32 rotate-12" />
      </div>
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-purple-200" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-100">Subscription</h3>
        </div>
        <div>
          <div className="text-xl font-bold mb-1">{currentPlanName} Plan</div>
          <p className="text-xs text-purple-200 leading-relaxed max-w-[85%]">
            {currentPlanName === "Free" || currentPlanName === "Starter" 
              ? "Upgrade to unlock unlimited AI generations and full studio access." 
              : "You are currently on a premium tier with enhanced AI limits."}
          </p>
        </div>
        <Button className="w-full bg-white/10 hover:bg-white text-white hover:text-purple-700 backdrop-blur-sm border border-white/20 transition-all duration-300 shadow-sm text-xs font-medium h-9" asChild>
          <Link href="/dashboard/settings?tab=billing">{subscription ? "Manage Plan" : "Upgrade Now"}</Link>
        </Button>
      </div>
    </div>
  );
}
