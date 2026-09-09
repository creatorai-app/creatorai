import { notFound } from "next/navigation"
import FeaturePageShell from "@/components/features/FeaturePageShell"
import { FEATURE_SLUGS, getFeature } from "@/lib/product-features"

// One route for all eight pages. The registry is a static module, so every page
// is generated at build time and there is nothing to revalidate — unlike the
// blog, whose posts live in the database.
export const dynamicParams = false

export function generateStaticParams() {
  return FEATURE_SLUGS.map((slug) => ({ slug }))
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const feature = getFeature(slug)
  if (!feature) notFound()

  return <FeaturePageShell feature={feature} />
}
