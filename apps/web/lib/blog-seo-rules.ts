/**
 * The blog SEO checklist from .claude/skills/blog-post-seo, as one pure function.
 *
 * Shared by `pnpm seo:audit` and the live check in the admin editor: a post
 * written in the dashboard can reach production without anyone running the
 * script, so both need the same rules, and one implementation keeps them honest.
 */

const SITE = "https://trycreatorai.com";

export interface AuditablePost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  hasVideo?: boolean;
}

export interface AuditStats {
  words: number;
  density: number;
  keywordCount: number;
  externalLinks: number;
  internalLinks: number;
  urlLength: number;
}

export interface AuditResult {
  gaps: string[];
  stats: AuditStats;
}

const norm = (s: string) => s.toLowerCase();

function countOcc(haystack: string, needle: string): number {
  if (!needle) return 0;
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (haystack.match(re) || []).length;
}

export function auditPost(p: AuditablePost): AuditResult {
  const fk = p.focusKeyword ?? "";
  const c = p.content ?? "";
  const words = c.trim() ? c.trim().split(/\s+/).length : 0;
  const first10 = c.slice(0, Math.floor(c.length * 0.1));
  const subheads = c.match(/^#{2,3}\s+.+$/gm) || [];
  const imgs = [...c.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  const keywordCount = countOcc(c, fk);
  const density = words ? ((keywordCount * fk.split(/\s+/).length) / words) * 100 : 0;
  const externalLinks = [...c.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].filter(
    // Both domains: posts written before the move link to themselves absolutely
    // on tryscriptai.com, and those are still our own pages, not external ones.
    (m) => !/(trycreatorai|tryscriptai)\.com/.test(m[1]!),
  ).length;
  const internalLinks = [...c.matchAll(/\]\((\/[^)]+)\)/g)].length;
  const url = `${SITE}/blog/${p.slug}`;

  // House style: no em dashes, en dashes, or double hyphens anywhere a reader
  // sees them. Markdown table separator rows (|---|---|) legitimately contain
  // runs of hyphens, so strip those lines before looking for "--".
  const prose = [p.title, p.excerpt, p.seoTitle, p.seoDescription, c].join("\n");
  const proseNoTableRules = prose
    .split("\n")
    .filter((l) => !/^\s*\|[\s|:-]+\|\s*$/.test(l))
    .join("\n");
  const dashHits = [
    ...proseNoTableRules.matchAll(/[—–‒―−]|--/g),
  ].map((m) => m[0]);

  // Yoast-style: URL and subheadings pass if all focus-keyword WORDS are present
  // (not necessarily as one contiguous phrase). Title/description/first-10% still
  // use the exact phrase since we author those directly.
  const fkWords = norm(fk).split(/\s+/).filter(Boolean);
  const hasAllWords = (text: string) => fkWords.every((w) => norm(text).includes(w));

  const gaps: string[] = [];
  if (!fk) gaps.push("no focusKeyword field");
  if (!norm(p.seoTitle ?? "").includes(norm(fk))) gaps.push("FK not in title");
  if (!norm(p.seoDescription ?? "").includes(norm(fk))) gaps.push("FK not in description");
  if (!hasAllWords(p.slug.replace(/-/g, " "))) gaps.push("FK words not in URL");
  if (!norm(first10).includes(norm(fk))) gaps.push("FK not in first 10%");
  if (words < 1000) gaps.push(`only ${words} words (<1000)`);
  if (!subheads.some((h) => hasAllWords(h))) gaps.push("FK words in no subheading");
  if (!imgs.some((m) => norm(m[1] || "").includes(norm(fk))) && !p.hasVideo)
    gaps.push("no image alt with FK (and no video)");
  if (density < 0.9) gaps.push(`density ${density.toFixed(2)}% (<0.90)`);
  if (keywordCount < 7) gaps.push(`FK appears ${keywordCount}x (<7)`);
  if (url.length < 70) gaps.push(`URL ${url.length} chars (<70)`);
  if (externalLinks === 0) gaps.push("no external links");
  if (internalLinks === 0) gaps.push("no internal links");
  if (!/\d/.test(p.seoTitle ?? "")) gaps.push("no number in title");
  if ((p.seoDescription ?? "").length > 155)
    gaps.push(`meta description ${p.seoDescription.length} chars (>155, Google truncates)`);
  if (dashHits.length) {
    const kinds = [...new Set(dashHits)].join(" ");
    gaps.push(
      `${dashHits.length} dash(es): use a comma, colon, period or parentheses instead [${kinds}]`,
    );
  }

  return {
    gaps,
    stats: { words, density, keywordCount, externalLinks, internalLinks, urlLength: url.length },
  };
}
