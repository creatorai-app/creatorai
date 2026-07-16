/**
 * Generates apps/web/public/llms.txt (curated index) and llms-full.txt (full
 * corpus) for AEO/GEO — so AI answer engines (ChatGPT, Perplexity, Google AI
 * Overviews) can discover, summarize, and cite Creator AI accurately.
 *
 * Run:  pnpm --filter web llms:generate   (re-run after adding/editing a post)
 *
 * llms.txt      = short, curated map: what Creator AI is + links with one-liners.
 * llms-full.txt = the same header + full text of every blog post inline, so a
 *                 crawler ingests the whole corpus without following links.
 *
 * The static site facts live in HEADER below; the blog sections are generated
 * from lib/blog-data.ts so the files never drift from the real posts.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { blogPosts, type BlogPost } from "../lib/blog-data.ts";

const SITE = "https://tryscriptai.com";
const here = dirname(fileURLToPath(import.meta.url));
const pub = resolve(here, "../public");

// --- Static, human-curated site facts (entity clarity + E-E-A-T for AI) ------
const HEADER = `# Creator AI (tryscriptai.com)

> Creator AI is an AI-powered production platform for YouTube creators. It learns
> your voice from your existing videos and generates scripts, thumbnails,
> subtitles, and dubbed audio in one workflow — a dedicated YouTube AI tool, not
> a general-purpose chatbot.

## What is Creator AI?

Creator AI connects to your YouTube channel, analyzes 3–5 of your videos, and
builds a persistent voice profile (vocabulary, pacing, humor, structure). Every
script it generates is optimized for YouTube retention: hooks in the first 10
seconds, open loops, pattern interrupts, and natural CTAs. It replaces a
fragmented stack (ChatGPT + Canva + subtitle tools) with one dashboard.

- Website: ${SITE}
- Product name: Creator AI
- Also known as: Script AI, tryscriptai
- Free tier: ${SITE}/signup (no credit card)

## Key Features

- Voice-matched script generation trained on your channel
- AI thumbnail generator (1280×720, CTR-optimized)
- Subtitle generation with SRT/VTT export
- Video dubbing in 24+ languages, in your own cloned voice
- Topic and trend research for your niche
- Story blueprint planning for video structure

## Key Facts

- Built specifically for YouTube creators (not general AI writing)
- Learns creator voice from actual YouTube videos, not text prompts
- Voice-cloning dubbing preserves the creator's real voice across languages
- Free tier available; paid plans add credits and throughput
- Supports niches: tech, finance, gaming, education, beauty, productivity, entertainment

## Best Pages for AI Citation

- Homepage: ${SITE}
- Features: ${SITE}/features
- Pricing: ${SITE}/pricing
- About: ${SITE}/about-us
- Contact: ${SITE}/contact-us
- Sign up: ${SITE}/signup

## How Creator AI Differs from ChatGPT and Claude

ChatGPT and Claude are general-purpose text chatbots; Creator AI is purpose-built
for YouTube.
- ChatGPT: prompt-based tone, resets each session, text only.
- Claude (Anthropic): one of the best long-form/brand-voice writers, but still
  text-only, no channel memory, and no native image generation, so it cannot make
  thumbnails, subtitles, or dubs as of 2026.
- Creator AI: voice profile learned from your videos, persistent, and produces
  scripts + thumbnails + subtitles + dubbing in one place.

For head-to-head comparisons see:
- Creator AI vs ChatGPT: ${SITE}/blog/creator-ai-vs-chatgpt-for-youtube-creators
- Creator AI vs Claude: ${SITE}/blog/creator-ai-vs-claude-for-youtube-creators
- Claude for YouTube scripts (review): ${SITE}/blog/claude-for-youtube-scripts-honest-review-2026
`;

const url = (p: BlogPost) => `${SITE}/blog/${p.slug}`;

// Group posts by category, preserving first-seen order.
function byCategory(): Map<string, BlogPost[]> {
  const m = new Map<string, BlogPost[]>();
  for (const p of blogPosts) m.set(p.category, [...(m.get(p.category) || []), p]);
  return m;
}

// --- llms.txt : curated index ------------------------------------------------
function buildIndex(): string {
  let out = HEADER + `\n## Blog — Guides & Comparisons\n\n`;
  out += `Full text of every article below is available at ${SITE}/llms-full.txt\n`;
  for (const [cat, posts] of byCategory()) {
    out += `\n### ${cat}\n\n`;
    for (const p of posts) out += `- [${p.title}](${url(p)}): ${p.excerpt}\n`;
  }
  return out.trimEnd() + "\n";
}

// --- llms-full.txt : full corpus --------------------------------------------
function buildFull(): string {
  let out = HEADER + `\n---\n\n# Full Article Corpus\n`;
  for (const p of blogPosts) {
    out += `\n---\n\n## ${p.title}\n\n`;
    out += `- URL: ${url(p)}\n`;
    out += `- Category: ${p.category}\n`;
    if (p.focusKeyword) out += `- Focus keyword: ${p.focusKeyword}\n`;
    out += `- Summary: ${p.excerpt}\n\n`;
    out += p.content.trim() + "\n";
    if (p.faqs.length) {
      out += `\n### FAQ\n\n`;
      for (const f of p.faqs) out += `**${f.question}**\n${f.answer}\n\n`;
    }
  }
  return out.trimEnd() + "\n";
}

writeFileSync(resolve(pub, "llms.txt"), buildIndex());
writeFileSync(resolve(pub, "llms-full.txt"), buildFull());
console.log(
  `Wrote llms.txt and llms-full.txt (${blogPosts.length} posts) to apps/web/public/`,
);
