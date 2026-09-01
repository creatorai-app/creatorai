/**
 * Blog SEO audit — checks every published post in public.blog_posts against the
 * Creator AI SEO checklist (see .claude/skills/blog-post-seo/SKILL.md).
 *
 * Run:  pnpm --filter web seo:audit
 * Exits non-zero if any post has gaps, so it can gate CI if desired.
 *
 * Reads the database, not a file, because that is where posts are edited now.
 * It therefore needs the Supabase env vars; in CI that means giving the job the
 * anon key, which only ever sees published rows.
 *
 * The rules themselves live in lib/blog-seo-rules.ts so this script and the
 * live check in the admin editor can never disagree.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { auditPost } from "../lib/blog-seo-rules.ts";
import { loadPublishedPosts } from "../lib/blog-source.ts";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const blogPosts = await loadPublishedPosts();

const norm = (s: string) => s.toLowerCase();

let totalGaps = 0;
const lines: string[] = [];

for (const p of blogPosts) {
  const fk = p.focusKeyword ?? p.keywords[0] ?? "";
  const { gaps, stats } = auditPost({ ...p, focusKeyword: fk, hasVideo: !!p.videos?.length });

  totalGaps += gaps.length;
  const status = gaps.length ? `✗ ${gaps.length} gap(s)` : "✓ pass";
  lines.push(
    `${status}  ${p.slug}\n    FK="${fk}"  words=${stats.words} density=${stats.density.toFixed(2)}% count=${stats.keywordCount} ext=${stats.externalLinks} int=${stats.internalLinks} urlLen=${stats.urlLength}` +
      (gaps.length ? `\n    → ${gaps.join("; ")}` : ""),
  );
}

// Focus-keyword uniqueness across the whole blog.
const byFk = new Map<string, string[]>();
for (const p of blogPosts) {
  const fk = norm(p.focusKeyword ?? p.keywords[0] ?? "");
  byFk.set(fk, [...(byFk.get(fk) || []), p.slug]);
}
const dupes = [...byFk].filter(([, s]) => s.length > 1);

// Publishing cadence: 3 to 7 days between consecutive posts. Not a crawl-budget
// thing, that only applies to sites orders of magnitude larger than this one.
// Posts batched onto one date are usually written together on adjacent topics,
// which is the input that makes Google cluster them and serve one canonical,
// and it is the footprint the scaled-content-abuse policy describes. Spacing
// costs nothing, so we spread them. See .claude/skills/blog-post-seo/SKILL.md.
// Same-day is a hard failure. Out-of-range gaps only warn, because
// the archive predates this rule and back-dating live posts to satisfy a
// linter would be worse than the gap.
const byDate = [...blogPosts].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
const sameDay: string[] = [];
const offCadence: string[] = [];
for (let i = 1; i < byDate.length; i++) {
  const prev = byDate[i - 1]!;
  const cur = byDate[i]!;
  const days = Math.round(
    (new Date(cur.publishedAt).getTime() - new Date(prev.publishedAt).getTime()) / 86_400_000,
  );
  if (days === 0) sameDay.push(`  ${cur.publishedAt.slice(0, 10)}: ${prev.slug} + ${cur.slug}`);
  else if (days < 3 || days > 7) offCadence.push(`  ${days}d gap before ${cur.slug}`);
}

console.log(lines.join("\n\n"));
if (dupes.length) {
  console.log("\n=== DUPLICATE FOCUS KEYWORDS (must be unique) ===");
  for (const [fk, slugs] of dupes) console.log(`  "${fk}": ${slugs.join(", ")}`);
}
if (sameDay.length) {
  console.log("\n=== POSTS SHARING A PUBLISH DATE (spread them 3-7 days apart) ===");
  console.log(sameDay.join("\n"));
}
if (offCadence.length) {
  console.log("\n=== CADENCE WARNINGS (target 3-7 days between posts) ===");
  console.log(offCadence.join("\n"));
}
const failed = totalGaps > 0 || dupes.length > 0 || sameDay.length > 0;
console.log(`\n${failed ? `${totalGaps} total gap(s) across ${blogPosts.length} posts` : "All posts pass ✓"}`);
process.exit(failed ? 1 : 0);
