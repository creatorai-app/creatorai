import type { Metadata } from "next";
import { createMetadata, siteConfig } from "@/lib/seo";
import { blogPosts } from "@/lib/blog-data";
import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = createMetadata({
  title: "Blog",
  description:
    "Tips, guides, and insights on YouTube content creation, AI tools, scripting, and growing your channel, from the Creator AI team.",
  alternates: { canonical: "/blog" },
  openGraph: { url: "/blog" },
});

const blogJsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: `${siteConfig.name} Blog`,
  description:
    "Tips, guides, and insights on YouTube content creation, AI tools, scripting, and growing your channel.",
  url: `${siteConfig.url}/blog`,
  publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
  blogPost: blogPosts.map((post) => ({
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    url: `${siteConfig.url}/blog/${post.slug}`,
    datePublished: new Date(post.date).toISOString(),
    author: { "@type": "Organization", name: post.author },
  })),
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
    { "@type": "ListItem", position: 2, name: "Blog", item: `${siteConfig.url}/blog` },
  ],
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={blogJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {children}
    </>
  );
}
