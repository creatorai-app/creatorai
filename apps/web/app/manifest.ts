import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Creator AI | AI Assistant for YouTube Creators",
    short_name: "Creator AI",
    description:
      "AI-powered assistant for YouTube creators. Generate personalized scripts, thumbnails, subtitles, and more.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#a855f7",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
