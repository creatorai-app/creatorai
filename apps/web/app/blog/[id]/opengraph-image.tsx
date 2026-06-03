import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { getBlogBySlug } from "@/lib/blog-data";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = getBlogBySlug(id);

  return [
    {
      id: "default",
      alt:
        post?.keywords[0] ??
        post?.title ??
        "Creator AI blog post for YouTube creators",
      size: OG_SIZE,
      contentType: OG_CONTENT_TYPE,
    },
  ];
}

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
