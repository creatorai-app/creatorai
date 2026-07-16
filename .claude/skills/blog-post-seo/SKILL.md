---
name: blog-post-seo
description: Write or update a Creator AI blog post so it passes the full on-page SEO + AEO/GEO checklist and is born fully optimized. Use whenever adding a new post to apps/web/lib/blog-data.ts, editing an existing post's content/metadata, or when the user says "new blog post", "write a blog", "optimize this blog", "SEO for the blog", or asks about focus keywords, blog schema, or blog indexing.
---

# Creator AI — Blog Post SEO / AEO / GEO

Every blog post lives as one `BlogPost` object in `apps/web/lib/blog-data.ts`. It is
rendered by `apps/web/app/blog/[id]/page.tsx` (content) and gets its `<title>`,
meta, and JSON-LD from `apps/web/app/blog/[id]/layout.tsx`. There is no CMS —
the object IS the source of truth.

**Golden rule: pick ONE `focusKeyword` per post and optimize everything around it.**
The `keywords[]` array is supporting/long-tail terms; `focusKeyword` is the single
phrase the post ranks for and the thing every check below measures.

## Workflow for a new or updated post

1. Choose the `focusKeyword`: a realistic, searchable phrase (2–6 words), unique
   across all posts (grep it first — never reuse one). It should read naturally
   when repeated ~7 times. Prefer the head term that matches the slug, not a
   conversational long-tail (those go in `keywords[]`).
2. Draft/edit the `BlogPost` fields to satisfy the checklist below.
3. Run the audit and fix every gap it prints:
   ```
   pnpm --filter web seo:audit
   ```
4. If the post embeds a video, add a `videos[]` entry (see "Video" below).
5. Add the post's URL to `apps/web/public/llms.txt` and its content block to
   `apps/web/public/llms-full.txt` (see "AEO/GEO" below).

## The checklist (what the audit enforces)

**Basic**
1. `focusKeyword` appears in `seoTitle`.
2. `focusKeyword` appears in `seoDescription` (keep ≤ 155 chars).
3. `focusKeyword` appears in the `slug` (hyphenated).
4. `focusKeyword` appears in the **first 10%** of `content` (put it in the opening
   answer/blockquote).
5. `content` is **≥ 1000 words**.

**Additional**
6. `focusKeyword` appears in at least one `##`/`###` subheading.
7. At least one image whose alt text contains the `focusKeyword`
   (`![... focus keyword ...](url)`), OR an embedded video.
8. Keyword **density ≥ 0.90%** AND the `focusKeyword` appears **≥ 7 times**,
   placed naturally (intro, a subheading, body, a FAQ, conclusion). Do NOT stuff —
   if 7 reads unnatural, the focus keyword is too narrow; broaden it.
9. **URL ≥ 70 chars** (`https://tryscriptai.com/blog/<slug>`). Only applies to NEW
   posts — never rename a published slug without a 301 redirect (breaks rankings).
10. Link out to ≥ 1 **external** authority (YouTube docs, research, news) with a
    real dofollow `[text](https://…)` — our markdown renders external links as
    dofollow + `target=_blank` automatically; do not add `nofollow`.
11. Add ≥ 2 **internal** links to related `/blog/...` posts (and relevant product
    pages like `/pricing`, `/features`).
12. `focusKeyword` is **unique** — not used by any other post.
13. Title carries **sentiment** (positive or negative angle, not neutral) and ≥ 1
    **power word** (e.g. Best, Proven, Ultimate, Avoid, Stop, Fix, Killing, Worst).
14. Include a **number** in `seoTitle` (a year like 2026, a count like "5 …").

**Content structure**
15. Add real **schema** — handled centrally in `layout.tsx` (BlogPosting +
    Breadcrumb + FAQPage from `faqs[]` + VideoObject from `videos[]`). Just fill
    `faqs[]` and `videos[]`; the layout emits the JSON-LD.
16. Table of contents — **automatic**: the sidebar builds it from `##`/`###`
    headings. Just use clear headings; the post needs several.
17. **Short paragraphs** (2–4 sentences), structured with `##`/`###` headings.
18. Include **images and/or videos** (see below).
19. Accurate, specific `seoTitle`/`seoDescription` that match the content.
20. Unique, genuinely helpful content with **references and examples** (cite
    sources inline as external links; use concrete before/after examples, tables).

## Video embeds (VideoObject — "watch page" indexing)

Embed a YouTube video by writing a markdown image whose URL is the YouTube link,
with descriptive alt (it becomes the visible caption + iframe title):
```
![Creator AI audio dubbing walkthrough](https://www.youtube.com/watch?v=VIDEO_ID)
```
Then add a matching entry so `layout.tsx` emits `VideoObject` JSON-LD (required for
Google to treat the page as the video's watch page — fixes "Video isn't on a watch
page"):
```ts
videos: [{
  youtubeId: "VIDEO_ID",
  name: "Descriptive video title with the focus keyword",
  description: "One sentence describing the video.",
  uploadDate: "2026-07-08", // the REAL YouTube upload date
  // duration: "PT3M20S",     // optional but recommended
}],
```
Don't put the same video on two posts — Google indexes a video against one canonical
watch page.

## Images

- Store in `apps/web/public/` and reference `![focus keyword alt](/your-image.png)`.
- Alt text on the primary image must contain the `focusKeyword`.
- Product screenshots already in `public/` (e.g. `scripts page.png`, `thumbnail
  page.png`, `story page.png`, `subtitle page.png`, `ideation page.png`,
  `ai studio page.png`) are reusable where relevant.

## AEO / GEO (getting cited by AI answer engines)

Optimize for ChatGPT / Perplexity / Google AI Overviews, not just blue links:
- **Open with the answer.** Start each post with a bolded Q → direct A blockquote
  (the existing posts' `> **Question?** Answer…` pattern). AI engines lift these.
- **Q&A everywhere.** Rich `faqs[]` (→ FAQPage schema) + question-style `##`
  headings. Answer in the first sentence under each heading.
- **Entity clarity + E-E-A-T.** Name the product ("Creator AI"), be specific with
  numbers/dates, cite external sources inline, keep author/publisher in schema
  (already in `layout.tsx`).
- **Keep JSON-LD payloads lean** (< 128 KB) and content fast (short paragraphs,
  lazy video embeds — already handled).
- **Update the LLM files on every publish:**
  - `apps/web/public/llms.txt` — add the post URL under the right section with a
    one-line description (curated index; keep it short).
  - `apps/web/public/llms-full.txt` — add a full content block for the post
    (title, URL, focus keyword, the answer summary, key points). This is the
    full-text corpus AI crawlers ingest without following links.

## Reference: fields of a BlogPost

`slug, title, excerpt, category, author, date, readTime, featured, tags[],
content, seoTitle, seoDescription, focusKeyword, keywords[], faqs[], videos?[]`.
See the interface at the top of `apps/web/lib/blog-data.ts`.
