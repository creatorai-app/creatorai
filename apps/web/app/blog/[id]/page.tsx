"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import Link from "next/link"
import { useParams } from "next/navigation"
import Lenis from "lenis"
import "lenis/dist/lenis.css"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import { SparklesCore } from "@repo/ui/sparkles"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Tag,
  ChevronRight,
  List,
} from "lucide-react"
import { getBlogBySlug, blogPosts } from "@/lib/blog-data"
import { type Components } from "react-markdown"
import BlogContent from "@/components/blog/BlogContent"
import { cn } from "@/lib/utils"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function extractHeadings(markdown: string): { id: string; title: string; level: number }[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm
  const headings: { id: string; title: string; level: number }[] = []
  let match
  while ((match = headingRegex.exec(markdown)) !== null) {
    const hashes = match[1] ?? ""
    const text = match[2] ?? ""
    headings.push({
      id: slugify(text),
      title: text,
      level: hashes.length,
    })
  }
  return headings
}

const markdownComponents: Components = {
  h2: ({ children, ...props }) => {
    const text = typeof children === "string" ? children : String(children)
    const id = slugify(text)
    return (
      <h2
        id={id}
        className="scroll-mt-24 text-2xl md:text-[1.65rem] font-bold text-slate-900 tracking-tight mt-14 mb-5 pb-3 border-b border-slate-200 first:mt-0"
        {...props}
      >
        {children}
      </h2>
    )
  },
  h3: ({ children, ...props }) => {
    const text = typeof children === "string" ? children : String(children)
    const id = slugify(text)
    return (
      <h3
        id={id}
        className="scroll-mt-24 text-xl font-semibold text-slate-800 mt-10 mb-3"
        {...props}
      >
        {children}
      </h3>
    )
  },
  p: ({ children, ...props }) => (
    <p className="text-[1.05rem] leading-[1.85] text-slate-600 mb-5" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-slate-800" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="text-slate-700 not-italic font-medium" {...props}>
      {children}
    </em>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-4 ml-1 space-y-2.5" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-4 ml-1 space-y-2.5 list-decimal list-inside" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="flex gap-2.5 text-[1.02rem] text-slate-600 leading-relaxed" {...props}>
      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-6 border-l-4 border-purple-400 bg-purple-50/60 rounded-r-xl py-4 px-6 text-slate-700 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="my-10 border-slate-200" />
  ),
  a: ({ children, href, ...props }) => {
    const linkClass =
      "text-purple-600 font-medium underline underline-offset-4 decoration-purple-300 hover:decoration-purple-500 transition-colors"
    const isExternal = !!href && /^https?:\/\//.test(href)
    if (href && href.startsWith("/")) {
      return (
        <Link href={href} className={linkClass}>
          {children}
        </Link>
      )
    }
    return (
      <a
        href={href}
        className={linkClass}
        {...(isExternal
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        {...props}
      >
        {children}
      </a>
    )
  },
}

export default function BlogDetailPage() {
  const params = useParams()
  const slug = params.id as string
  const post = getBlogBySlug(slug)
  const [activeSection, setActiveSection] = useState<string>("")
  const rafIdRef = useRef<number>(0)

  const headings = useMemo(() => {
    if (!post) return []
    const extracted = extractHeadings(post.content)
    if (post.faqs.length > 0) {
      extracted.push({
        id: "frequently-asked-questions",
        title: "Frequently Asked Questions",
        level: 2,
      })
    }
    return extracted
  }, [post])

  useEffect(() => {
    const lenis = new Lenis()
    function raf(time: number) {
      lenis.raf(time)
      rafIdRef.current = requestAnimationFrame(raf)
    }
    rafIdRef.current = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(rafIdRef.current)
      lenis.destroy()
    }
  }, [])

  useEffect(() => {
    if (headings.length === 0) return
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 3
      let current = ""
      headings.forEach((heading) => {
        const el = document.getElementById(heading.id)
        if (el && el.offsetTop <= scrollPosition) {
          current = heading.id
        }
      })
      setActiveSection(current)
    }
    window.addEventListener("scroll", handleScroll)
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [headings])

  if (!post) {
    return (
      <div className="flex flex-col min-h-screen">
        <LandingPageNavbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center py-32">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Post Not Found
            </h1>
            <p className="text-slate-600 mb-8">
              The blog post you&apos;re looking for doesn&apos;t exist.
            </p>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const relatedPosts = blogPosts
    .filter((p) => p.slug !== post.slug)
    .filter(
      (p) =>
        p.category === post.category ||
        p.tags.some((t) => post.tags.includes(t))
    )
    .slice(0, 3)

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
          <div className="relative z-10 max-w-4xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
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
                <span className="text-xs text-slate-400">
                  {post.readTime}
                </span>
              </div>
              <h1 className="text-3xl md:text-[2.75rem] md:leading-[1.2] font-bold text-slate-900 mb-6 tracking-tight">
                {post.title}
              </h1>
              <p className="text-lg text-slate-500 mb-8 max-w-2xl">
                {post.excerpt}
              </p>
              <div className="flex flex-wrap items-center gap-5 text-sm text-slate-500">
                <span className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium text-slate-700">
                    {post.author}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  {post.date}
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Article + Sidebar */}
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-x-12">
              {/* Sidebar */}
              <aside className="hidden lg:block">
                <nav className="sticky top-24">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                    <List className="w-3.5 h-3.5" />
                    On this page
                  </div>
                  <ul className="space-y-1 border-l-2 border-slate-100">
                    {headings.map((heading) => (
                      <li key={heading.id}>
                        <a
                          href={`#${heading.id}`}
                          className={cn(
                            "block text-[13px] leading-snug py-1.5 transition-all duration-200 border-l-2 -ml-[2px]",
                            heading.level === 3 ? "pl-7" : "pl-4",
                            activeSection === heading.id
                              ? "border-purple-500 text-purple-600 font-semibold"
                              : "border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-300"
                          )}
                        >
                          {heading.title}
                        </a>
                      </li>
                    ))}
                  </ul>

                  {/* Quick Links */}
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <div className="rounded-xl bg-gradient-to-br from-purple-50 to-slate-50 border border-purple-100 p-5">
                      <p className="text-sm font-semibold text-slate-800 mb-2">
                        Try Creator AI
                      </p>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        Generate scripts in your voice, create thumbnails, and
                        more.
                      </p>
                      <Link
                        href="/signup"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700 transition-colors"
                      >
                        Get started free
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </nav>
              </aside>

              {/* Article Content */}
              <motion.article
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="max-w-none min-w-0"
              >
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
                    <div className="space-y-3">
                      {post.faqs.map((faq) => (
                        <details
                          key={faq.question}
                          className="group rounded-xl border border-slate-200 bg-white px-5 open:bg-slate-50/60 transition-colors"
                        >
                          <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 list-none font-semibold text-slate-800">
                            {faq.question}
                            <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                          </summary>
                          <p className="pb-5 -mt-1 text-[1.02rem] leading-relaxed text-slate-600">
                            {faq.answer}
                          </p>
                        </details>
                      ))}
                    </div>
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
              </motion.article>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-14 bg-gradient-to-r from-purple-600 to-pink-500">
          <div className="container max-w-3xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Ready to Create Content That Sounds Like You?
              </h2>
              <p className="text-purple-100 mb-6 max-w-xl mx-auto">
                Stop using generic AI tools. Creator AI learns your unique voice
                and generates scripts, thumbnails, subtitles, and more, all in
                one place.
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
            </motion.div>
          </div>
        </section>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="py-16 bg-slate-50">
            <div className="container max-w-5xl mx-auto px-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-8">
                Related Posts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedPosts.map((related, i) => (
                  <Link key={related.slug} href={`/blog/${related.slug}`}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.08 }}
                      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-lg hover:shadow-purple-500/10 transition-all h-full"
                    >
                      <span className="inline-block w-fit text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full mb-4">
                        {related.category}
                      </span>
                      <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-purple-700 transition-colors line-clamp-2">
                        {related.title}
                      </h3>
                      <p className="text-sm text-slate-600 flex-1 line-clamp-3">
                        {related.excerpt}
                      </p>
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
                    </motion.div>
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
