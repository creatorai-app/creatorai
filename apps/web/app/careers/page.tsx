"use client"

import React, { useEffect, useState } from "react"
import { motion } from "motion/react"
import Link from "next/link"
import Lenis from "lenis"
import "lenis/dist/lenis.css"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import { SparklesCore } from "@repo/ui/sparkles"
import { MButton } from "@repo/ui/moving-border"
import {
  ArrowRight,
  MapPin,
  Briefcase,
  Heart,
  Rocket,
  Users,
  Globe,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { JobPost } from "@repo/validation"

const values = [
  {
    title: "Creator-First Mindset",
    description: "Everything we build starts with the creator's needs. We use our own product and listen to our community.",
    icon: Heart,
  },
  {
    title: "Move Fast, Ship Often",
    description: "We believe in rapid iteration. We ship features weekly and learn from real usage, not assumptions.",
    icon: Rocket,
  },
  {
    title: "Remote & Flexible",
    description: "Work from anywhere. We care about output, not hours logged. Flexible schedules, async communication.",
    icon: Globe,
  },
  {
    title: "Small Team, Big Impact",
    description: "Every person here shapes the product. No bureaucracy, no red tape, just talented people building great things.",
    icon: Users,
  },
]

const perks = [
  "Fully remote, work from anywhere",
  "Flexible working hours",
  "Competitive salary + equity",
  "Health & wellness budget",
  "Latest equipment provided",
  "Annual team retreats",
  "Learning & conference budget",
  "Unlimited PTO (with encouraged minimums)",
]

export default function CareersPage() {
  const [openings, setOpenings] = useState<JobPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true })
    return () => lenis.destroy()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("job_posts")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setOpenings(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <LandingPageNavbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative w-full min-h-[60vh] flex items-center justify-center bg-gradient-to-b from-white to-slate-50 overflow-hidden pt-24 pb-12">
          <div aria-hidden="true" className="absolute inset-0 -z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] bg-purple-100/40 rounded-full blur-3xl" />
            <SparklesCore
              background="transparent"
              minSize={0.2}
              maxSize={0.8}
              className="absolute inset-0 w-full h-full z-0"
              particleColor="#a855f7"
              particleDensity={20}
            />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
                Build the Future of{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                  Content Creation
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-8">
                Join a small, passionate team that's helping thousands of creators make better content with AI.
              </p>
              <a href="#openings">
                <MButton
                  className="bg-zinc-900 text-white hover:bg-zinc-800 shadow-md p-4"
                  borderClassName="border border-purple-500/60"
                >
                  View Open Positions
                  <ArrowRight className="ml-2 h-4 w-4" />
                </MButton>
              </a>
            </motion.div>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 bg-white">
          <div className="container max-w-6xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">What We Believe In</h2>
              <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                Our values shape how we work, what we build, and who we hire.
              </p>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {values.map((value, i) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex items-start gap-4 p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <value.icon className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-800 mb-2">{value.title}</h3>
                    <p className="text-slate-600">{value.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Perks */}
        <section className="py-20 bg-slate-50">
          <div className="container max-w-4xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Perks & Benefits</h2>
              <p className="text-slate-600 text-lg">We take care of our team so they can focus on building great things.</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {perks.map((perk, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-slate-700 font-medium">{perk}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Open Positions */}
        <section id="openings" className="scroll-mt-20 py-20 bg-white">
          <div className="container max-w-4xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Open Positions</h2>
              <p className="text-slate-600 text-lg">Find the role that's right for you.</p>
            </motion.div>

            <div className="space-y-4">
              {openings.map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-200 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-800 group-hover:text-purple-700 transition-colors">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" />
                          {job.team}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {job.location}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-xs font-medium">
                          {job.type}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/careers/apply?position=${encodeURIComponent(job.title)}&id=${job.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors self-start sm:self-center"
                    >
                      Apply
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <p className="text-sm text-slate-600">{job.description}</p>
                </motion.div>
              ))}

              {loading && openings.length === 0 && (
                <div className="text-center py-12 text-slate-500">Loading positions...</div>
              )}
              {!loading && openings.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No openings right now, but we're always meeting great people.
                </div>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-12 text-center"
            >
              <p className="text-slate-600 mb-4">
                Don't see a role that fits? We're always looking for talented people.
              </p>
              <Link
                href="/careers/apply"
                className="text-purple-600 font-medium hover:text-purple-800 transition-colors"
              >
                Send us your resume →
              </Link>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
