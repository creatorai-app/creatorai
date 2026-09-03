import { cache } from "react";
import { createSupabaseClient, getSupabaseEnv } from "@repo/supabase";
import type { BlogBrandedCta, BlogFaq, BlogPost, BlogVideo } from "./blog-types";

/**
 * Reads published blog posts from public.blog_posts, which is the source of
 * truth; posts are written and edited in the admin dashboard.
 *
 * Uses the anon key with no cookie handling: the "Published blogs are public"
 * RLS policy already scopes reads to published rows, and a cookie-free client
 * keeps the blog statically renderable. Pages set their own `revalidate`.
 */

const COLUMNS =
  "slug,title,excerpt,content,category,author_name,read_time,featured,tags,keywords,faqs,videos,branded_cta,seo_title,seo_description,focus_keyword,published_at,updated_at";

interface BlogRow {
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  category: string | null;
  author_name: string | null;
  read_time: string | null;
  featured: boolean | null;
  tags: string[] | null;
  keywords: string[] | null;
  faqs: BlogFaq[] | null;
  videos: BlogVideo[] | null;
  branded_cta: BlogBrandedCta | null;
  seo_title: string | null;
  seo_description: string | null;
  focus_keyword: string | null;
  published_at: string | null;
  updated_at: string | null;
}

function db() {
  const { url, key } = getSupabaseEnv();
  return createSupabaseClient(url, key);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-02-01T12:00:00Z" -> "Feb 1, 2026", in UTC so no locale shifts the day. */
function displayDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function toPost(row: BlogRow): BlogPost {
  const publishedAt = row.published_at ?? row.updated_at ?? new Date().toISOString();
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    category: row.category ?? "General",
    author: row.author_name ?? "Creator AI Team",
    date: displayDate(publishedAt),
    publishedAt,
    updatedAt: row.updated_at ?? publishedAt,
    readTime: row.read_time ?? "",
    featured: row.featured ?? false,
    tags: row.tags ?? [],
    content: row.content,
    seoTitle: row.seo_title ?? row.title,
    seoDescription: row.seo_description ?? row.excerpt ?? "",
    focusKeyword: row.focus_keyword ?? "",
    keywords: row.keywords ?? [],
    faqs: row.faqs ?? [],
    // Undefined rather than [] so `post.videos?.length` stays the video test.
    videos: row.videos?.length ? row.videos : undefined,
    brandedCta: row.branded_cta ?? undefined,
  };
}

/**
 * Published AND due. A future published_at schedules a post, so it stays out of
 * the blog, the sitemap and generateStaticParams until its date passes. Applied
 * on every read path, since a post reachable by URL before its date is published.
 */
const live = <T extends { eq: Function; lte: Function }>(query: T) =>
  query.eq("status", "published").lte("published_at", new Date().toISOString());

async function loadPublishedPosts(): Promise<BlogPost[]> {
  const { data, error } = await live(db().from("blog_posts").select(COLUMNS)).order("published_at", {
    ascending: false,
  });

  if (error) throw new Error(`Failed to load blog posts: ${error.message}`);
  return (data as BlogRow[]).map(toPost);
}

async function loadPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const { data, error } = await live(db().from("blog_posts").select(COLUMNS).eq("slug", slug)).maybeSingle();

  // maybeSingle returns null (not an error) when nothing matches, so a real error
  // here means the query failed and must not be rendered as a 404.
  if (error) throw new Error(`Failed to load blog post ${slug}: ${error.message}`);
  return data ? toPost(data as BlogRow) : undefined;
}

async function loadAllPublishedSlugs(): Promise<string[]> {
  const { data, error } = await live(db().from("blog_posts").select("slug"));

  if (error) throw new Error(`Failed to load blog slugs: ${error.message}`);
  return (data as { slug: string }[]).map((r) => r.slug);
}

// `cache` dedupes within a single render. The raw loaders are for the build
// scripts, which run outside React and have no request scope to cache against.
export const getPublishedPosts = cache(loadPublishedPosts);
export const getPostBySlug = cache(loadPostBySlug);
export const getAllPublishedSlugs = cache(loadAllPublishedSlugs);

export { loadPublishedPosts };

/** Same-category or shared-tag posts, excluding the current one. */
export async function getRelatedPosts(post: BlogPost, limit = 3): Promise<BlogPost[]> {
  const all = await getPublishedPosts();
  return all
    .filter((p) => p.slug !== post.slug)
    .filter((p) => p.category === post.category || p.tags.some((t) => post.tags.includes(t)))
    .slice(0, limit);
}
