"use client"
import { SuccessDialog } from "@/components/success-dialog";
import * as motion from "motion/react-m";
import { PenTool, Search, Volume2, ImageIcon, Subtitles, BookOpen } from "lucide-react";
import { useAITraining } from "@/hooks/useAITraining";
import { HowItWorksGuide } from "@/components/dashboard/train/HowItWorksGuide";
import { TrainAIHeader } from "@/components/dashboard/train/TrainAIHeader";
import { TrainAIPageSkeleton } from "@/components/dashboard/train/skeleton/TrainAIPageSkeleton";
import { ChannelVideoGrid } from "@/components/dashboard/train/ChannelVideoGrid";
import { TrainingProgress } from "@/components/dashboard/train/TrainingProgress"

const nextSteps = [
  { title: "Create Scripts", description: "Generate scripts in your style", icon: PenTool, href: "/dashboard/scripts" },
  { title: "Ideation", description: "Discover trending ideas", icon: Search, href: "/dashboard/research" },
  { title: "Audio Dubbing", description: "Dub audio in any language", icon: Volume2, href: "/dashboard/dubbing" },
  { title: "Thumbnails", description: "AI-generated thumbnails", icon: ImageIcon, href: "/dashboard/thumbnails" },
  { title: "Subtitles", description: "Auto-generate subtitles", icon: Subtitles, href: "/dashboard/subtitles" },
  { title: "Story Builder", description: "Build story structures", icon: BookOpen, href: "/dashboard/story-builder" },
]

export default function TrainAIPage() {
  const {
    profile,
    isTraining,
    progress,
    statusMessage,
    uploading,
    showModal,
    selectedVideoIds,
    lastCreditsConsumed,
    setShowModal,
    handleToggleVideo,
    handleStartTraining,
    handleStopTraining,
  } = useAITraining();

  if (!profile) {
    return <TrainAIPageSkeleton />;
  }

  return (
    <div className="container py-8 h-full">
      <TrainAIHeader
        isYtConnected={profile.youtube_connected}
        isAiTrained={profile.ai_trained}
        lastCreditsConsumed={lastCreditsConsumed}
      />

      <motion.div
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-start"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="lg:col-span-4 lg:sticky lg:top-8">
          <HowItWorksGuide />
        </div>

        <div className="lg:col-span-8">
          {isTraining ? (
            <TrainingProgress progress={progress} statusMessage={statusMessage} onStop={handleStopTraining} />
          ) : (
            <ChannelVideoGrid
              isYtConnected={profile?.youtube_connected}
              isAiTrained={profile?.ai_trained}
              selectedVideoIds={selectedVideoIds}
              onToggleVideo={handleToggleVideo}
              uploading={uploading}
              onStartTraining={handleStartTraining}
            />
          )}
        </div>
      </motion.div>

      <SuccessDialog
        open={showModal}
        onOpenChange={setShowModal}
        title="Model Training Complete!"
        description="Your AI model has been trained on your unique style. Enjoy the personalized experience."
        nextSteps={nextSteps}
      />
    </div>
  );
}
