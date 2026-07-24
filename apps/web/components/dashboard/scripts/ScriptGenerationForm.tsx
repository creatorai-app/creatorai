"use client"

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-m";
import { Button } from "@repo/ui/button";
import { ArrowLeft, ArrowRight, Loader2, Lock } from "lucide-react";
import ScriptGenerationStepper from "./ScriptGenerationStepper";
import FormStep1 from "./FormStep1";
import FormStep2 from "./FormStep2";
import FormStep3 from "./FormStep3"

interface ScriptGenerationFormProps {
  prompt: string; setPrompt: (v: string) => void
  context: string; setContext: (v: string) => void
  tone: string; setTone: (v: string) => void
  language: string; setLanguage: (v: string) => void
  duration: string; setDuration: (v: string) => void
  customDuration: string; setCustomDuration: (v: string) => void
  includeStorytelling: boolean; setIncludeStorytelling: (v: boolean) => void
  includeTimestamps: boolean; setIncludeTimestamps: (v: boolean) => void
  references: string[]; setReferences: (v: string[]) => void
  files: File[]; setFiles: React.Dispatch<React.SetStateAction<File[]>>
  isGenerating: boolean
  onGenerate: () => void
  locked?: boolean
}

const formStepVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 50 },
}

export default function ScriptGenerationForm(props: ScriptGenerationFormProps) {
  const [step, setStep] = useState(1)
  const [promptError, setPromptError] = useState<string | null>(null)

  const handleNext = () => {
    if (step === 1 && !props.prompt.trim()) {
      setPromptError("Prompt is required")
      return
    }
    setPromptError(null)
    setStep(step + 1)
  }

  const handleGenerate = () => {
    if (!props.prompt.trim()) {
      setStep(1)
      setPromptError("Prompt is required")
      return
    }
    props.onGenerate()
  }

  const steps = [
    { id: 1, name: "Core Idea" },
    { id: 2, name: "Style & Tone" },
    { id: 3, name: "Sources & Generate" },
  ]

  return (
    <div className="relative space-y-6">
      <ScriptGenerationStepper steps={steps} currentStep={step} />

      <div className="relative min-h-[450px] overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={formStepVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="space-y-6 w-full"
          >
            {step === 1 && (
              <FormStep1
                prompt={props.prompt}
                setPrompt={props.setPrompt}
                context={props.context}
                setContext={props.setContext}
                promptError={promptError}
              />
            )}
            {step === 2 && (
              <FormStep2
                tone={props.tone} setTone={props.setTone}
                language={props.language} setLanguage={props.setLanguage}
                includeStorytelling={props.includeStorytelling} setIncludeStorytelling={props.setIncludeStorytelling}
                customDuration={props.customDuration} setCustomDuration={props.setCustomDuration}
                duration={props.duration} setDuration={props.setDuration}
                includeTimestamps={props.includeTimestamps} setIncludeTimestamps={props.setIncludeTimestamps}
              />
            )}
            {step === 3 && (
              <FormStep3
                references={props.references}
                setReferences={props.setReferences}
                files={props.files}
                setFiles={props.setFiles}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1 || props.isGenerating}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {step < 3 ? (
          <Button
            onClick={handleNext}
            className="bg-slate-900 hover:bg-slate-800 text-white"
            disabled={props.isGenerating}
          >
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={props.locked ? props.onGenerate : handleGenerate}
            className="bg-slate-900 hover:bg-slate-800 text-white min-w-[180px]"
            disabled={!props.locked && props.isGenerating}
          >
            {props.locked ? (
              <><Lock className="mr-2 h-4 w-4" /> Unlock to generate</>
            ) : props.isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              "Generate Script"
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
