"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Button } from "@repo/ui/button"
import { ArrowLeft, ArrowRight, Loader2, Lock } from "lucide-react"

import ScriptGenerationStepper from "@/components/dashboard/scripts/ScriptGenerationStepper"
import ThumbnailStep1 from "./ThumbnailStep1"
import ThumbnailStep2 from "./ThumbnailStep2"
import ThumbnailStep3 from "./ThumbnailStep3"
import type { ThumbnailRatio } from "@/hooks/useThumbnailGeneration"

const formStepVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 50 },
}

interface ThumbnailFormProps {
  prompt: string
  setPrompt: (v: string) => void
  context: string
  setContext: (v: string) => void
  ratio: ThumbnailRatio
  setRatio: (v: ThumbnailRatio) => void
  videoLink: string
  setVideoLink: (v: string) => void
  referenceImage: File | null
  setReferenceImage: (v: File | null) => void
  faceImage: File | null
  setFaceImage: (v: File | null) => void
  isGenerating: boolean
  onGenerate: () => void
  onUsePreset: (prompt: string) => void
  locked?: boolean
}

export function ThumbnailForm({
  prompt, setPrompt,
  context, setContext,
  ratio, setRatio,
  videoLink, setVideoLink,
  referenceImage, setReferenceImage,
  faceImage, setFaceImage,
  isGenerating,
  onGenerate, onUsePreset,
  locked,
}: ThumbnailFormProps) {
  const [step, setStep] = useState(1)
  const [promptError, setPromptError] = useState<string | null>(null)

  const handleNext = () => {
    if (step === 1 && !prompt.trim()) {
      setPromptError("Prompt is required")
      return
    }
    if (step === 1 && prompt.trim().length < 3) {
      setPromptError("Prompt must be at least 3 characters")
      return
    }
    setPromptError(null)
    setStep(step + 1)
  }

  const handleGenerate = () => {
    if (!prompt.trim()) {
      setStep(1)
      setPromptError("Prompt is required")
      return
    }
    onGenerate()
  }

  const steps = [
    { id: 1, name: "Creative Direction" },
    { id: 2, name: "Style & Ratio" },
    { id: 3, name: "References & Generate" },
  ]

  return (
    <div className="relative space-y-6">
      <ScriptGenerationStepper steps={steps} currentStep={step} />

      <div className="relative h-[450px] overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={formStepVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="space-y-6 absolute w-full"
          >
            {step === 1 && (
              <ThumbnailStep1
                prompt={prompt}
                setPrompt={setPrompt}
                context={context}
                setContext={setContext}
                promptError={promptError}
                onUsePreset={onUsePreset}
              />
            )}
            {step === 2 && (
              <ThumbnailStep2
                ratio={ratio}
                setRatio={setRatio}
                videoLink={videoLink}
                setVideoLink={setVideoLink}
              />
            )}
            {step === 3 && (
              <ThumbnailStep3
                referenceImage={referenceImage}
                setReferenceImage={setReferenceImage}
                faceImage={faceImage}
                setFaceImage={setFaceImage}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1 || isGenerating}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {step < 3 ? (
          <Button
            onClick={handleNext}
            className="bg-slate-900 hover:bg-slate-800 text-white"
            disabled={isGenerating}
          >
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={locked ? onGenerate : handleGenerate}
            className="bg-slate-900 hover:bg-slate-800 text-white min-w-[180px]"
            disabled={!locked && isGenerating}
          >
            {locked ? (
              <>
                <Lock className="mr-2 h-4 w-4" /> Unlock to generate
              </>
            ) : isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              "Generate Thumbnails"
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
