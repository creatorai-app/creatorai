import type { Metadata } from "next";
import { createMetadata, noIndexRobots } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Log In",
  description:
    "Log in to Creator AI and access your personalized YouTube content creation dashboard.",
  alternates: { canonical: "/login" },
  openGraph: { url: "/login" },
  robots: noIndexRobots,
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
