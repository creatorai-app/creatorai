import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "How Creator AI Works",
  description:
    "See how Creator AI works: connect your YouTube channel, build AI memory from your own videos, and generate scripts, thumbnails, subtitles and dubs that sound like you.",
  alternates: { canonical: "/how-it-works" },
  openGraph: { url: "/how-it-works" },
});

export default function HowItWorksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
