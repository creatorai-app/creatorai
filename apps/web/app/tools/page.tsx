import Link from "next/link"
import {
  ArrowRight,
  Check,
  Clapperboard,
  ImageIcon,
  Languages,
  Sparkles,
  Subtitles,
  Video,
} from "lucide-react"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import { FREE_TOOLS } from "@/lib/free-tools"

/**
 * The /tools hub. Two jobs: rank for "free ai tools for youtube", and pass link
 * equity down to each tool page. Everything above the fold is a link into a
 * tool, because a hub nobody clicks through is just a list.
 */

const IN_APP_TOOLS = [
  {
    icon: Video,
    name: "AI Studio",
    description: "Train the AI on your own videos so everything after it sounds like you.",
    href: "/features#ai-studio",
  },
  {
    icon: ImageIcon,
    name: "Thumbnail generator",
    description: "Thumbnails from a prompt, a video frame, or a reference image.",
    href: "/features#thumbnails",
  },
  {
    icon: Subtitles,
    name: "Subtitle generator",
    description: "Accurate subtitles from your video, exported as SRT or VTT.",
    href: "/features#subtitles",
  },
  {
    icon: Clapperboard,
    name: "Story builder",
    description: "Structured outlines with hooks, escalation points and a retention score.",
    href: "/features#story-builder",
  },
  {
    icon: Languages,
    name: "AI dubbing",
    description: "Dub your videos into other languages, in your own voice.",
    href: "/features#dubbing",
  },
]

export default function ToolsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingPageNavbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative w-full overflow-hidden bg-gradient-to-b from-white to-slate-50 pb-16 pt-32">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-0 -z-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-purple-100/40 blur-3xl"
          />
          <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
            <span className="mx-auto mb-4 flex w-fit items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              No signup for your first run
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
              Free AI tools for YouTube creators
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
              Real generators, not demos. Get a complete video idea or a full, ready-to-record
              script in seconds, no account, no card, and what you generate is yours to use.
            </p>
          </div>
        </section>

        {/* The free tools */}
        <section className="border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Try them right now, free
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              Each one runs the same engine as the feature inside Creator AI, trimmed to a single
              generation so you can judge the quality before you sign up for anything.
            </p>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {FREE_TOOLS.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:border-purple-300 hover:shadow-md"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500">
                    <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 group-hover:text-purple-700">
                    {tool.name}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                    {tool.cardDescription}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-purple-600">
                    Use it free
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Why free */}
        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Why these are free
            </h2>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-700">
              Because the hard part of our product is not generating text, it is generating text
              that sounds like <em>you</em>. These pages show you the quality of the engine. What
              they cannot show you is the thing that makes it worth an account: Creator AI reads
              your existing videos and builds a style profile from your tone, pacing, vocabulary
              and structure, then writes everything against it.
            </p>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-700">
              So use these as much as they are useful. If the output is close but not quite your
              voice, that gap is exactly what the free account fixes.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "No signup for your first generation",
                "No credit card, ever, on the free plan",
                "Everything you generate is yours commercially",
                "500 free credits a month once you sign up",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-slate-700">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-purple-600" aria-hidden="true" />
                  <span className="text-[0.98rem]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* In-app tools */}
        <section className="bg-white py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Inside the free account
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              The Starter plan unlocks every feature, the limit is credits, not capability.
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {IN_APP_TOOLS.map((tool) => (
                <Link
                  key={tool.name}
                  href={tool.href}
                  className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-purple-300 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100">
                    <tool.icon className="h-5 w-5 text-purple-600" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-800 group-hover:text-purple-700">
                      {tool.name}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {tool.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/features"
                className="text-sm font-medium text-purple-600 underline underline-offset-2 hover:text-purple-700"
              >
                See all features →
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-medium text-purple-600 underline underline-offset-2 hover:text-purple-700"
              >
                Compare plans →
              </Link>
              <Link
                href="/blog"
                className="text-sm font-medium text-purple-600 underline underline-offset-2 hover:text-purple-700"
              >
                Read the blog →
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-900 py-20 text-white">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Get the version that sounds like you</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300 md:text-lg">
              Connect your channel, train the AI on a few of your videos, and every script, idea
              and thumbnail after that is personalized. 500 credits a month, free, no card.
            </p>
            <Link
              href="/signup?ref=tools-hub"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 px-6 py-3 font-medium text-white transition hover:brightness-110"
            >
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
