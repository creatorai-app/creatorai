// Server Component. The role body (react-markdown + remark-gfm) renders on the
// server, so those ~140kB of markdown libraries stay out of the client bundle.
// Only two small islands ship JS: the tab switcher and the application form.
import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Briefcase, Clock, MapPin } from "lucide-react"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import { SparklesCore } from "@repo/ui/sparkles"
import BlogContent from "@/components/blog/BlogContent"
import { markdownComponents } from "@/components/blog/markdownComponents"
import { AuthorCard } from "@/components/blog/AuthorByline"
import JobTabs from "@/components/careers/JobTabs"
import JobApplicationForm from "@/components/careers/JobApplicationForm"
import { getOpenRoles, getRoleBySlug, roleContent } from "@/lib/careers-source"
import { getAuthor } from "@/lib/authors"

const RISE = "animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700"

// Roles live in the database, so the set is read at build time and the pages
// re-render on the interval below when an admin edits one.
export const revalidate = 3600

export async function generateStaticParams() {
  return (await getOpenRoles()).map((job) => ({ slug: job.slug }))
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const job = await getRoleBySlug(slug)
  if (!job) notFound()

  const hiringManager = getAuthor("Afrin Nahar")

  return (
    <div className="flex flex-col min-h-screen">
      <LandingPageNavbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative w-full pt-32 pb-14 bg-gradient-to-b from-white to-slate-50 overflow-hidden">
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
          <div className="relative z-10 max-w-3xl mx-auto px-6">
            <div className={RISE}>
              <Link
                href="/careers"
                className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium mb-6 group"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                All Open Positions
              </Link>
              <h1 className="text-3xl md:text-[2.75rem] md:leading-[1.15] font-bold text-slate-900 mb-4 tracking-tight">
                {job.title}
              </h1>
              {/* No blurb here: the body opens with the same description, and
                  repeating it made the hero a wall of text. */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  {job.team}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {job.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {job.type}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Description / Apply */}
        <section className="py-12 sm:py-16 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            {/* useSearchParams needs a boundary for this page to stay static. */}
            <Suspense fallback={null}>
            <JobTabs
              description={
                <article className={`${RISE} max-w-none min-w-0`}>
                  <BlogContent content={roleContent(job)} components={markdownComponents} />

                  <div className="mt-12 rounded-2xl border border-purple-100 bg-purple-50/50 px-6 py-5">
                    <h2 className="text-sm font-semibold text-purple-800 mb-2">About Creator AI</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      We&apos;re a small, fast-moving team building AI tools that thousands of YouTube
                      creators rely on daily. You&apos;ll have real ownership over what you build, work
                      with cutting-edge AI technology, and directly impact how creators grow their
                      channels.
                    </p>
                  </div>

                  {hiringManager && (
                    // Same card as the blog byline, with the bio swapped for a
                    // line that fits a candidate reading a job post.
                    <AuthorCard
                      author={{
                        ...hiringManager,
                        bio: "I read every application myself. If you have questions about the role, the team or how we work before you apply, reach out to me directly on X or LinkedIn, or email support@trycreatorai.com.",
                      }}
                    />
                  )}
                </article>
              }
              apply={
                <div className={RISE}>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1 text-center">
                    Submit Your Application
                  </h2>
                  <p className="text-sm text-slate-500 text-center mb-8">
                    Applying for {job.title}
                  </p>
                  <JobApplicationForm
                    position={job.title}
                    jobPostId={job.id}
                    team={job.team}
                  />
                </div>
              }
            />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
