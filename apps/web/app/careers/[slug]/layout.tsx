import type { Metadata } from "next";
import { createMetadata, noIndexRobots, siteConfig } from "@/lib/seo";
import { getRoleBySlug, roleContent } from "@/lib/careers-source";
import JsonLd from "@/components/JsonLd";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getRoleBySlug(slug);

  if (!job) {
    return createMetadata({
      title: "Role Not Found",
      description: "This opening is no longer available.",
      robots: noIndexRobots,
    });
  }

  const title = `${job.title} - Careers`;
  const description = `${job.description.slice(0, 155)}`;

  return createMetadata({
    title,
    description,
    alternates: { canonical: `/careers/${job.slug}` },
    openGraph: { url: `/careers/${job.slug}`, title, description },
  });
}

export default async function JobLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getRoleBySlug(slug);

  if (!job) return children;

  const url = `${siteConfig.url}/careers/${job.slug}`;

  // Every opening on this page is remote, which is what the careers page and
  // each role's location field state, so TELECOMMUTE is the location type; the
  // human-readable restriction ("US preferred") stays in the description.
  const jobPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: roleContent(job),
    datePosted: job.created_at,
    employmentType: job.type.toUpperCase().replace(/[^A-Z]/g, "_"),
    jobLocationType: "TELECOMMUTE",
    directApply: true,
    industry: "Software",
    occupationalCategory: job.team,
    hiringOrganization: {
      "@type": "Organization",
      name: siteConfig.name,
      sameAs: siteConfig.url,
      logo: `${siteConfig.url}/dark-logo.png`,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      {
        "@type": "ListItem",
        position: 2,
        name: "Careers",
        item: `${siteConfig.url}/careers`,
      },
      { "@type": "ListItem", position: 3, name: job.title, item: url },
    ],
  };

  return (
    <>
      <JsonLd data={jobPostingJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {children}
    </>
  );
}
