import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "About Us",
  description:
    "Learn about Creator AI, the team building the future of AI-powered content creation for YouTube creators worldwide.",
  alternates: { canonical: "/about-us" },
  openGraph: { url: "/about-us" },
});

export default function AboutUsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
