import type { Metadata } from "next"
import { createMetadata, siteConfig } from "@/lib/seo"
import JsonLd from "@/components/JsonLd"
import type { FreeTool } from "@/lib/free-tools"

/**
 * Metadata + structured data for a /tools page. Both tool routes call these, so
 * the schema can only ever be wrong in one place.
 *
 * On what is deliberately NOT here: Google's SoftwareApplication rich result
 * needs `aggregateRating` or `review`, and we have no verified ratings for these
 * free tools, the landing-page testimonials are placeholders. Inventing a
 * rating to win a star snippet is exactly the fabricated-review case Google
 * treats as spam, so the entity is emitted without one. It still gives Search
 * and the AI answer engines a typed "free web app, price 0" fact to read.
 *
 * FAQPage no longer produces a rich result either, Google deprecated those in
 * May 2026, but it stays because the schema is still valid and it is one of the
 * cleanest Q&A formats for LLM answer engines to lift.
 */

export function toolMetadata(tool: FreeTool): Metadata {
  const path = `/tools/${tool.slug}`
  return createMetadata({
    title: tool.seoTitle,
    description: tool.seoDescription,
    keywords: [tool.focusKeyword, ...tool.keywords],
    alternates: { canonical: path },
    openGraph: {
      url: path,
      type: "website",
      title: tool.seoTitle,
      description: tool.seoDescription,
    },
  })
}

export function ToolJsonLd({ tool }: { tool: FreeTool }) {
  const url = `${siteConfig.url}/tools/${tool.slug}`

  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.seoDescription,
    url,
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "Video content creation",
    operatingSystem: "Any (web-based)",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    featureList: tool.steps.map((step) => step.title),
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
      { "@type": "ListItem", position: 2, name: "Free Tools", item: `${siteConfig.url}/tools` },
      { "@type": "ListItem", position: 3, name: tool.name, item: url },
    ],
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tool.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  }

  return (
    <>
      <JsonLd data={appJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />
    </>
  )
}
