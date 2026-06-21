import type { Metadata } from "next";

import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar";
import Footer from "@/components/footer";
import JsonLd from "@/components/JsonLd";
import ReferralProgramContent from "@/components/referral/ReferralProgramContent";
import {
  FAQ,
  STEPS,
  PAGE_PATH,
  PAGE_TITLE,
  PAGE_DESCRIPTION,
} from "@/components/referral/referral-program-data";
import { createMetadata, siteConfig } from "@/lib/seo";

const PAGE_URL = `${siteConfig.url}${PAGE_PATH}`;

export const metadata: Metadata = createMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "Creator AI referral program",
    "refer a friend credits",
    "invite creators earn credits",
    "1000 free credits referral",
    "YouTube tool referral program",
    "give 1000 get 1000 credits",
    "Creator AI invite link",
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

export default function ReferralProgramPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Referral Program", item: PAGE_URL },
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
    name: "How to earn credits with the Creator AI referral program",
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
    serviceType: "Referral Program",
    name: "Creator AI Referral Program",
    description: PAGE_DESCRIPTION,
    provider: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
    url: PAGE_URL,
    offers: {
      "@type": "Offer",
      description:
        "1,000 credits for the referrer and 1,000 bonus credits for the referred friend on their first purchase",
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
      <ReferralProgramContent />
      <Footer />
    </>
  );
}
