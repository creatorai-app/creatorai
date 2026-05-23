import { Button } from "@repo/ui/button";
import { error } from "console";
import { AlertCircle, Link, Link2 } from "lucide-react";
import { motion } from "motion/react";
import { itemVariants } from "./util";

export function ChannelStatsError({ error }: { error: string }) {
    return (
        <div className="container py-8 max-w-7xl mx-auto">
            <motion.header variants={itemVariants} initial="hidden" animate="visible" className="space-y-2 mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
                    Channel Hub
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400">
                    Analytics & synchronization for your YouTube channel.
                </p>
            </motion.header>
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-[2rem] p-12 md:p-20 text-center shadow-sm relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-6">
                        <AlertCircle className="h-10 w-10 text-red-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-3">No Channel Connected</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8 leading-relaxed">
                        {error || "Connect your YouTube channel to unlock deep analytics and AI-powered synchronization."}
                    </p>
                    <Link href="/dashboard">
                        <Button className="h-12 px-8 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200 shadow-lg gap-2">
                            <Link2 className="h-4 w-4" />
                            Go to Dashboard
                        </Button>
                    </Link>
                </div>
            </motion.div>
        </div>
    )
}