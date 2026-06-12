import type { Metadata } from "next";
import { createMetadata, noIndexRobots, siteConfig } from "@/lib/seo";
import { getBlogBySlug } from "@/lib/blog-data";
import JsonLd from "@/components/JsonLd";

interface Props {
  params: Promise<{ id: string }>;
}

function toIsoDate(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = getBlogBySlug(id);

  if (!post) {
    return createMetadata({
      title: "Post Not Found",
      description: "The blog post you're looking for doesn't exist.",
      robots: noIndexRobots,
    });
  }

  const publishedTime = toIsoDate(post.date);

  return createMetadata({
    title: post.seoTitle,
    description: post.seoDescription,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      url: `/blog/${post.slug}`,
      type: "article",
      title: post.seoTitle,
      description: post.seoDescription,
      publishedTime,
      modifiedTime: publishedTime,
      authors: [post.author],
      section: post.category,
      tags: post.tags,
    },
    keywords: post.keywords,
  });
}

export default async function BlogPostLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = getBlogBySlug(id);

  if (!post) return children;

  const url = `${siteConfig.url}/blog/${post.slug}`;
  const publishedAt = toIsoDate(post.date);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription,
    image: `${url}/opengraph-image`,
    datePublished: publishedAt,
    dateModified: publishedAt,
    articleSection: post.category,
    keywords: post.tags.join(", "),
    wordCount: post.content.trim().split(/\s+/).length,
    author: { "@type": "Organization", name: post.author, url: siteConfig.url },
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
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${siteConfig.url}/blog`,
      },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  const faqJsonLd =
    post.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }
      : null;

  return (
    <>
      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      {children}
    </>
  );
}
