"use client"

import { cn } from "@/lib/utils";
import { AlertCircle, TrendingUp, Clock, Target } from "lucide-react";
import * as motion from "motion/react-m";

const ProblemSection = () => {
    const problems = [
        {
            title: "Blank Page Syndrome",
            description: "You sit down to write a script and nothing comes out. Hours pass, the cursor blinks, and you're still stuck on the first line.",
            icon: AlertCircle,
            color: "text-red-500"
        },
        {
            title: "Hit-or-Miss Videos",
            description: "Some videos do great, others flop. Without a clear structure or data-driven approach, consistency feels impossible.",
            icon: TrendingUp,
            color: "text-orange-500"
        },
        {
            title: "Too Much Time on Scripts",
            description: "Writing a single script takes 3-5 hours. That's time you could spend filming, editing, or just living your life.",
            icon: Clock,
            color: "text-yellow-500"
        },
        {
            title: "AI That Doesn't Sound Like You",
            description: "You've tried ChatGPT and other tools, but the output sounds generic. It doesn't capture your style, humor, or voice.",
            icon: Target,
            color: "text-blue-500"
        }
    ]

    return (
        <div className="container max-w-5xl mx-auto px-4">
            <motion.div
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
            >
                <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-50">
                    Sound Familiar?
                </h2>
                <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                    These are the struggles most YouTubers deal with every week.
                </p>
            </motion.div>

            <motion.div
                className="space-y-10"
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
            >
                {problems.map((p) => (
                    <motion.div
                        key={p.title}
                        variants={{ hidden: { opacity: 0, x: 24 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 100, damping: 14 } } }}
                        className="relative pl-14 group"
                    >
                        <div className="absolute left-0 top-1">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center shadow-md",
                                p.color.replace("text-", "bg-").replace("-500", "-100")
                            )}>
                                <p.icon className={cn("w-5 h-5", p.color)} />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{p.title}</h3>
                            <p className="mt-1 text-slate-600 dark:text-slate-400">{p.description}</p>
                        </div>

                        <div className="mt-6 border-l-2 border-dashed border-slate-200 dark:border-slate-700 ml-[20px] h-10" />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};

export default ProblemSection;
