"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { useStoryBuilder } from "@/hooks/useStoryBuilder"
import { useSupabase } from "@/components/supabase-provider"
import { StoryBuilderForm } from "@/components/dashboard/story-builder/StoryBuilderForm"
import { StoryBuilderProgress } from "@/components/dashboard/story-builder/StoryBuilderProgress"
import { StoryBuilderResults } from "@/components/dashboard/story-builder/StoryBuilderResults"
import { useAISetupGate } from "@/hooks/useAISetupGate"
import { Skeleton } from "@repo/ui/skeleton"
import { Badge } from "@repo/ui/badge"
import { Sparkles } from "lucide-react"

export default function NewStoryBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profileLoading } = useSupabase()
  const gate = useAISetupGate()

  const hook = useStoryBuilder({
    onComplete: (id) => router.push(`/dashboard/story-builder/${id}`),
  })

  useEffect(() => {
    const topic = searchParams.get("topic")
    const ideationId = searchParams.get("ideationId")
    const ideaIndex = searchParams.get("ideaIndex")
    if (topic && !hook.videoTopic) hook.setVideoTopic(topic)
    if (ideationId && ideaIndex != null) {
      hook.handleSelectIdea(ideationId, Number(ideaIndex), topic || "")
    }
  }, [searchParams])

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
        <h1 className="text-3xl font-bold tracking-tight">Create Story Blueprint</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Build modular story blueprints with structured hooks, escalation segments, and retention scoring
        </p>
        {searchParams.get("ideationId") && hook.videoTopic && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              <Sparkles className="h-3 w-3 mr-1" /> From Ideation
            </Badge>
            <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-md">{hook.videoTopic}</span>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
          {hook.generatedResult ? (
            <motion.div
              key="output"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <StoryBuilderResults
                result={hook.generatedResult}
                onRegenerate={hook.handleRegenerate}
                isGenerating={hook.isGenerating}
              />
            </motion.div>
          ) : hook.isGenerating ? (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <StoryBuilderProgress
                progress={hook.progress}
                statusMessage={hook.statusMessage}
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
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                  <StoryBuilderForm
                    videoTopic={hook.videoTopic}
                    setVideoTopic={hook.setVideoTopic}
                    targetAudience={hook.targetAudience}
                    setTargetAudience={hook.setTargetAudience}
                    audienceLevel={hook.audienceLevel}
                    setAudienceLevel={hook.setAudienceLevel}
                    videoDuration={hook.videoDuration}
                    setVideoDuration={hook.setVideoDuration}
                    contentType={hook.contentType}
                    setContentType={hook.setContentType}
                    storyMode={hook.storyMode}
                    setStoryMode={hook.setStoryMode}
                    tone={hook.tone}
                    setTone={hook.setTone}
                    additionalContext={hook.additionalContext}
                    setAdditionalContext={hook.setAdditionalContext}
                    personalized={hook.personalized}
                    setPersonalized={hook.setPersonalized}
                    aiTrained={hook.aiTrained}
                    isGenerating={hook.isGenerating}
                    onGenerate={gate.locked ? gate.requestUnlock : hook.handleGenerate}
                    locked={gate.locked}
                    ideationJobs={hook.ideationJobs}
                    isLoadingIdeations={hook.isLoadingIdeations}
                    onSelectIdea={hook.handleSelectIdea}
                    selectedIdeationId={hook.selectedIdeationId}
                    selectedIdeaIndex={hook.selectedIdeaIndex}
                  />
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="rounded-lg border bg-slate-50 dark:bg-slate-800/50 p-5 space-y-3">
                    <h3 className="font-semibold text-sm">What you&apos;ll get</h3>
                    <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">&#9679;</span>
                        Structured hook with curiosity, promise &amp; stakes
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-500 mt-0.5">&#9679;</span>
                        Context setup with problem &amp; why it matters
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">&#9679;</span>
                        Escalation segments with micro-hooks &amp; transitions
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">&#9679;</span>
                        Climax with insights, twists &amp; value moments
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-0.5">&#9679;</span>
                        Resolution + callback with soft CTA
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-indigo-500 mt-0.5">&#128202;</span>
                        Tension mapping: retention score, curiosity loops, drop risk
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-pink-500 mt-0.5">&#10084;&#65039;</span>
                        Emotional arc, retention beats &amp; pattern interrupts
                      </li>
                    </ul>
                  </div>

                  {hook.aiTrained && (
                    <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-5 space-y-2">
                      <h3 className="font-semibold text-sm flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
                        <span>&#10024;</span> Powered by your style
                      </h3>
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        Your AI is trained! Blueprints adapt to your channel&apos;s pacing, humor frequency,
                        direct address style, stats usage, and emotional tone patterns.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      {gate.modal}
    </motion.div>
  )
}
