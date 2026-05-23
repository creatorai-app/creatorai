import { PlaySquare, Lightbulb, Image as ImageIcon, MessageSquare, Globe, PenTool, LayoutTemplate, Brain } from "lucide-react";
import type { DashboardData } from "@/app/dashboard/page";

export interface DashboardHomeProps {
  profile: {
    youtube_connected: boolean;
    ai_trained: boolean;
    credits: number;
    full_name?: string;
    youtube_channel_name?: string;
    language?: string;
  } | null;
  data: DashboardData;
  connectYoutubeChannel: () => void;
  connectingYoutube: boolean;
  disconnectYoutubeChannel: () => void;
  disconnectingYoutube: boolean;
}

export interface SharedProps extends DashboardHomeProps {
  currentPlanName: string;
  subscription: any;
  creditsUsed: number;
  totalCredits: number;
  creditsPercentage: number;
  progressValue: number;
  isYoutubeConnected: boolean;
  isAiTrained: boolean;
}

export const CHART_COLORS = ["#a855f7", "#64748b", "#f59e0b", "#d8b4fe", "#10b981"];

export const QUICK_ACTIONS = [
  { label: "Write Script", icon: PenTool, href: "/dashboard/scripts/new" },
  { label: "Research Idea", icon: Lightbulb, href: "/dashboard/research/new" },
  { label: "Create Thumbnail", icon: ImageIcon, href: "/dashboard/thumbnails/new" },
  { label: "Add Subtitles", icon: MessageSquare, href: "/dashboard/subtitles/new" },
  { label: "Build Story", icon: LayoutTemplate, href: "/dashboard/story-builder/new" },
  { label: "Ideate Content", icon: Brain, href: "/dashboard/research" },
] as const;

export const ACTIVITY_ICONS: Record<string, { icon: any; color: string }> = {
  script: { icon: PlaySquare, color: "text-purple-500" },
  ideation: { icon: Lightbulb, color: "text-amber-500" },
  thumbnail: { icon: ImageIcon, color: "text-pink-500" },
  subtitle: { icon: MessageSquare, color: "text-blue-500" },
  dubbing: { icon: Globe, color: "text-emerald-500" },
};

export type ActivityPeriod = "weekly" | "monthly" | "yearly";

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

export const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
};
