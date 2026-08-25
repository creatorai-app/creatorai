"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Clapperboard } from "lucide-react"
import { getVideoGenerationAccess } from "@/lib/api/getVideoGenerations"
import { useVideoGeneration } from "@/hooks/useVideoGeneration"
import { VideoModeCards } from "@/components/dashboard/video-generation/VideoModeCards"
import { VideoGenerationForm } from "@/components/dashboard/video-generation/VideoGenerationForm"
import { VideoHowItWorksGuide } from "@/components/dashboard/video-generation/VideoHowItWorksGuide"
import { VideoUpgradeCard } from "@/components/dashboard/video-generation/VideoUpgradeCard"
import { Button } from "@repo/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@repo/ui/dialog"
import { useAISetupGate } from "@/hooks/useAISetupGate"

export default function VideoGenerationPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const vm = useVideoGeneration()
  const gate = useAISetupGate()

  useEffect(() => {
    getVideoGenerationAccess().then((a) => setAllowed(a.allowed))
  }, [])

  // UI is fully unlocked so everyone can explore the modes; the gates fire on
  // Generate. Setup is checked before the plan because that's the order the API
  // enforces. The server still enforces both authoritatively regardless.
  const planLocked = allowed === false
  const locked = gate.locked || planLocked
  const handleGenerate = async () => {
    if (gate.locked) {
      gate.requestUnlock()
      return
    }
    if (planLocked) {
      setShowUpgrade(true)
      return
    }
    await vm.handleGenerate()
  }

  return (
    <div className="container py-8 md:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Video Generation
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Turn a prompt, an image, or reference subjects into a fully generated video clip with AI
          </p>
        </div>
        <Link href="/dashboard/video-generation/history">
          <Button variant="outline">
            <Clapperboard className="mr-2 h-4 w-4" />
            My videos
          </Button>
        </Link>
      </div>

      {gate.banner && <div className="mb-8">{gate.banner}</div>}

      <div className="mb-8">
        <VideoModeCards mode={vm.mode} onSelect={vm.setMode} locked={locked} disabled={vm.isGenerating} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* How it works on the left, the prompt/generation form on the right. */}
        <div className="order-2 lg:order-1">
          <VideoHowItWorksGuide />
        </div>
        <div className="order-1 lg:order-2">
          <VideoGenerationForm vm={{ ...vm, handleGenerate }} locked={locked} />
        </div>
      </div>

      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent className="max-w-xl border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Upgrade to unlock video generation</DialogTitle>
          <VideoUpgradeCard />
        </DialogContent>
      </Dialog>

      {gate.modal}
    </div>
  )
}
