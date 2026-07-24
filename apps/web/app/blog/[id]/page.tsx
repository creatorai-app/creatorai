// Server Component. The article body (react-markdown + remark-gfm + the table
// parser) renders on the server, so ~140kB of markdown libraries plus every
// post's body stay out of the client bundle. Only two small islands ship JS:
// the scroll-spy table of contents and the FAQ accordion.
import Link from "next/link"
import { notFound } from "next/navigation"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import { SparklesCore } from "@repo/ui/sparkles"
import { ArrowLeft, Calendar, Clock, User, Tag, ChevronRight } from "lucide-react"
import BlogFaqAccordion from "@/components/blog/BlogFaqAccordion"
import BlogContent from "@/components/blog/BlogContent"
import ArticleTOC from "@/components/blog/ArticleTOC"
import SmoothScroll from "@/components/SmoothScroll"
import { getBlogBySlug, getAllSlugs, blogPosts } from "@/lib/blog-data"
import { extractHeadings, markdownComponents } from "@/components/blog/markdownComponents"

// Same fade-and-rise the client page used, expressed as CSS (tailwindcss-animate)
// so it costs no client JS and starts at first paint.
const RISE = "animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700"

export function generateStaticParams() {
  return getAllSlugs().map((id) => ({ id }))
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = getBlogBySlug(id)
  if (!post) notFound()

  const headings = extractHeadings(post.content)
  if (post.faqs.length > 0) {
    headings.push({ id: "frequently-asked-questions", title: "Frequently Asked Questions", level: 2 })
  }

  const relatedPosts = blogPosts
    .filter((p) => p.slug !== post.slug)
    .filter((p) => p.category === post.category || p.tags.some((t) => post.tags.includes(t)))
    .slice(0, 3)

  return (
    <div className="flex flex-col min-h-screen">
      <SmoothScroll />
      <LandingPageNavbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative w-full pt-32 pb-16 bg-gradient-to-b from-white to-slate-50 overflow-hidden">
          <div aria-hidden="true" className="absolute inset-0 -z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] bg-purple-100/40 rounded-full blur-3xl" />
            <SparklesCore
              background="transparent"
              minSize={0.2}
              maxSize={0.8}
              className="absolute inset-0 w-full h-full z-0"
              particleColor="#a855f7"
              particleDensity={15}
            />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6">
            <div className={RISE}>
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium mb-6 group"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                Back to Blog
              </Link>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                  {post.category}
                </span>
                <span className="text-xs text-slate-400">{post.readTime}</span>
              </div>
              <h1 className="text-3xl md:text-[2.75rem] md:leading-[1.2] font-bold text-slate-900 mb-6 tracking-tight">
                {post.title}
              </h1>
              <p className="text-lg text-slate-500 mb-8 max-w-2xl">{post.excerpt}</p>
              <div className="flex flex-wrap items-center gap-5 text-sm text-slate-500">
                <span className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium text-slate-700">{post.author}</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  {post.date}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Article + Sidebar */}
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-x-12">
              <ArticleTOC headings={headings} />

              {/* Article Content */}
              <article className={`${RISE} max-w-none min-w-0`}>
                <BlogContent content={post.content} components={markdownComponents} />

                {/* FAQ */}
                {post.faqs.length > 0 && (
                  <div className="mt-16 pt-10 border-t border-slate-200">
                    <h2
                      id="frequently-asked-questions"
                      className="scroll-mt-24 text-2xl md:text-[1.65rem] font-bold text-slate-900 tracking-tight mt-14 mb-5 pb-3 border-b border-slate-200"
                    >
                      Frequently Asked Questions
                    </h2>
                    <BlogFaqAccordion faqs={post.faqs} />
                  </div>
                )}

                {/* Tags */}
                {post.tags.length > 0 && (
                  <div className="mt-14 pt-8 border-t border-slate-200">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Tag className="w-4 h-4 text-slate-400" />
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-14 bg-gradient-to-r from-purple-600 to-pink-500">
          <div className="container max-w-3xl mx-auto px-6 text-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Ready to Create Content That Sounds Like You?
              </h2>
              <p className="text-purple-100 mb-6 max-w-xl mx-auto">
                Stop using generic AI tools. Creator AI learns your unique voice and generates
                scripts, thumbnails, subtitles, and more, all in one place.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-white text-purple-700 font-semibold px-6 py-3 rounded-lg hover:bg-purple-50 transition-colors"
              >
                Get Started Free
              </Link>
              <p className="text-purple-100/90 text-sm mt-5">
                Questions? Reach us at{" "}
                <a href="mailto:support@tryscriptai.com" className="underline hover:text-white">
                  support@tryscriptai.com
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="py-16 bg-slate-50">
            <div className="container max-w-5xl mx-auto px-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-8">Related Posts</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedPosts.map((related) => (
                  <Link key={related.slug} href={`/blog/${related.slug}`}>
                    <div className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-lg hover:shadow-purple-500/10 transition-all h-full">
                      <span className="inline-block w-fit text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full mb-4">
                        {related.category}
                      </span>
                      <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-purple-700 transition-colors line-clamp-2">
                        {related.title}
                      </h3>
                      <p className="text-sm text-slate-600 flex-1 line-clamp-3">{related.excerpt}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {related.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {related.readTime}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
