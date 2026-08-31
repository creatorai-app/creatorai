import type { LucideIcon } from "lucide-react";
import {
  Video,
  PenTool,
  Lightbulb,
  Clapperboard,
  ImageIcon,
  MessageSquare,
  BookOpen,
  BarChart3,
  Gift,
  Languages,
  Film,
} from "lucide-react";

/**
 * The canonical list of what Creator AI ships.
 *
 * Lived inline in app/features/page.tsx, which meant the /tools page had to
 * keep its own copy and the two drifted immediately: /features was missing
 * dubbing and video generation entirely even though both have shipped
 * dashboard routes. One list, imported by both, so "all the features" stays
 * true in both places.
 *
 * `id` doubles as the /features anchor, so nav dropdown links like
 * /features#dubbing resolve to a real section.
 */

export interface ProductFeature {
  id: string;
  title: string;
  tagline: string;
  /** Card-grid copy: one keyword-bearing sentence, kept to a similar length
   *  across every feature so cards in a row stay the same height. */
  cardDescription: string;
  description: string;
  highlights: string[];
  icon: LucideIcon;
  gradient: string;
}

export interface SimpleFeature {
  title: string;
  description: string;
  cardDescription: string;
  icon: LucideIcon;
}

export const CORE_FEATURES: ProductFeature[] = [
  {
    id: "ai-studio",
    title: "AI Studio",
    cardDescription:
      "Train the AI on your own YouTube videos so every script matches your tone, pacing and vocabulary.",
    tagline: "Train the AI to sound like you",
    description:
      "Connect your YouTube channel and pick a few of your best videos. The AI watches them and learns your tone, vocabulary, pacing, and style. Once trained, everything it creates is personalized to you, not generic.",
    highlights: [
      "Connect your YouTube channel in one click",
      "Select 3-5 videos to train your personal AI model",
      "AI learns your speaking style, humor, and vocabulary",
      "Powers all other features with your unique voice",
    ],
    icon: Video,
    gradient: "from-purple-500 to-indigo-500",
  },
  {
    id: "scripts",
    title: "Script Writing",
    cardDescription:
      "Generate full YouTube scripts in your own voice, with a hook, real transitions and a closing call to action.",
    tagline: "Full scripts in your voice, in minutes",
    description:
      "Tell the AI what your video is about, pick a tone, add any context you want, and get a complete script that actually sounds like you. Choose your language, set the duration, and even enable storytelling mode or timestamps.",
    highlights: [
      "Generate scripts from a simple prompt",
      "Choose tone, language, and video length",
      "Add references, links, or upload files for context",
      "Enable storytelling mode and timestamps",
    ],
    icon: PenTool,
    gradient: "from-pink-500 to-rose-500",
  },
  {
    id: "ideation",
    title: "Video Ideas",
    cardDescription:
      "Find trending video ideas in your niche, scored for opportunity and matched to what your channel already publishes.",
    tagline: "Never run out of video ideas",
    description:
      "Let the AI find trending topics in your niche and generate video ideas tailored to your channel. It looks at what's working, spots gaps, and suggests ideas with high potential. You can go fully automatic or focus on a specific topic.",
    highlights: [
      "AI-powered trend analysis for your niche",
      "Auto mode or manual topic focus",
      "Generate 1-5 ideas per session",
      "Opportunity scores and trend snapshots for each idea",
    ],
    icon: Lightbulb,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    id: "story-builder",
    title: "Story Builder",
    cardDescription:
      "Plan your video structure with hooks and escalation points, plus a retention score before you start filming.",
    tagline: "Plan videos that keep viewers watching",
    description:
      "Create a structured story blueprint before you start writing. Define your audience, content type, and tone. The AI builds a full outline with hooks, escalation points, and a retention score so you know if your video will hold attention.",
    highlights: [
      "Structured story outlines with hooks and pacing",
      "Retention scoring to predict viewer engagement",
      "Choose audience, duration, and content type",
      "Link ideation ideas directly into your story",
    ],
    icon: Clapperboard,
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    id: "thumbnails",
    title: "Thumbnails",
    cardDescription:
      "Create click-worthy YouTube thumbnails from a prompt, a frame of your video, or your own reference images.",
    tagline: "Thumbnails that get clicks",
    description:
      "Generate eye-catching thumbnails that match your brand style. Describe what you want, upload a frame from your video, or add reference images. The AI creates professional thumbnails you can use right away.",
    highlights: [
      "AI-generated thumbnails from text descriptions",
      "Upload video frames or reference images",
      "Multiple aspect ratio options",
      "Consistent with your brand identity",
    ],
    icon: ImageIcon,
    gradient: "from-emerald-500 to-green-500",
  },
  {
    id: "subtitles",
    title: "Subtitles",
    cardDescription:
      "Auto-generate accurate video subtitles, edit them inline against the player, and export them as SRT or VTT.",
    tagline: "Accurate subtitles, automatically",
    description:
      "Upload your video and get timed subtitles generated automatically. Edit them inline with a built-in video player, style them how you want, and export as SRT or VTT. No manual transcription needed.",
    highlights: [
      "Auto-transcription from video upload",
      "Built-in subtitle editor with video player",
      "Style and customize your subtitles",
      "Export as SRT or VTT files",
    ],
    icon: MessageSquare,
    gradient: "from-violet-500 to-purple-500",
  },
  {
    id: "dubbing",
    title: "Audio Dubbing",
    cardDescription:
      "Dub your videos into other languages using a clone of your own voice rather than a stock narrator.",
    tagline: "Reach a global audience in your own voice",
    description:
      "Dub a finished video into another language without hiring a voice actor. The AI clones your voice, so the translated version still sounds like your channel rather than a stock narrator.",
    highlights: [
      "Dub finished videos into other languages",
      "Voice cloning keeps your own delivery",
      "Translated audio timed to the original video",
      "Download the dubbed track when it is done",
    ],
    icon: Languages,
    gradient: "from-teal-500 to-emerald-500",
  },
  {
    id: "video-generation",
    title: "Video Generation",
    cardDescription:
      "Generate short video clips with audio from a text prompt or a starting image, ready for B-roll and openers.",
    tagline: "Turn a prompt into a usable clip",
    description:
      "Generate short video clips from a text prompt or a starting image, with audio. Useful for B-roll, an opening shot, or testing how an idea looks before committing to a full shoot.",
    highlights: [
      "Generate clips from a text prompt",
      "Start from an image for more control",
      "Audio generated alongside the video",
      "Download and drop straight into your edit",
    ],
    icon: Film,
    gradient: "from-fuchsia-500 to-pink-500",
  },
]

export const COMING_SOON_FEATURES: SimpleFeature[] = [
  {
    title: "Course Builder",
    description: "Break down complex topics into structured video courses with organized outlines and scripts.",
    cardDescription:
      "Break a complex topic into a structured video course with organized outlines and a script per lesson.",
    icon: BookOpen,
  },
]

export const EXTRA_FEATURES: SimpleFeature[] = [
  {
    title: "Channel Stats",
    cardDescription:
      "Track your YouTube subscribers, views and video count from a single dashboard overview of your channel.",
    description: "See your YouTube channel overview, subscribers, views, video count, and more, right in your dashboard.",
    icon: BarChart3,
  },
  {
    title: "Referral Program",
    cardDescription:
      "Invite creator friends and earn free Creator AI credits through your own personal referral link.",
    description: "Invite friends and earn free credits for every creator who signs up through your link.",
    icon: Gift,
  },
]
