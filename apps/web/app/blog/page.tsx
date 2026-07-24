// Server Component. Imports the full post list (with bodies) but hands the
// client only the metadata it needs to render cards, search and paginate — so
// every post's markdown body stays server-side instead of shipping as JS.
import { blogPosts } from "@/lib/blog-data"
import BlogListing, { type BlogPostMeta } from "@/components/blog/BlogListing"

export default function BlogPage() {
  const posts: BlogPostMeta[] = blogPosts.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    author: p.author,
    date: p.date,
    readTime: p.readTime,
    featured: p.featured,
    tags: p.tags,
  }))

  return <BlogListing posts={posts} />
}
