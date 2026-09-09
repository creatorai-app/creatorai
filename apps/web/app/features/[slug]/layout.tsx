import type { Metadata } from "next"
import { createMetadata, noIndexRobots } from "@/lib/seo"
import { getFeature } from "@/lib/product-features"
import { FeatureJsonLd, featureMetadata } from "@/lib/feature-seo"

interface Props {
  params: Promise<{ slug: string }>
}

// The parent app/features/layout.tsx canonicalises to /features. Every page here
// must set its own canonical or it would silently inherit that one and point all
// eight detail pages at the hub — featureMetadata always does.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const feature = getFeature(slug)

  if (!feature) {
    return createMetadata({
      title: "Feature Not Found",
      description: "The feature you are looking for does not exist.",
      robots: noIndexRobots,
    })
  }

  return featureMetadata(feature)
}

export default async function FeatureDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const feature = getFeature(slug)

  if (!feature) return children

  return (
    <>
      <FeatureJsonLd feature={feature} />
      {children}
    </>
  )
}
