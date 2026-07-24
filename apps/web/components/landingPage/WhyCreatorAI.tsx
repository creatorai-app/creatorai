"use client"

import * as motion from "motion/react-m";
import {
  Brain,
  Mic,
  Image,
  Subtitles,
  Languages,
  LayoutDashboard,
  X,
  Check,
} from "lucide-react"

const comparisons = [
  {
    feature: "Learns Your Voice",
    description:
      "Analyzes your YouTube videos and builds a persistent voice profile so every script sounds like you.",
    icon: Brain,
    creatorAI: true,
    genericAI: false,
  },
  {
    feature: "YouTube-Optimized Scripts",
    description:
      "Scripts built with hooks, retention loops, pattern interrupts, and CTAs designed for YouTube's algorithm.",
    icon: Mic,
    creatorAI: true,
    genericAI: false,
  },
  {
    feature: "Thumbnail Generation",
    description:
      "AI-generated thumbnails with bold text, high contrast, and emotional triggers that drive clicks.",
    icon: Image,
    creatorAI: true,
    genericAI: false,
  },
  {
    feature: "Subtitle Generation & Export",
    description:
      "AI-powered subtitles with SRT/VTT export and burn-in support, boosting views by up to 40%.",
    icon: Subtitles,
    creatorAI: true,
    genericAI: false,
  },
  {
    feature: "Dubbing in 24+ Languages",
    description:
      "Natural-sounding AI dubbing to reach global audiences without hiring voice actors.",
    icon: Languages,
    creatorAI: true,
    genericAI: false,
  },
  {
    feature: "All-in-One Dashboard",
    description:
      "Scripts, thumbnails, subtitles, dubbing, ideas, and story blueprints, one tool, zero context-switching.",
    icon: LayoutDashboard,
    creatorAI: true,
    genericAI: false,
  },
]

export default function WhyCreatorAI() {
  return (
    <div className="container max-w-6xl mx-auto px-4 md:px-6">
      <motion.div
        className="flex flex-col items-center text-center space-y-4 mb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
          Creator AI vs Generic AI
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50">
          Why Generic AI Falls Short for Creators
        </h2>
        <p className="max-w-[700px] text-slate-600 dark:text-slate-400 md:text-lg">
          ChatGPT, Gemini, and Claude are great for general tasks, but YouTube
          content creation needs a specialized tool built for how creators
          actually work.
        </p>
      </motion.div>

      {/* Comparison Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.08, delayChildren: 0.1 },
          },
        }}
      >
        {comparisons.map((item) => (
          <motion.div
            key={item.feature}
            variants={{
              hidden: { opacity: 0, y: 24 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { type: "spring", stiffness: 100, damping: 14 },
              },
            }}
            className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 hover:shadow-lg hover:shadow-purple-500/10 transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <item.icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {item.feature}
              </h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              {item.description}
            </p>
            <div className="flex items-center gap-6 pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30">
                  <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Creator AI
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30">
                  <X className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                </div>
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  Generic AI
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Summary Bar */}
      <motion.div
        className="mt-16 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 p-8 md:p-10 text-center"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
          Stop Duct-Taping Generic Tools Together
        </h3>
        <p className="text-purple-100 max-w-2xl mx-auto mb-6">
          Generic AI tools cost $80–180/month when you piece together scripts,
          thumbnails, subtitles, and dubbing from different apps. Creator AI
          gives you everything in one subscription, purpose-built for YouTube
          creators.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/signup"
            className="inline-flex items-center gap-2 bg-white text-purple-700 font-semibold px-6 py-3 rounded-lg hover:bg-purple-50 transition-colors"
          >
            Get Started Free
          </a>
          <a
            href="/blog/creator-ai-vs-chatgpt-for-youtube-creators"
            className="inline-flex items-center gap-2 text-white font-medium border border-white/30 px-6 py-3 rounded-lg hover:bg-white/10 transition-colors"
          >
            Read the full comparison
          </a>
        </div>
      </motion.div>
    </div>
  )
}
