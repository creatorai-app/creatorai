"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { List, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Heading {
  id: string
  title: string
  level: number
}

/**
 * Sticky "on this page" sidebar with scroll-spy. This is the only interactive
 * part of a blog post, so it's the only piece of the article that ships client
 * JS — the article body itself is rendered on the server. `headings` is a tiny
 * list of {id,title,level}, not the post content.
 */
export default function ArticleTOC({ headings }: { headings: Heading[] }) {
  const [activeSection, setActiveSection] = useState("")

  useEffect(() => {
    if (headings.length === 0) return
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 3
      let current = ""
      headings.forEach((heading) => {
        const el = document.getElementById(heading.id)
        if (el && el.offsetTop <= scrollPosition) current = heading.id
      })
      setActiveSection(current)
    }
    window.addEventListener("scroll", handleScroll)
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [headings])

  return (
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
            <p className="text-sm font-semibold text-slate-800 mb-2">Try Creator AI</p>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Generate scripts in your voice, create thumbnails, and more.
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
  )
}
