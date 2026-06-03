import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { getBlogBySlug } from "@/lib/blog-data";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Creator AI Blog";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = getBlogBySlug(id);

  return renderOgImage({
    title: post?.title ?? "Creator AI Blog",
    eyebrow: post?.category ?? "Creator AI Blog",
  });
}
