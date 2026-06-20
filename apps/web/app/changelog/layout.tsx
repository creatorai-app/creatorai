import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Changelog",
  description:
    "What's new in Creator AI, track every release, feature launch, improvement, and fix across our platform.",
  alternates: { canonical: "/changelog" },
  openGraph: { url: "/changelog" },
});

export default function ChangelogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
