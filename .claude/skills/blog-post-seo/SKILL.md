---
name: blog-post-seo
description: Write or update a Creator AI blog post so it passes the full on-page SEO + AEO/GEO checklist and is born fully optimized. Starts by checking the published posts for one that already covers the topic, because a duplicate angle cannibalizes the post we already rank for. Use whenever adding or publishing a blog post, editing an existing post's content/metadata, or when the user says "new blog post", "write a blog", "optimize this blog", "SEO for the blog", or asks about focus keywords, duplicate/cannibalized content, blog schema, or blog indexing.
---

# Creator AI — Blog Post SEO / AEO / GEO

**The source of truth is the database: `public.blog_posts` in Supabase.**
`apps/web/lib/blog-data.ts` is a legacy seed file — nothing reads it any more
(`lib/blog-source.ts` reads the table; `scripts/seo-audit.mts` audits the table).
Editing that file changes nothing on the site.

To publish a post, either write it in the admin dashboard, or add a migration
under `packages/supabase/migrations/` following
`20260819000100_seed_blog_posts.sql`: one dollar-quoted JSON blob unpacked by
`jsonb_to_recordset`, `ON CONFLICT (slug) DO UPDATE`, so it is replayable.

The table enforces part of the SEO contract itself — publishing fails unless
`seo_title`, `seo_description`, `focus_keyword` and `excerpt` are all non-empty,
`seo_description` is ≤ 155 chars, `faqs`/`videos` are JSON arrays, and
`published_at` is set. Posts are rendered by `apps/web/app/blog/[id]/page.tsx`
and get `<title>`, meta and JSON-LD from `apps/web/app/blog/[id]/layout.tsx`.

**Golden rule: pick ONE `focusKeyword` per post and optimize everything around it.**
The `keywords[]` array is supporting/long-tail terms; `focusKeyword` is the single
phrase the post ranks for and the thing every check below measures.

## STEP 0 — Duplicate check (do this BEFORE writing a word)

**Never draft a post until you have proven no existing post already covers it.**
This is the most common and most expensive mistake: a second post on a topic we
already rank for does not add a second ranking, it splits the one we had.

Run all three, from the repo root:

```
pnpm --filter web seo:audit        # lists every published post + flags duplicate focus keywords
grep -rin '<brand/topic>' packages/supabase/migrations/*seed_blog_posts.sql
```

`seo:audit` reads the live table, so it is the authoritative list — it already
fails on a reused `focusKeyword`. Grep the seed migration only as a fast
offline sweep for a brand or topic name.

Then judge overlap on **three coordinates, not just the keyword**:

| Coordinate | Question |
|---|---|
| Keyword | Does an existing `focusKeyword` mean the same thing to a searcher? |
| Intent | Would the same Google query satisfy on both posts? |
| Audience | Same reader at the same stage (comparing vs. already-decided)? |

**All three match → do NOT publish a new post.** Update the existing one instead
(refresh the content, bump `updatedAt`, keep the slug — renaming a live slug
without a 301 loses its rankings).

**Two match → the angle is too close.** Either fold it into the existing post, or
re-shape it so intent and audience genuinely differ *before* you write. A "vs"
post and an "alternatives" roundup are different intents; two "vs" posts on the
same competitor are not.

**One or zero match → safe to write.** Then add a cross-link between the new post
and its nearest neighbour so Google can see they are deliberately distinct.

### Why this matters (not a "penalty")

Google is explicit that duplication is not a spam violation — there is no manual
action for it. The damage is mechanical instead, and worse:

- Google **clusters near-duplicate pages and picks one canonical** for the group,
  "the page that … is objectively the most complete and useful". The others stop
  being served. You do not get to choose which one survives — Google's own docs
  call a `rel=canonical` "a hint, not a rule".
- Ranking signals (links, engagement, freshness) **split across the cluster**
  instead of compounding into one strong page.
- The unique parts of the losing page **go unindexed entirely**.

So the failure mode is silent: no warning, no penalty, just a post that never
ranks and quietly drags down the one that used to.

