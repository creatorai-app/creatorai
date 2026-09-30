import { cache } from "react";
import { createSupabaseClient, getSupabaseEnv } from "@repo/supabase";
import type { JobPost } from "@repo/validation";

/**
 * Reads open roles from public.job_posts for the public careers pages.
 *
 * Same shape as blog-source: the anon key with no cookie handling, because the
 * "Anyone can view active job posts" RLS policy already scopes reads to active
 * rows and a cookie-free client keeps these pages statically renderable.
 */

function db() {
  const { url, key } = getSupabaseEnv();
  return createSupabaseClient(url, key);
}

const active = () => db().from("job_posts").select("*").eq("status", "active");

async function loadOpenRoles(): Promise<JobPost[]> {
  const { data, error } = await active().order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load job posts: ${error.message}`);
  return (data ?? []) as JobPost[];
}

async function loadRoleBySlug(slug: string): Promise<JobPost | undefined> {
  const { data, error } = await active().eq("slug", slug).maybeSingle();

  // maybeSingle returns null (not an error) when nothing matches, so a real
  // error here means the query failed and must not be rendered as a 404.
  if (error) throw new Error(`Failed to load job post ${slug}: ${error.message}`);
  return (data as JobPost | null) ?? undefined;
}

// `cache` dedupes between the layout's metadata/JSON-LD and the page itself,
// which both read the same role in one render.
export const getOpenRoles = cache(loadOpenRoles);
export const getRoleBySlug = cache(loadRoleBySlug);

/**
 * The markdown body shown on a role's page. Falls back to the listing blurb plus
 * requirements so a role saved before the Content field existed still renders.
 */
export function roleContent(job: JobPost): string {
  if (job.content?.trim()) return job.content;
  return [
    "## About the role",
    job.description,
    ...(job.requirements?.trim() ? ["## Requirements", job.requirements] : []),
  ].join("\n\n");
}
