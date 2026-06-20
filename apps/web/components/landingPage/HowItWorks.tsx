import { motion } from "motion/react";
import { TracingBeam } from "@repo/ui/tracing-beam";

export default function HowItWorks() {

    const chapters = [
        { title: "Connect & Train", description: "Link your YouTube channel and pick a few of your best videos. The AI watches them and learns your unique style, tone, and way of speaking." },
        { title: "Create Content", description: "Tell the AI what you want, a script, video ideas, thumbnails, or subtitles. It creates everything in your voice, ready to use." },
        { title: "Publish & Grow", description: "Review the output, make any tweaks, and use it for your next video. The more you use it, the better it understands you." },
    ]

    return (
        <TracingBeam className="px-4 sm:px-6 lg:px-8">
            <div className="max-w-xs sm:max-w-md md:max-w-lg lg:max-w-3xl xl:max-w-4xl mx-auto flex flex-col items-center text-center space-y-4 sm:space-y-6 mb-8 sm:mb-12 lg:mb-16">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white"
                >
                    How It Works
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-sm sm:text-base md:text-lg lg:text-xl text-slate-600 dark:text-slate-400 max-w-prose"
                >
                    Three simple steps to start creating personalized content for your channel.
                </motion.p>
            </div>

            <div className="flex flex-col space-y-6 sm:space-y-8 lg:space-y-10 max-w-xs sm:max-w-md md:max-w-lg lg:max-w-3xl xl:max-w-4xl mx-auto">
                {chapters.map((chapter, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.2 }}
                        className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-6 sm:p-8 md:p-10 lg:p-12 
                                   flex flex-col items-center text-center 
                                   lg:flex-row lg:items-start lg:text-left lg:gap-8
                                   border border-slate-200 dark:border-slate-700
                                   hover:shadow-purple-500/10 dark:hover:shadow-purple-400/5 transition-shadow duration-300"
                    >
                        <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xl sm:text-2xl font-bold flex items-center justify-center mb-6 lg:mb-0">
                            {index + 1}
                        </div>

                        <div className="flex-grow">
                            <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white mb-2 sm:mb-4">
                                {chapter.title}
                            </h3>
                            <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-400">
                                {chapter.description}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </TracingBeam>
    )
}
