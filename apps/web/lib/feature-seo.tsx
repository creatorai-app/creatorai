import type { Metadata } from "next"
import { createMetadata, siteConfig } from "@/lib/seo"
import JsonLd from "@/components/JsonLd"
import type { ProductFeature } from "@/lib/product-features"

/**
 * Metadata + structured data for a /features/<slug> page. Mirrors lib/tool-seo.tsx
 * so the two page types can only ever be wrong in the same way, in one place each.
 *
 * On what is deliberately NOT here, same as the tool pages: SoftwareApplication
 * emits no `aggregateRating`. Google's rich result wants one, we have no verified
 * ratings, and inventing a rating to win a star snippet is the fabricated-review
 * case Search treats as spam. The entity still gives Search and the answer engines
 * a typed fact to read.
 *
 * Unlike a tool page this is NOT `isAccessibleForFree` and carries no price-0
 * Offer: these are paid product features, and claiming otherwise in schema would
 * be a lie told to a crawler.
 *
 * FAQPage stopped producing a rich result when Google deprecated those in May
 * 2026, but it stays for the same reason it stays on the tool pages: valid schema
 * and one of the cleanest Q&A formats for LLM answer engines to lift.
 *
 * No VideoObject yet. It belongs here the moment `feature.demoVideo` is set, and
 * must be emitted only when the recording actually exists — schema describing a
 * video that is not on the page is the "Video isn't on a watch page" exclusion.
 */

export function featureMetadata(feature: ProductFeature): Metadata {
  const path = `/features/${feature.id}`
  return createMetadata({
    title: feature.seoTitle,
    description: feature.seoDescription,
    keywords: [feature.focusKeyword, ...feature.keywords],
    alternates: { canonical: path },
    openGraph: {
      url: path,
      type: "website",
      title: feature.seoTitle,
      description: feature.seoDescription,
    },
  })
}

export function FeatureJsonLd({ feature }: { feature: ProductFeature }) {
  const url = `${siteConfig.url}/features/${feature.id}`

  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${siteConfig.name} ${feature.title}`,
    description: feature.seoDescription,
    url,
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "Video content creation",
    operatingSystem: "Any (web-based)",
    browserRequirements: "Requires JavaScript",
    featureList: feature.highlights,
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.url}/dark-logo.png`,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Features", item: `${siteConfig.url}/features` },
      { "@type": "ListItem", position: 3, name: feature.title, item: url },
    ],
  }

  const faqJsonLd =
    feature.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: feature.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }
      : null

  return (
    <>
      <JsonLd data={appJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
    </>
  )
}
