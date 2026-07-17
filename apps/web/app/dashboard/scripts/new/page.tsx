"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useScriptGeneration } from "@/hooks/useScriptGeneration"
import { useSupabase } from "@/components/supabase-provider"
import ScriptGenerationForm from "@/components/dashboard/scripts/ScriptGenerationForm"
import ScriptOutputPanel from "@/components/dashboard/scripts/ScriptOutputPanel"
import { ScriptHowItWorksGuide } from "@/components/dashboard/scripts/ScriptHowItWorksGuide"
import { useAISetupGate } from "@/hooks/useAISetupGate"
import { Skeleton } from "@repo/ui/skeleton"
import { Badge } from "@repo/ui/badge"
import { Sparkles } from "lucide-react"
import { api } from "@/lib/api-client"
import type { IdeationJob } from "@repo/validation"

function NewScriptPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profileLoading } = useSupabase()
  const gate = useAISetupGate()

  const ideationId = searchParams.get("ideationId") ?? undefined
  const ideaIndex = searchParams.get("ideaIndex") != null ? Number(searchParams.get("ideaIndex")) : undefined
  const [ideaTitle, setIdeaTitle] = useState<string | null>(null)

  useEffect(() => {
    if (!ideationId || ideaIndex == null) return
    (async () => {
      try {
        const job = await api.get<IdeationJob>(`/api/v1/ideation/${ideationId}`, { requireAuth: true })
        const idea = job.result?.ideas?.[ideaIndex]
        if (idea) setIdeaTitle(idea.title)
      } catch { /* ignore */ }
    })()
  }, [ideationId, ideaIndex])

  const hook = useScriptGeneration({
    onComplete: (id) => router.push(`/dashboard/scripts/${id}`),
    initialIdeationId: ideationId,
    initialIdeaIndex: ideaIndex,
    initialPrompt: ideaTitle ?? "",
  })

  useEffect(() => {
    if (ideaTitle && !hook.prompt) hook.setPrompt(ideaTitle)
  }, [ideaTitle])

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
        <h1 className="text-3xl font-bold tracking-tight">Create New Script</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Generate AI-powered scripts personalized to your channel style
        </p>
        {ideaTitle && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              <Sparkles className="h-3 w-3 mr-1" /> From Ideation
            </Badge>
            <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-md">{ideaTitle}</span>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
          {hook.showOutput ? (
            <motion.div
              key="output"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <ScriptOutputPanel
                isGenerating={hook.isGenerating}
                progress={hook.progress}
                statusMessage={hook.statusMessage}
                generatedScript={hook.generatedScript}
                setGeneratedScript={hook.setGeneratedScript}
                generatedTitle={hook.generatedTitle}
                setGeneratedTitle={hook.setGeneratedTitle}
                creditsConsumed={hook.creditsConsumed}
                scriptId={hook.scriptJobId}
                onRegenerate={hook.handleRegenerate}
                onNewGeneration={hook.clearForm}
              />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
            >
              <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-8">
                <ScriptHowItWorksGuide />
              </div>
              <div className="lg:col-span-2">
                <ScriptGenerationForm
                  prompt={hook.prompt} setPrompt={hook.setPrompt}
                  context={hook.context} setContext={hook.setContext}
                  tone={hook.tone} setTone={hook.setTone}
                  language={hook.language} setLanguage={hook.setLanguage}
                  duration={hook.duration} setDuration={hook.setDuration}
                  customDuration={hook.customDuration} setCustomDuration={hook.setCustomDuration}
                  includeStorytelling={hook.includeStorytelling} setIncludeStorytelling={hook.setIncludeStorytelling}
                  includeTimestamps={hook.includeTimestamps} setIncludeTimestamps={hook.setIncludeTimestamps}
                  references={hook.references} setReferences={hook.setReferences}
                  files={hook.files} setFiles={hook.setFiles}
                  isGenerating={hook.isGenerating}
                  onGenerate={gate.locked ? gate.requestUnlock : hook.handleGenerate}
                  locked={gate.locked}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      {gate.modal}
    </motion.div>
  )
}

export default function NewScriptPage() {
  return (
    <Suspense fallback={
      <div className="container py-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-[600px] rounded-lg mt-8" />
      </div>
    }>
      <NewScriptPageInner />
    </Suspense>
  )
}
