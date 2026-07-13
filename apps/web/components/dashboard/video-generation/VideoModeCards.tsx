"use client"

import { motion } from "motion/react"
import { Type, ImageIcon, Layers, Lock } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import type { VideoGenerationMode } from "@repo/validation"

export const MODE_META: Record<
  VideoGenerationMode,
  { title: string; blurb: string; icon: React.ComponentType<{ className?: string }> }
> = {
  text_to_video: {
    title: "Text to Video",
    blurb: "Describe a scene in words and let Omni film it.",
    icon: Type,
  },
  image_to_video: {
    title: "Image to Video",
    blurb: "Animate a single still — bring a photo or drawing to life.",
    icon: ImageIcon,
  },
  reference_to_video: {
    title: "Reference to Video",
    blurb: "Give up to 3 subject images and stage them in a new clip.",
    icon: Layers,
  },
}

const ORDER: VideoGenerationMode[] = ["text_to_video", "image_to_video", "reference_to_video"]

export function VideoModeCards({
  mode,
  onSelect,
  locked,
  disabled,
}: {
  mode: VideoGenerationMode
  onSelect: (m: VideoGenerationMode) => void
  locked: boolean
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {ORDER.map((m, i) => {
        const meta = MODE_META[m]
        const Icon = meta.icon
        const active = mode === m
        return (
          <motion.button
            key={m}
            type="button"
            onClick={() => onSelect(m)}
            disabled={disabled}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
            whileHover={{ y: -3 }}
            className={cn(
              "relative text-left rounded-2xl border p-5 transition-colors overflow-hidden group",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              active
                ? "border-purple-500 bg-purple-50/70 dark:bg-purple-900/20 ring-1 ring-purple-500"
                : "border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 bg-white dark:bg-slate-900",
            )}
          >
            {active && (
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl" />
            )}
            <div className="relative flex items-center justify-between">
              <div
                className={cn(
                  "inline-flex items-center justify-center h-10 w-10 rounded-xl",
                  active
                    ? "bg-purple-600 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              {locked && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                  <Lock className="h-2.5 w-2.5" /> PRO
                </span>
              )}
            </div>
            <h3 className="relative mt-3 font-semibold text-slate-800 dark:text-slate-100">{meta.title}</h3>
            <p className="relative mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{meta.blurb}</p>
          </motion.button>
        )
      })}
    </div>
  )
}
