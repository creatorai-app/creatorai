"use client"

import React, { useEffect } from "react"
import { motion } from "motion/react"
import Link from "next/link"
import Lenis from "lenis"
import "lenis/dist/lenis.css"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import { SparklesCore } from "@repo/ui/sparkles"
import { ArrowRight, Bug, Plus, RefreshCw, Shield, Trash2 } from "lucide-react"
import {
  releases,
  type ChangeType,
  type ChangelogRelease,
  type ReleaseTag,
} from "@/lib/changelog-data"

const TYPE_META: Record<
  ChangeType,
  { label: string; icon: React.ElementType; className: string }
> = {
  added: { label: "Added", icon: Plus, className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  changed: { label: "Changed", icon: RefreshCw, className: "text-blue-700 bg-blue-50 border-blue-200" },
  fixed: { label: "Fixed", icon: Bug, className: "text-amber-700 bg-amber-50 border-amber-200" },
  removed: { label: "Removed", icon: Trash2, className: "text-rose-700 bg-rose-50 border-rose-200" },
  security: { label: "Security", icon: Shield, className: "text-purple-700 bg-purple-50 border-purple-200" },
}

const TAG_META: Record<ReleaseTag, { label: string; className: string }> = {
  major: { label: "Major", className: "bg-gradient-to-r from-purple-600 to-pink-500 text-white" },
  minor: { label: "Minor", className: "bg-purple-100 text-purple-700" },
  patch: { label: "Patch", className: "bg-slate-100 text-slate-700" },
}

const CHANGE_ORDER: ChangeType[] = ["added", "changed", "fixed", "security", "removed"]

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

function groupChanges(release: ChangelogRelease) {
  return CHANGE_ORDER
    .map((type) => ({ type, items: release.changes.filter((c) => c.type === type) }))
    .filter((g) => g.items.length > 0)
}

export default function ChangelogPage() {
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true })
    return () => lenis.destroy()
  }, [])

  const latest = releases[0]

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
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full mb-5">
                Currently on v{latest.version}
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
                What&apos;s{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                  New
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 max-w-xl mx-auto">
                Every release, feature launch, improvement, and fix, in one place. We ship weekly.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
                <a
                  href="https://github.com/scriptaiapp/scriptai/blob/main/CHANGELOG.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-purple-700 hover:text-purple-800 font-medium"
                >
                  View on GitHub <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <span className="text-slate-300">•</span>
                <a
                  href="https://github.com/scriptaiapp/scriptai/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium"
                >
                  GitHub Releases <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-16 bg-slate-50">
          <div className="container max-w-4xl mx-auto px-6">
            <ol className="relative border-l border-slate-200">
              {releases.map((release, i) => {
                const grouped = groupChanges(release)
                const tag = TAG_META[release.tag]

                return (
                  <motion.li
                    key={release.version}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="ml-6 pb-14 last:pb-0"
                  >
                    <span className="absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center">
                      <span className="absolute h-3.5 w-3.5 rounded-full bg-purple-200/60 animate-ping" />
                      <span className="relative h-3 w-3 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 ring-4 ring-slate-50" />
                    </span>

                    <article className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm hover:shadow-md hover:shadow-purple-500/10 transition-shadow">
                      <header className="flex flex-wrap items-center gap-3 mb-2">
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                          v{release.version}
                        </h2>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tag.className}`}>
                          {tag.label}
                        </span>
                        <time className="text-sm text-slate-500" dateTime={release.date}>
                          {formatDate(release.date)}
                        </time>
                      </header>

                      {release.title && (
                        <p className="text-base font-semibold text-purple-700 mb-3">{release.title}</p>
                      )}

                      {release.summary && (
                        <p className="text-slate-600 leading-relaxed mb-6">{release.summary}</p>
                      )}

                      <div className="space-y-5">
                        {grouped.map(({ type, items }) => {
                          const meta = TYPE_META[type]
                          const Icon = meta.icon
                          return (
                            <div key={type}>
                              <h3 className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border mb-3 ${meta.className}`}>
                                <Icon className="w-3.5 h-3.5" />
                                {meta.label}
                              </h3>
                              <ul className="space-y-2 pl-1">
                                {items.map((entry, idx) => (
                                  <li key={idx} className="flex gap-3 text-slate-700 leading-relaxed">
                                    <span className="mt-[9px] h-1 w-1 rounded-full bg-slate-400 shrink-0" />
                                    <span>{entry.description}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )
                        })}
                      </div>
                    </article>
                  </motion.li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-white">
          <div className="container max-w-2xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Got an idea for what we should build next?</h2>
              <p className="text-slate-600 mb-8">
                We ship based on creator feedback. Tell us what you want to see.
              </p>
              <Link
                href="/contact-us"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
              >
                Share feedback <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
