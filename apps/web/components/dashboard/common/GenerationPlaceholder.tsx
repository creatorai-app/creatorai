"use client"
import { Wand } from "lucide-react";
import * as motion from "motion/react-m";

interface GenerationPlaceholderProps {
  title?: string
  description?: string
}

export function GenerationPlaceholder({
  title = "Ready to create?",
  description = "Fill out the form and let AI bring your ideas to life.",
}: GenerationPlaceholderProps) {
  return (
    <div
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.08) 1px, transparent 0)",
        backgroundSize: "20px 20px",
      }}
      className="flex flex-col items-center justify-center h-[400px] text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 relative overflow-hidden"
    >
      <div className="z-10">
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Wand className="h-12 w-12 text-slate-400 mb-4 mx-auto" />
        </motion.div>
        <p className="text-slate-700 dark:text-slate-300 font-semibold text-lg">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-500 max-w-xs mx-auto">{description}</p>
      </div>
    </div>
  )
}
