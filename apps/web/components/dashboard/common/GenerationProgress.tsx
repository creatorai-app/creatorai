"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import * as motion from "motion/react-m";
import { Progress } from "@repo/ui/progress";
import { Button } from "@repo/ui/button";
import { Bot, CheckCircle2, Loader2, Sparkles, Square, Upload, type LucideIcon } from "lucide-react"

export interface GenerationProgressStep {
  label: string
  icon: LucideIcon
  threshold: number
}

interface GenerationProgressProps {
  progress: number
  statusMessage: string
  title?: string
  steps?: GenerationProgressStep[]
  icon?: LucideIcon
  hint?: string
  compact?: boolean
  onStop?: () => void
  stopLabel?: string
}

const DEFAULT_STEPS: GenerationProgressStep[] = [
  { label: "Queued", icon: Loader2, threshold: 0 },
  { label: "Preparing", icon: Sparkles, threshold: 10 },
  { label: "Generating", icon: Bot, threshold: 30 },
  { label: "Saving", icon: Upload, threshold: 80 },
  { label: "Done", icon: CheckCircle2, threshold: 100 },
]

export function GenerationProgress({
  progress,
  statusMessage,
  title = "Generation in Progress",
  steps = DEFAULT_STEPS,
  icon: Icon = Bot,
  hint,
  compact = false,
  onStop,
  stopLabel = "Stop Training",
}: GenerationProgressProps) {
  const resolvedSteps = steps.length > 0 ? steps : DEFAULT_STEPS

  const currentStepIndex = resolvedSteps.reduce(
    (acc, step, idx) => (progress >= step.threshold ? idx : acc),
    0,
  )

  const content = (
    <>
      {!compact && (
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center justify-center w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-900/50"
        >
          <Icon className="h-10 w-10 text-purple-600 dark:text-purple-400" />
        </motion.div>
      )}

      <div className={`space-y-2 ${compact ? "w-full" : "w-full max-w-md"}`}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">{statusMessage}</span>
              <span className="font-medium text-purple-600 dark:text-purple-400">{progress}%</span>
            </div>
        <Progress value={progress} className="h-2.5" />
      </div>

      <div className={`flex items-center justify-between ${compact ? "w-full" : "w-full max-w-md"}`}>
            {resolvedSteps.map((step, idx) => {
              const StepIcon = step.icon
              const isActive = idx === currentStepIndex
              const isCompleted = idx < currentStepIndex

              return (
                <div key={step.label} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300
                      ${isActive
                        ? "bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 ring-2 ring-purple-300 dark:ring-purple-700"
                        : isCompleted
                          ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600"
                      }
                    `}
                  >
                    <StepIcon className={`h-4 w-4 ${isActive ? "animate-pulse" : ""}`} />
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isActive
                        ? "text-purple-600 dark:text-purple-400"
                        : isCompleted
                          ? "text-green-600 dark:text-green-400"
                          : "text-slate-400 dark:text-slate-600"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )
        })}
      </div>

      <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-purple-400"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
      </div>

      {hint && (
        <p className="text-xs text-slate-500 text-center">{hint}</p>
      )}

      {onStop && (
        <Button
          variant="outline"
          size="sm"
          onClick={onStop}
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/30"
        >
          <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
          {stopLabel}
        </Button>
      )}
    </>
  )

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-slate-900">
          <CardContent className="pt-6 space-y-6">
            {content}
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-[calc(100vh-16rem)] flex items-stretch"
    >
      <Card className="w-full border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-slate-900 flex flex-col">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center space-y-8 px-8">
          {content}
        </CardContent>
      </Card>
    </motion.div>
  )
}
