/**
 * Blog SEO audit — checks every post in lib/blog-data.ts against the Creator AI
 * SEO checklist (see .claude/skills/blog-post-seo/SKILL.md).
 *
 * Run:  pnpm --filter web seo:audit
 * Exits non-zero if any post has gaps, so it can gate CI if desired.
 *
 * The "focus keyword" is post.focusKeyword (falls back to keywords[0] for posts
 * not yet backfilled). Every rule below maps to a checklist item.
 */
import { blogPosts } from "../lib/blog-data.ts";

const SITE = "https://tryscriptai.com";
const norm = (s: string) => s.toLowerCase();

function countOcc(haystack: string, needle: string): number {
  if (!needle) return 0;
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (haystack.match(re) || []).length;
}

let totalGaps = 0;
const lines: string[] = [];

for (const p of blogPosts) {
  const fk = p.focusKeyword ?? p.keywords[0] ?? "";
  const c = p.content;
  const words = c.trim().split(/\s+/).length;
  const first10 = c.slice(0, Math.floor(c.length * 0.1));
  const subheads = c.match(/^#{2,3}\s+.+$/gm) || [];
  const imgs = [...c.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  const fkCount = countOcc(c, fk);
  const density = words ? ((fkCount * fk.split(/\s+/).length) / words) * 100 : 0;
  const extLinks = [...c.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].filter(
    (m) => !/tryscriptai\.com/.test(m[1]!),
  ).length;
  const intLinks = [...c.matchAll(/\]\((\/[^)]+)\)/g)].length;
  const url = `${SITE}/blog/${p.slug}`;
  const hasVideo = !!p.videos?.length;

  // Yoast-style: URL and subheadings pass if all focus-keyword WORDS are present
  // (not necessarily as one contiguous phrase). Title/description/first-10% still
  // use the exact phrase since we author those directly.
  const fkWords = norm(fk).split(/\s+/).filter(Boolean);
  const hasAllWords = (text: string) => fkWords.every((w) => norm(text).includes(w));

  const gaps: string[] = [];
  if (!p.focusKeyword) gaps.push("no focusKeyword field");
  if (!norm(p.seoTitle).includes(norm(fk))) gaps.push("FK not in title");
  if (!norm(p.seoDescription).includes(norm(fk))) gaps.push("FK not in description");
  if (!hasAllWords(p.slug.replace(/-/g, " "))) gaps.push("FK words not in URL");
  if (!norm(first10).includes(norm(fk))) gaps.push("FK not in first 10%");
  if (words < 1000) gaps.push(`only ${words} words (<1000)`);
  if (!subheads.some((h) => hasAllWords(h))) gaps.push("FK words in no subheading");
  if (!imgs.some((m) => norm(m[1] || "").includes(norm(fk))) && !hasVideo)
    gaps.push("no image alt with FK (and no video)");
  if (density < 0.9) gaps.push(`density ${density.toFixed(2)}% (<0.90)`);
  if (fkCount < 7) gaps.push(`FK appears ${fkCount}x (<7)`);
  if (url.length < 70) gaps.push(`URL ${url.length} chars (<70)`);
  if (extLinks === 0) gaps.push("no external links");
  if (intLinks === 0) gaps.push("no internal links");
  if (!/\d/.test(p.seoTitle)) gaps.push("no number in title");

  totalGaps += gaps.length;
  const status = gaps.length ? `✗ ${gaps.length} gap(s)` : "✓ pass";
  lines.push(
    `${status}  ${p.slug}\n    FK="${fk}"  words=${words} density=${density.toFixed(2)}% count=${fkCount} ext=${extLinks} int=${intLinks} urlLen=${url.length}` +
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

console.log(lines.join("\n\n"));
if (dupes.length) {
  console.log("\n=== DUPLICATE FOCUS KEYWORDS (must be unique) ===");
  for (const [fk, slugs] of dupes) console.log(`  "${fk}": ${slugs.join(", ")}`);
}
console.log(`\n${totalGaps === 0 && !dupes.length ? "All posts pass ✓" : `${totalGaps} total gap(s) across ${blogPosts.length} posts`}`);
process.exit(totalGaps === 0 && dupes.length === 0 ? 0 : 1);
