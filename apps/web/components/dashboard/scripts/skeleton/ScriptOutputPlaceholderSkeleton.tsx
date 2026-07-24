"use client"

import * as motion from "motion/react-m";
import { Wand } from "lucide-react"

interface ScriptOutputPlaceholderProps {
    loading: boolean
}

// A single, reusable animated div for the skeleton parts
const SkeletonPiece = ({
    className,
    delay = 0,
}: {
    className?: string
    delay?: number
}) => (
    <motion.div
        className={`bg-slate-200 dark:bg-slate-700 rounded-md ${className}`}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{
            duration: 1.8,
            ease: "easeInOut",
            repeat: Infinity,
            delay,
        }}
    />
)

export default function ScriptOutputPlaceholderSkeleton({
    loading,
}: ScriptOutputPlaceholderProps) {
    return (
        <div
            style={{
                backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.08) 1px, transparent 0)",
                backgroundSize: "20px 20px",
            }}
            className="flex flex-col items-center justify-center h-[400px] text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 relative overflow-hidden"
        >
            {loading ? (
                // Skeleton UI that mimics a title and paragraphs
                <div className="w-full max-w-md mx-auto space-y-4">
                    {/* Skeleton for Title */}
                    <SkeletonPiece className="h-6 w-3/5" />

                    {/* Skeleton for Content Body */}
                    <div className="space-y-3 pt-2">
                        <SkeletonPiece className="h-4 w-full" delay={0.1} />
                        <SkeletonPiece className="h-4 w-11/12" delay={0.2} />
                        <SkeletonPiece className="h-4 w-4/5" delay={0.3} />
                        <SkeletonPiece className="h-4 w-full" delay={0.4} />
                        <SkeletonPiece className="h-4 w-3/4" delay={0.5} />
                    </div>
                </div>
            ) : (
                // Initial "Ready to Create" State
                <div className="z-10">
                    <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Wand className="h-12 w-12 text-slate-400 mb-4 mx-auto" />
                    </motion.div>
                    <p className="text-slate-700 dark:text-slate-300 font-semibold text-lg">
                        Ready to create magic?
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-500 max-w-xs mx-auto">
                        Fill out the form and let the AI assistant bring your ideas to life.
                    </p>
                </div>
            )}
        </div>
    )
}