Sources: [Google — URL canonicalization & duplicate handling](https://developers.google.com/search/docs/crawling-indexing/canonicalization),
[Ahrefs — keyword cannibalization](https://ahrefs.com/blog/keyword-cannibalization).

### Also check before shipping

- **`seoDescription` must not paraphrase another post's.** Near-identical meta
  descriptions are one of the signals that groups two pages into a duplicate
  cluster. Read the neighbours' descriptions and write against them.
- **`seoTitle` must not be a reword of an existing title.**
- **Don't reuse an existing post's `keywords[]` entry as a new `focusKeyword`** —
  that is cannibalization with extra steps.

## Workflow for a new or updated post

0. **Run STEP 0 above.** No exceptions, including for a post you were asked for
   by name.
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
5. Write the post's **branded CTA** (see below) — every published post gets one.
6. Add the post's URL to `apps/web/public/llms.txt` and its content block to
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
9. **URL ≥ 70 chars** (`https://trycreatorai.com/blog/<slug>`). Only applies to NEW
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
21. A **branded CTA** matched to the post's topic (see the next section). The
    generic "sign up" card is the fallback, not the default.

## Publishing cadence — space every `publishedAt` 3 to 7 days apart

**Never give two posts the same publish date, and never dump a batch.** When you
write several posts in one session, set each one's `publishedAt` 3 to 7 days
after the previous post in the table, so the archive reads as a steady drip.
Prefer 3 or 4 days; 7 is the ceiling. The newest post may land on today's date
but never in the future.

The audit enforces this: `pnpm --filter web seo:audit` **fails** on two posts
sharing a date and **warns** on any gap outside 3 to 7 days. Existing 2-day gaps
in the archive predate the rule and are left alone; do not back-date live posts
to satisfy the linter, only to fix a genuine same-day cluster.

To find the right dates, list what is already published newest-first and count
forward from the last one:

```
pnpm --filter web seo:audit    # the cadence sections print every gap
```

### Why, mechanically

**It is not crawl budget.** Google is explicit that crawl budget only matters
for sites with 1M+ pages changing weekly, or 10,000+ pages changing daily, and
says outright: "If your site doesn't have a large number of pages that change
rapidly … you don't need to read this guide"
([Crawl budget management](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget)).
At ~50 posts we are nowhere near it. Do not justify this rule with crawl budget.

The real reasons are smaller and more specific:

- **Duplicate clustering.** A batch published the same day is usually a batch
  written the same day, on adjacent topics. That is precisely the input that
  makes Google [cluster pages and pick one canonical](https://developers.google.com/search/docs/crawling-indexing/canonicalization),
  see STEP 0. Spacing them is not what prevents this, distinct angles are, but a
  same-day cluster of near-identical posts makes the grouping more likely.
- **Scaled content abuse.** Google's [spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
  target mass-produced pages made primarily to rank. Genuine posts are not that,
  but a visible batch footprint is the pattern the policy describes, and there is
  no upside to resembling it.
- **Same-day publishing buys nothing anyway.** Google's own guidance is that
  indexing normally takes days, and to not expect same-day indexing unless you
  are a news site. Dating posts three days apart costs zero latency in practice.
- **It reads badly to humans.** A blog index showing four posts on one date and
  nothing for eleven days looks like inventory being dumped, which is the exact
  impression the content is trying not to give.

So the rule is cheap insurance rather than a fix for a specific penalty, and the
honest summary is: it costs nothing, so do it.

### When you write several posts at once

Write them all, then stage the dates. Set the first to land 3 to 4 days after
the current newest post and step forward from there. If that would push the last
one past today, either narrow the gaps to 3 days or hold the tail post for the
next batch. Backfilling into the past is fine and often better: an unpublished
post has no rankings to lose.

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

## Branded CTA (the mid-article sign-up card)

**Every published post carries one, and it sells the feature the post is about.**
It renders automatically at the `##` heading nearest the middle of the article,
between the intro the reader came for and the conclusion most of them never
reach. A reader who is sold by paragraph six should not have to scroll to the
footer to act.

It lives in the `branded_cta` jsonb column, so it is edited per post from the
admin dashboard without a deploy:

```jsonc
{
  "title": "Dub a 60-second video now",          // the offer, imperative
  "description": "One or two sentences tying the offer to this article.",
  "buttonLabel": "Try AI dubbing free",
  "buttonHref": "/signup"                         // optional, site-relative, defaults to /signup
}
```

**Match the offer to the topic — that is the whole point.** A dubbing post
offers a dub, a thumbnail post offers thumbnails, a scripts post offers a
script. "Get 500 free credits every month" is the *generic* card, used only when
a post spans the whole product (roundups, algorithm explainers, tool
comparisons that are not about one feature).

| Post is about | Title | Button |
|---|---|---|
| Dubbing / localization | Dub a 60-second video now | Try AI dubbing free |
| Subtitles / captions | Caption your next upload in minutes | Generate subtitles free |
| Thumbnails / CTR | Generate 5 thumbnails to A/B test | Make my thumbnails |
| Scripts / hooks / writing | Get a script in your own voice | Write my script free |
| Ideas / planning / research | Get 10 video ideas for your niche | Find my next video |
| Retention / story structure | Structure your next video for retention | Build my story outline |
| Everything else | Get 500 free credits every month | Start free |

Rules:

- **Never claim something the product does not do.** The numbers above are real
  and checkable: the free Starter plan caps a dub at 60 seconds
  (`STARTER_MAX_DUB_SECONDS`), thumbnails generate 1–5 per run
  (`thumbnail.schema.ts`), ideation returns up to 10 ideas
  (`IDEATION_ABSOLUTE_MAX_IDEAS`), and the free plan is 500 credits a month.
  If you invent a number, someone signs up for a thing that is not there.
- **Reuse the cluster's copy rather than inventing a variant per post.** Seven
  offers cover the blog; a forty-eighth wording is churn, not conversion.
- `buttonHref` must be a site-relative path (`/signup`, `/pricing`,
  `/tools/...`) — a DB constraint rejects anything else, because this column is
  admin-editable and lands in an `href`.
- The card is skipped automatically on a post with fewer than three `##`
  headings: there is no interior boundary to place it on. If a post is hitting
  that, it has a structure problem, not a CTA problem.
- It is **not a heading**. The title renders as a `<p>` so an ad headline never
  competes with the article's own `##` outline.

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
content, seoTitle, seoDescription, focusKeyword, keywords[], faqs[], videos?[],
brandedCta?`.
See the `BlogPost` interface in `apps/web/lib/blog-types.ts` and the column list in `packages/supabase/migrations/20260819000000_blog_posts_content_model.sql`.
