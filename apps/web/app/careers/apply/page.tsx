// General application route. A specific opening now has its own page at
// /careers/<slug> with the same form in its Apply tab, so this page stays for
// "send us your resume" and for older links that still carry ?position=.
"use client"

import * as motion from "motion/react-m";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin, Briefcase } from "lucide-react";
import { SparklesCore } from "@repo/ui/sparkles";
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar";
import Footer from "@/components/footer";
import JobApplicationForm from "@/components/careers/JobApplicationForm";
import type { JobPost } from "@repo/validation"

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>}>
      <ApplyPageContent />
    </Suspense>
  )
}

function ApplyPageContent() {
  const searchParams = useSearchParams()
  const position = searchParams.get("position") || ""
  const jobPostId = searchParams.get("id") || ""

  const [job, setJob] = useState<JobPost | null>(null)

  useEffect(() => {
    if (!jobPostId && !position) return
    // Imported here, not at module scope: the Supabase client is ~180kB and a
    // static import put it in this page's first-load JS just to look up one job.
    import("@/lib/supabase/client").then(({ createClient }) => {
      const base = createClient().from("job_posts").select("*").eq("status", "active")
      const promise = jobPostId
        ? base.eq("id", jobPostId).maybeSingle()
        : base.ilike("title", position).maybeSingle()
      promise.then(({ data }) => { if (data) setJob(data) })
    })
  }, [position, jobPostId])

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <LandingPageNavbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative w-full flex items-center justify-center bg-gradient-to-b from-white to-slate-50 overflow-hidden pt-28 pb-12">
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
              <Link
                href="/careers"
                className="inline-flex items-center gap-1.5 text-sm text-purple-600 font-medium hover:text-purple-800 transition-colors mb-6"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                All Open Positions
              </Link>
              <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
                Apply for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                  {position || "a Position"}
                </span>
              </h1>

              {job ? (
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" />
                    {job.team}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {job.location}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-medium">
                    {job.type}
                  </span>
                </div>
              ) : (
                <p className="text-slate-600 max-w-xl mx-auto">
                  Tell us what you do and where you think you fit. We read every application.
                </p>
              )}

              {job && (
                <Link
                  href={`/careers/${job.slug}`}
                  className="inline-block mt-4 text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors"
                >
                  Read the full role description →
                </Link>
              )}
            </motion.div>
          </div>
        </section>

        {/* Application Form */}
        <section className="py-14 bg-slate-50">
          <div className="max-w-3xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
                Submit Your Application
              </h2>
              <JobApplicationForm
                position={position || job?.title || ""}
                jobPostId={jobPostId || job?.id}
                team={job?.team}
              />
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
