"use client";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { CardSpotlight } from "@repo/ui/card-spotlight";
import { Video, Zap, CheckCircle, Target } from "lucide-react";

export default function SolutionCard() {
    const solutions = [
        {
            title: "Sound Like You, Every Time",
            description: "Connect your channel and the AI learns your tone, vocabulary, and pacing. You get content that's unmistakably yours, so you can publish without rewriting every line to sound human.",
            icon: <Video className="h-6 w-6 text-slate-600" />,
            background: "bg-white",
        },
        {
            title: "Get Your Weekends Back",
            description: "Describe your video, pick a tone, and get a finished script in minutes instead of hours. That's time back for filming, editing, or simply living your life.",
            icon: <Zap className="h-6 w-6 text-slate-600" />,
            background: "bg-slate-50",
        },
        {
            title: "Never Have a Bad Upload",
            description: "Every script, thumbnail, and idea stays on-brand, so your audience gets your best work on every video, and consistency is what grows a channel.",
            icon: <CheckCircle className="h-6 w-6 text-slate-600" />,
            background: "bg-white",
        },
        {
            title: "One Tool Instead of Five",
            description: "Ideas, scripts, thumbnails, subtitles, and story outlines live in a single dashboard. Stop paying for and juggling five different apps to ship one video.",
            icon: <Target className="h-6 w-6 text-slate-600" />,
            background: "bg-slate-50",
        },
    ];

    return (
        <div className="container px-4 md:px-6">
            <motion.div
                className="flex flex-col items-center text-center space-y-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
            >
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50">
                    How Creator AI Fixes This
                </h2>
                <p className="max-w-[700px] text-slate-600 dark:text-slate-400 md:text-lg">
                    We built Creator AI to solve the exact problems you face as a content creator.
                </p>
            </motion.div>
            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mt-16"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }}
            >
                {solutions.map((solution, index) => (
                    <motion.div
                        key={index}
                        variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 14 } } }}
                    >
                        <CardSpotlight
                            className={cn(
                                "relative overflow-hidden min-h-[250px] w-full",
                                solution.background,
                                "border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl hover:shadow-purple-500/10 dark:hover:shadow-purple-400/5 transition-shadow"
                            )}
                            color="#c4b5fd"
                            role="article"
                        >
                            <div className="relative z-10 flex flex-col items-start h-full p-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-200 text-slate-600 dark:text-slate-600 mb-4">
                                    {solution.icon}
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                                    {solution.title}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {solution.description}
                                </p>
                            </div>
                        </CardSpotlight>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
