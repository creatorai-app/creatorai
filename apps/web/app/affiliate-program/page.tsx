import type { Metadata } from "next";

import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar";
import Footer from "@/components/footer";
import JsonLd from "@/components/JsonLd";
import AffiliateProgramContent from "@/components/affiliate/AffiliateProgramContent";
import {
  FAQ,
  STEPS,
  PAGE_PATH,
  PAGE_TITLE,
  PAGE_DESCRIPTION,
} from "@/components/affiliate/affiliate-program-data";
import { createMetadata, siteConfig } from "@/lib/seo";

const PAGE_URL = `${siteConfig.url}${PAGE_PATH}`;

export const metadata: Metadata = createMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "Creator AI affiliate program",
    "affiliate marketing for creators",
    "recurring commission affiliate",
    "earn money referring AI tools",
    "YouTube tool affiliate program",
    "20% recurring commission",
    "Creator AI partner program",
  ],
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    type: "website",
    url: PAGE_URL,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
});

export default function AffiliateProgramPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Affiliate Program", item: PAGE_URL },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to earn with the Creator AI affiliate program",
    description: PAGE_DESCRIPTION,
    step: STEPS.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.text,
    })),
  };

  const offerJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Affiliate Program",
    name: "Creator AI Affiliate Program",
    description: PAGE_DESCRIPTION,
    provider: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
    url: PAGE_URL,
    offers: {
      "@type": "Offer",
      description: "20% recurring commission on referred subscriptions",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />
      <JsonLd data={howToJsonLd} />
      <JsonLd data={offerJsonLd} />

      <LandingPageNavbar />
      <AffiliateProgramContent />
      <Footer />
    </>
  );
}
