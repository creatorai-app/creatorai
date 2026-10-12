"use client"

import { Loader2, Sparkles, Bot, Upload, CheckCircle2 } from "lucide-react"
import { GenerationProgress, type GenerationProgressStep } from "@/components/dashboard/common/GenerationProgress"

const TRAIN_STEPS: GenerationProgressStep[] = [
  { label: "Queued", icon: Loader2, threshold: 0 },
  { label: "Analyzing", icon: Sparkles, threshold: 10 },
  { label: "Building", icon: Bot, threshold: 30 },
  { label: "Saving", icon: Upload, threshold: 80 },
  { label: "Done", icon: CheckCircle2, threshold: 100 },
]

interface TrainingProgressProps {
  progress: number
  statusMessage: string
  onStop?: () => void
}

export function TrainingProgress({ progress, statusMessage, onStop }: TrainingProgressProps) {
  return (
    <GenerationProgress
      progress={progress}
      statusMessage={statusMessage}
      title="Building Your AI Memory"
      steps={TRAIN_STEPS}
      hint="This may take 2-5 minutes depending on video length"
      onStop={onStop}
    />
  )
}
