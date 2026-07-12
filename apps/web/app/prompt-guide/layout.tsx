import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "AI Video Prompt Guide: How to Write Prompts for AI Video Generation",
  description:
    "A simple, practical AI video prompt guide. Learn how to write text-to-video, image-to-video, and reference-to-video prompts that get better results, with prompt formulas, examples, and mistakes to avoid.",
  alternates: { canonical: "/prompt-guide" },
  openGraph: { url: "/prompt-guide" },
});

export default function PromptGuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
