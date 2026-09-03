
export interface BlogFaq {
  question: string;
  answer: string;
}

export interface BlogVideo {
  /** YouTube video ID — the 11-char id in the watch/embed URL. */
  youtubeId: string;
  /** Video title (VideoObject.name, required by Google). */
  name: string;
  /** One-line description of the video (VideoObject.description, required). */
  description: string;
  /** ISO 8601 date the video was first published on YouTube (required). */
  uploadDate: string;
  /** ISO 8601 duration, e.g. "PT3M20S". Recommended by Google; omit if unknown. */
  duration?: string;
}

/** The sign-up card rendered halfway down a post, editable per post in admin. */
export interface BlogBrandedCta {
  /** Short offer headline, e.g. "Dub a 60-second video now". */
  title: string;
  /** One or two sentences tying the offer to what the post is about. */
  description: string;
  buttonLabel: string;
  /** Site-relative path. Defaults to /signup. */
  buttonHref?: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  /** Display date, "MMM D, YYYY". Derived from `publishedAt`. */
  date: string;
  /** ISO timestamp — the machine-readable form used by schema and the sitemap. */
  publishedAt: string;
  /** ISO timestamp of the last edit, for BlogPosting.dateModified. */
  updatedAt: string;
  readTime: string;
  featured: boolean;
  tags: string[];
  content: string;
  /** Keyword-optimized <title> tag (brand suffix added by root template). */
  seoTitle: string;
  /** Meta description with primary keyword + CTA, kept under 155 chars. */
  seoDescription: string;
  /** The ONE primary phrase this post is optimized to rank for. Must appear in
   * seoTitle, seoDescription, slug, the first 10% of content, ≥1 subheading, and
   * 7+ times overall (≥0.9% density). Unique across all posts — never reuse a
   * focusKeyword. Run `pnpm --filter web seo:audit` to verify. Required on every
   * post. */
  focusKeyword: string;
  /** Primary + long-tail keywords for this post (supporting terms). */
  keywords: string[];
  /** Visible FAQ block that also powers FAQPage JSON-LD. */
  faqs: BlogFaq[];
  /** Embedded videos on this post — powers VideoObject JSON-LD so Google
   * indexes the page as a video "watch page". Order matches the embeds in
   * `content`. Omit when the post has no video. */
  videos?: BlogVideo[];
  /** Mid-article sign-up card. Undefined on posts that have none. */
  brandedCta?: BlogBrandedCta;
}
