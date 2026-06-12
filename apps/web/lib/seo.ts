import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://tryscriptai.com";

export const siteConfig = {
  name: "Creator AI",
  url: SITE_URL,
  description:
    "AI-powered assistant for YouTube creators. Generate personalized scripts, thumbnails, subtitles, and more — in your unique voice.",
  keywords: [
    "AI script writer",
    "YouTube AI tool",
    "AI thumbnail generator",
    "YouTube script generator",
    "AI subtitles",
    "YouTube content creator",
    "AI dubbing",
    "video script AI",
    "Creator AI",
    "YouTube SEO",
    "content creation tool",
  ],
  author: "Creator AI",
  twitterHandle: "@tryscriptai",
  locale: "en_US",
} as const;

export const noIndexRobots: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: true,
  googleBot: {
    index: false,
    follow: true,
  },
};

export function createMetadata(overrides: Metadata = {}): Metadata {
  const title =
    overrides.title ?? `${siteConfig.name} — AI Assistant for YouTube Creators`;
  const description = (overrides.description ??
    siteConfig.description) as string;

  return {
    title,
    description,
    keywords: siteConfig.keywords as unknown as string[],
    authors: [{ name: siteConfig.author, url: siteConfig.url }],
    creator: siteConfig.author,
    publisher: siteConfig.author,
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical: overrides.alternates?.canonical ?? "/",
    },
    category: "technology",
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      url: siteConfig.url,
      siteName: siteConfig.name,
      title: title as string,
      description,
      ...(overrides.openGraph ?? {}),
    },
    twitter: {
      card: "summary_large_image",
      title: title as string,
      description,
      creator: siteConfig.twitterHandle,
      ...(overrides.twitter ?? {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    ...overrides,
  };
}
