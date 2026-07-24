"use client"

import * as motion from "motion/react-m";
import {
  Video,
  PenTool,
  Lightbulb,
  Clapperboard,
  ImageIcon,
  MessageSquare,
  Globe,
  Gift,
  BookOpen,
  Film,
  Volume2,
} from "lucide-react";
import FeatureCard from "../feature-card"

const features = [
  {
    title: "AI Studio",
    icon: Video,
    description:
      "Connect your YouTube channel and train the AI on your videos. It learns how you talk, your style, and what makes your content unique.",
  },
  {
    title: "Video Ideas",
    icon: Lightbulb,
    description:
      "Stuck on what to make next? Get trending video ideas tailored to your niche and audience. No more guessing what will perform.",
  },
  {
    title: "Script Writing",
    icon: PenTool,
    description:
      "Give the AI a topic and get a full script that sounds like you wrote it. Choose your tone, add context, and pick your language.",
  },
  {
    title: "Story Builder",
    icon: Clapperboard,
    description:
      "Plan your video structure with hooks, key moments, and pacing. Get a retention score so you know if your story will keep viewers watching.",
  },
  {
    title: "Thumbnails",
    icon: ImageIcon,
    description:
      "Generate click-worthy thumbnails that match your brand. Upload a frame from your video or describe what you want.",
  },
  {
    title: "Subtitles",
    icon: MessageSquare,
    description:
      "Upload your video and get accurate subtitles automatically. Edit them, style them, and export as SRT or VTT files.",
  },
  {
    title: "Multi-Language Support",
    icon: Globe,
    description:
      "Create scripts and content in multiple languages to reach viewers around the world.",
  },
  {
    title: "Referral Program",
    icon: Gift,
    description:
      "Invite creator friends and you both win: when a friend you referred makes their first purchase, you each get 1,000 credits.",
  },
  {
    title: "Video Generation",
    icon: Film,
    description:
      "Turn your scripts into full videos with AI-generated scenes, captions, and music. Coming soon.",
  },
  {
    title: "Course Builder",
    icon: BookOpen,
    description:
      "Break down complex topics into structured video courses with outlines and scripts. Coming soon.",
  },
  {
    title: "Audio Dubbing",
    icon: Volume2,
    description:
      "Dub your videos into other languages while keeping your voice. Coming soon.",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

export default function FeatureSection() {
  return (
    <div className="container px-4 md:px-6">
      <motion.div
        className="flex flex-col items-center text-center space-y-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50">
          Everything You Need to Create Better Content
        </h2>
        <p className="max-w-[700px] text-slate-600 dark:text-slate-400 md:text-lg">
          From brainstorming ideas to publishing your video. Creator AI has a tool for every step.
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <motion.div
              key={index}
              variants={itemVariants}
              transition={{ type: "spring", stiffness: 100, damping: 14 }}
            >
              <FeatureCard
                title={feature.title}
                icon={<Icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />}
                description={feature.description}
              />
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
