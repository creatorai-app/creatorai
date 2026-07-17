"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { useThumbnailGeneration } from "@/hooks/useThumbnailGeneration"
import { useSupabase } from "@/components/supabase-provider"
import { ThumbnailForm } from "@/components/dashboard/thumbnails/ThumbnailForm"
import { ThumbnailOutputPanel } from "@/components/dashboard/thumbnails/ThumbnailOutputPanel"
import { VideoFrameModal } from "@/components/dashboard/thumbnails/VideoFrameModal"
import { useAISetupGate } from "@/hooks/useAISetupGate"
import { Skeleton } from "@repo/ui/skeleton"
import { Badge } from "@repo/ui/badge"
import { FileText, Clapperboard } from "lucide-react"

function NewThumbnailPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profileLoading } = useSupabase()
  const gate = useAISetupGate()

  const scriptId = searchParams.get("scriptId") ?? undefined
  const storyBuilderId = searchParams.get("storyBuilderId") ?? undefined
  const initialPrompt = searchParams.get("prompt") ?? undefined

  const {
    prompt, setPrompt,
    context, setContext,
    ratio, setRatio,
    videoLink, setVideoLink,
    referenceImage, setReferenceImage,
    faceImage, setFaceImage,
    isGenerating, progress, statusMessage,
    generatedImages, creditsConsumed,
    showOutput,
    handleGenerate, handleRegenerate,
    handleDownload, handleUsePreset, clearForm,
  } = useThumbnailGeneration({
    onComplete: (id) => router.push(`/dashboard/thumbnails/${id}`),
    initialPrompt,
    initialScriptId: scriptId,
    initialStoryBuilderId: storyBuilderId,
  })

  const sourceLabel = scriptId ? "Script" : storyBuilderId ? "Story Builder" : null
  const SourceIcon = scriptId ? FileText : Clapperboard

  const [showFrameModal, setShowFrameModal] = useState(false)

  if (profileLoading) {
    return (
      <div className="container py-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-[600px] rounded-lg mt-8" />
      </div>
    )
  }

  return (
    <motion.div
      className="container py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create New Thumbnail</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Generate AI-powered thumbnails personalized to your channel style
        </p>
        {sourceLabel && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              <SourceIcon className="h-3 w-3 mr-1" /> From {sourceLabel}
            </Badge>
            {initialPrompt && <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-md">{initialPrompt}</span>}
          </div>
        )}
      </div>

      <div className="max-w-full mx-auto">
          <AnimatePresence mode="wait">
            {showOutput ? (
              <motion.div
                key="output"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
              >
                <ThumbnailOutputPanel
                  isGenerating={isGenerating}
                  progress={progress}
                  statusMessage={statusMessage}
                  generatedImages={generatedImages}
                  creditsConsumed={creditsConsumed}
                  onRegenerate={handleRegenerate}
                  onDownload={handleDownload}
                  onNewGeneration={clearForm}
                />
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.3 }}
              >
                <ThumbnailForm
                  prompt={prompt}
                  setPrompt={setPrompt}
                  context={context}
                  setContext={setContext}
                  ratio={ratio}
                  setRatio={setRatio}
                  videoLink={videoLink}
                  setVideoLink={setVideoLink}
                  referenceImage={referenceImage}
                  setReferenceImage={setReferenceImage}
                  faceImage={faceImage}
                  setFaceImage={setFaceImage}
                  isGenerating={isGenerating}
                  onGenerate={gate.locked ? gate.requestUnlock : handleGenerate}
                  locked={gate.locked}
                  onUsePreset={handleUsePreset}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      {gate.modal}

      <VideoFrameModal
        open={showFrameModal}
        onOpenChange={setShowFrameModal}
        videoUrl={videoLink}
        onFrameCapture={(file) => setReferenceImage(file)}
      />
    </motion.div>
  )
}

export default function NewThumbnailPage() {
  return (
    <Suspense fallback={
      <div className="container py-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-[600px] rounded-lg mt-8" />
      </div>
    }>
      <NewThumbnailPageInner />
    </Suspense>
  )
}
