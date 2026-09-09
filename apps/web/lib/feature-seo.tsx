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
 * VideoObject is emitted ONLY when `feature.demoVideo` is set. Schema describing
 * a video that is not on the page is the "Video isn't on a watch page" exclusion,
 * and a half-filled VideoObject is worse than none: Google drops the entity and
 * the page keeps the cost of claiming to be a watch page.
 *
 * One video may only be declared on one URL. lib/blog-data.ts records what
 * happened last time we forgot that — the same VideoObject on two pages made
 * them compete and fed the duplicate-page reports in Search Console. If a demo
 * here is ever also embedded in a post, exactly one of the two declares it.
 */

/** Seconds to the ISO 8601 duration schema.org wants: 58 -> "PT58S". */
function isoDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `PT${minutes ? `${minutes}M` : ""}${remainder || !minutes ? `${remainder}S` : ""}`
}

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

  // Absolute URLs throughout: a crawler reading the JSON-LD has no page context
  // to resolve "/subtitle page.png" against.
  const demo = feature.demoVideo
  const videoJsonLd = demo
    ? {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: `${feature.title} demo`,
        description: feature.seoDescription,
        // encodeURI, because the poster screenshots already in public/ have
        // spaces in their filenames ("/subtitle page.png") and a raw space makes
        // the URL invalid — the whole VideoObject gets rejected over it.
        thumbnailUrl: [encodeURI(`${siteConfig.url}${demo.poster}`)],
        uploadDate: demo.uploadDate,
        duration: isoDuration(demo.durationSeconds),
        contentUrl: demo.mp4,
        // The transcript is on the page, so say so — it is the part an answer
        // engine can read, and it ties the text to the video it came from.
        ...(demo.transcript.length ? { transcript: demo.transcript.join("\n\n") } : {}),
        publisher: {
          "@type": "Organization",
          name: siteConfig.name,
          logo: {
            "@type": "ImageObject",
            url: `${siteConfig.url}/dark-logo.png`,
          },
        },
        // Ties the video to this page so Google treats it as the watch page.
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
      }
    : null

  return (
    <>
      <JsonLd data={appJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      {videoJsonLd && <JsonLd data={videoJsonLd} />}
    </>
  )
}
