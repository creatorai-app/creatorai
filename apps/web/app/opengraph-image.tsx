import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt =
  "Creator AI — AI Assistant for YouTube Creators. Generate scripts, thumbnails, and subtitles in your voice.";

export default function Image() {
  return renderOgImage({ title: "AI Assistant for YouTube Creators" });
}
