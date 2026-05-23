"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@repo/ui/button";
import { Progress } from "@repo/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/tooltip";
import { Check, Youtube, Brain, Unlink, Lock } from "lucide-react";
import { containerVariants, itemVariants } from "./types";
import type { SharedProps } from "./types";
import {
  BackgroundGlow,
  DashboardHeader,
  QuickActionsGrid,
  ResourceCreditsCard,
  SubscriptionCard
} from "./SharedComponents";

export function OnboardingDashboardView(props: SharedProps) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex-1 max-w-[1440px] w-full mx-auto space-y-8 relative z-10">
      <BackgroundGlow />
      <DashboardHeader profile={props.profile} isSetupComplete={false} />

      <motion.div variants={itemVariants}>
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-[2rem] shadow-sm overflow-hidden">

          {/* Header Section */}
          <div className="p-8 md:p-12 border-b border-slate-200/50 dark:border-slate-800/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Initialize Workspace</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Complete the setup to unlock your AI dashboard.</p>
            </div>
            <div className="w-full md:w-1/3 relative z-10 bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl border border-white/60 dark:border-slate-700/50">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Setup Progress</span>
                <span className="text-sm font-black text-purple-600 dark:text-purple-400">{props.progressValue}%</span>
              </div>
              <Progress value={props.progressValue} className="h-2.5 bg-slate-200 dark:bg-slate-900 [&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-indigo-500 shadow-inner" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200/50 dark:divide-slate-800/50">


            <div className={`p-8 md:p-12 flex flex-col items-center text-center transition-all duration-300 group ${props.isYoutubeConnected ? 'bg-green-50/20 dark:bg-green-500/5' : 'bg-white/30 dark:bg-transparent hover:bg-slate-50/50 dark:hover:bg-slate-800/20'}`}>
              <div className="relative mb-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${props.isYoutubeConnected ? 'bg-green-50 dark:bg-green-500/10 text-green-500 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  {props.isYoutubeConnected ? (
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-20"></div>
                      <Check className="w-6 h-6 stroke-[2.5px] relative z-10" />
                    </div>
                  ) : <Youtube className="w-7 h-7 transition-transform duration-300 group-hover:scale-110 group-hover:text-red-500" />}
                </div>
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-purple-500 dark:text-purple-400 mb-2 bg-purple-50 dark:bg-purple-500/10 px-2 py-1 rounded-sm">Phase 01</span>
              <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-3">Connect Channel</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-[300px] leading-relaxed text-sm md:text-base">
                Securely link your YouTube channel to provide the AI with your unique voice, style, and niche data.
              </p>

              <div className="mt-auto w-full max-w-[200px]">
                {props.isYoutubeConnected ? (
                  <Button variant="outline" onClick={props.disconnectYoutubeChannel} disabled={props.disconnectingYoutube} className="w-full border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:border-red-500/30">
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={props.connectYoutubeChannel} disabled={props.connectingYoutube} className="w-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200 shadow-lg h-12 text-base">
                    {props.connectingYoutube ? "Connecting..." : "Connect"}
                  </Button>
                )}
              </div>
            </div>

            <div className={`p-8 md:p-12 flex flex-col items-center text-center transition-all duration-300 relative group ${!props.isYoutubeConnected ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/30' : props.isAiTrained ? 'bg-green-50/30 dark:bg-green-500/5' : 'bg-white/30 dark:bg-transparent hover:bg-slate-50/50 dark:hover:bg-slate-800/20'}`}>

              {!props.isYoutubeConnected && (
                <div className="absolute top-6 right-6 p-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-full text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
              )}

              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 ${props.isAiTrained ? 'bg-green-50 dark:bg-green-500/10 text-green-500 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-purple-600 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20'}`}>
                {props.isAiTrained ? (
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-20"></div>
                    <Check className="w-6 h-6 stroke-[2.5px] relative z-10" />
                  </div>
                ) : <Brain className="w-7 h-7 transition-transform duration-300 group-hover:scale-110" />}
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-purple-500 dark:text-purple-400 mb-2 bg-purple-50 dark:bg-purple-500/10 px-2 py-1 rounded-sm">Phase 02</span>
              <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-3">Train AI Studio</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-[300px] leading-relaxed text-sm md:text-base">
                Process your channel's videos to generate a highly personalized AI model tailored exactly to you.
              </p>

              <div className="mt-auto w-full max-w-[200px]">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={!props.isYoutubeConnected ? "cursor-not-allowed" : ""}>
                        <Link href={props.isYoutubeConnected ? "/dashboard/train" : "#"} tabIndex={!props.isYoutubeConnected ? -1 : undefined} className={`block w-full ${!props.isYoutubeConnected ? 'pointer-events-none' : ''}`}>
                          <Button
                            disabled={!props.isYoutubeConnected}
                            className={`w-full h-12 text-base ${props.isYoutubeConnected && !props.isAiTrained ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-500/25' : ''}`}
                          >
                            {props.isAiTrained ? 'Manage AI' : 'Start Training'}
                          </Button>
                        </Link>
                      </div>
                    </TooltipTrigger>
                    {!props.isYoutubeConnected && <TooltipContent><p className="font-medium">Complete Step 1 to unlock</p></TooltipContent>}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

          </div>
        </div>
      </motion.div>

      <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mt-8">
        <ResourceCreditsCard {...props} />
        <SubscriptionCard {...props} />
      </motion.section>

      <div className="pt-4">
        <QuickActionsGrid isSetupComplete={false} />
      </div>

    </motion.div>
  );
}
