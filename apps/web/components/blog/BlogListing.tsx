"use client"

import React, { useEffect, useMemo, useState } from "react"
import * as motion from "motion/react-m"
import Link from "next/link"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import { SparklesCore } from "@repo/ui/sparkles"
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  User,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useSmoothScroll } from "@/hooks/useSmoothScroll"

/**
 * Metadata-only shape passed from the server page. The full post `content` and
 * `faqs` deliberately never cross to the client — the listing only ever needs
 * these fields, so shipping the bodies (~250kB) as JS was pure waste.
 */
export interface BlogPostMeta {
  slug: string
  title: string
  excerpt: string
  category: string
  author: string
  date: string
  readTime: string
  featured: boolean
  tags: string[]
}

const POSTS_PER_PAGE = 20

// Blog dates are human strings like "Jul 16, 2026"; parse to a timestamp for
// sorting and range filtering. Invalid dates sort last.
const toTime = (date: string): number => {
  const t = new Date(date).getTime()
  return Number.isNaN(t) ? 0 : t
}

export default function BlogListing({ posts }: { posts: BlogPostMeta[] }) {
  useSmoothScroll()

  const [newsletterEmail, setNewsletterEmail] = useState("")
  const [subscribing, setSubscribing] = useState(false)

  // Search + date-range filter + pagination state.
  const [query, setQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(1)

  // Newest first, always.
  const sorted = useMemo(
    () => [...posts].sort((a, b) => toTime(b.date) - toTime(a.date)),
    [posts],
  )

  const isFiltering = query.trim() !== "" || fromDate !== "" || toDate !== ""

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const from = fromDate ? toTime(fromDate) : -Infinity
    // Include the whole "to" day (native date input is midnight of that day).
    const to = toDate ? toTime(toDate) + 86_399_999 : Infinity
    return sorted.filter((p) => {
      const t = toTime(p.date)
      if (t < from || t > to) return false
      if (!q) return true
      const haystack = `${p.title} ${p.excerpt} ${p.category} ${p.tags.join(" ")}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [sorted, query, fromDate, toDate])

  // Featured hero: newest featured post, shown only on the unfiltered first page.
  const featured = !isFiltering ? sorted.find((p) => p.featured) : undefined
  const gridPosts = featured
    ? filtered.filter((p) => p.slug !== featured.slug)
    : filtered

  const totalPages = Math.max(1, Math.ceil(gridPosts.length / POSTS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * POSTS_PER_PAGE
  const paged = gridPosts.slice(pageStart, pageStart + POSTS_PER_PAGE)

  // Reset to page 1 whenever the filter changes.
  useEffect(() => {
    setPage(1)
  }, [query, fromDate, toDate])

  const clearFilters = () => {
    setQuery("")
    setFromDate("")
    setToDate("")
  }

  const goToPage = (p: number) => {
    setPage(p)
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsletterEmail || subscribing) return
    setSubscribing(true)
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail }),
      })
      if (!res.ok) throw new Error("Failed to subscribe")
      toast.success("Subscribed!", {
        description: "You'll receive the latest updates in your inbox.",
      })
      setNewsletterEmail("")
    } catch {
      toast.error("Failed to subscribe", {
        description: "Something went wrong. Please try again.",
      })
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
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
          <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
                Creator AI{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                  Blog
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 max-w-xl mx-auto">
                Tips, guides, and insights to help you create better content and grow your channel.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Featured Post */}
        {featured && (
          <section className="py-12 bg-white">
            <div className="container max-w-5xl mx-auto px-6">
              <Link href={`/blog/${featured.slug}`}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="group relative rounded-2xl border border-slate-200 bg-gradient-to-br from-purple-50 to-slate-50 p-8 md:p-12 hover:shadow-lg hover:shadow-purple-500/10 transition-all cursor-pointer"
                >
                  <span className="inline-block text-xs font-semibold text-purple-600 bg-purple-100 px-3 py-1 rounded-full mb-4">
                    Featured
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3 group-hover:text-purple-700 transition-colors">
                    {featured.title}
                  </h2>
                  <p className="text-slate-600 text-lg mb-6 max-w-3xl">{featured.excerpt}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-6">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {featured.author}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {featured.date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {featured.readTime}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                      {featured.category}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 group-hover:gap-2.5 transition-all">
                    Read article <ArrowRight className="w-4 h-4" />
                  </span>
                </motion.div>
              </Link>
            </div>
          </section>
        )}

        {/* Blog Grid + Search / Filters / Pagination */}
        <section className="py-16 bg-slate-50">
          <div className="container max-w-6xl mx-auto px-6">
            <div className="mb-8 flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-slate-900">
                {isFiltering ? "Search Results" : "Latest Posts"}
              </h2>

              {/* Search + date range */}
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search posts by title, topic, or tag..."
                    aria-label="Search blog posts"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <span className="hidden sm:inline">From</span>
                    <input
                      type="date"
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={(e) => setFromDate(e.target.value)}
                      aria-label="Filter from date"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <span className="hidden sm:inline">To</span>
                    <input
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      onChange={(e) => setToDate(e.target.value)}
                      aria-label="Filter to date"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </label>
                  {isFiltering && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {paged.length > 0 ? (
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {paged.map((post) => (
                  <Link key={post.slug} href={`/blog/${post.slug}`}>
                    <div className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-lg hover:shadow-purple-500/10 transition-all cursor-pointer h-full">
                      <span className="inline-block w-fit text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full mb-4">
                        {post.category}
                      </span>
                      <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-purple-700 transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-sm text-slate-600 mb-4 flex-1 line-clamp-3">{post.excerpt}</p>
                      <div className="flex items-center justify-between text-xs text-slate-500 mt-auto pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {post.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {post.readTime}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-purple-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Read <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </motion.div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
                <p className="text-lg font-semibold text-slate-800">No posts found</p>
                <p className="mt-1 text-sm text-slate-500">
                  Try a different search term or widen the date range.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Clear filters
                </button>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                aria-label="Blog pagination"
                className="mt-12 flex items-center justify-center gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-purple-300 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    aria-label={`Page ${p}`}
                    aria-current={p === currentPage ? "page" : undefined}
                    className={
                      p === currentPage
                        ? "inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-purple-600 px-3 text-sm font-semibold text-white shadow-sm shadow-purple-500/20"
                        : "inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:border-purple-300 hover:text-purple-700"
                    }
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-purple-300 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            )}
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="py-20 bg-white">
          <div className="container max-w-2xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Stay in the Loop</h2>
              <p className="text-slate-600 mb-8">
                Get the latest tips, product updates, and creator insights delivered to your inbox.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3 justify-center">
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="flex-1 max-w-xs rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {subscribing ? "Subscribing..." : "Subscribe"}
                  {!subscribing && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
