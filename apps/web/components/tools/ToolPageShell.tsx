import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, BookOpen, Check, Sparkles } from "lucide-react"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import SmoothScroll from "@/components/SmoothScroll"
import BlogFaqAccordion from "@/components/blog/BlogFaqAccordion"
import FeatureCard from "@/components/feature-card"
import RichText from "@/components/RichText"
import GoogleSignupCta from "@/components/tools/GoogleSignupCta"
import ConnectChannelCta from "@/components/tools/ConnectChannelCta"
import { FREE_TOOLS, type FreeTool } from "@/lib/free-tools"

/**
 * Every /tools page is this shell plus a widget. Server-rendered so the copy
 * that has to rank is in the HTML, with only the generator itself shipping as
 * client JS.
 *
 * Section order is the one these pages are read in: the tool first (the visitor
 * came to use it), then the answer paragraph, then the long-form body that
 * actually earns the ranking, then the FAQ and the signup CTA.
 */

export default function ToolPageShell({
  tool,
  children,
}: {
  tool: FreeTool
  children: ReactNode
}) {
  const otherTools = FREE_TOOLS.filter((t) => t.slug !== tool.slug)

  return (
    <div className="flex min-h-screen flex-col">
      <SmoothScroll />
      <LandingPageNavbar />

      <main className="flex-1">
        {/* Hero + the tool itself, above the fold */}
        <section className="relative w-full overflow-hidden bg-gradient-to-b from-white to-slate-50 pb-16 pt-32">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-0 -z-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-purple-100/40 blur-3xl"
          />
          <div className="relative z-10 mx-auto max-w-3xl px-6">
            <nav aria-label="Breadcrumb" className="mb-6 text-center text-sm text-slate-500">
              <Link href="/tools" className="hover:text-purple-600">
                Free tools
              </Link>
              <span className="mx-2 text-slate-300">/</span>
              <span className="text-slate-700">{tool.name}</span>
            </nav>

            <span className="mx-auto mb-4 flex w-fit items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Free · no signup for your first run
            </span>

            <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
              {tool.h1}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-slate-600">
              {tool.subhead}
            </p>
          </div>

          <div className="relative z-10 mx-auto mt-10 max-w-3xl px-6">
            {children}
            <div className="mt-6 flex justify-center">
              <ConnectChannelCta label={tool.connectLabel} />
            </div>
          </div>
        </section>

        {/* AEO: the direct answer, first thing after the tool */}
        <section className="border-y border-slate-200 bg-white py-12">
          <div className="mx-auto max-w-3xl px-6">
            <p className="border-l-4 border-purple-500 bg-slate-50 py-4 pl-5 pr-4 text-[1.05rem] leading-relaxed text-slate-700">
              {tool.answerSummary}
            </p>
          </div>
        </section>

        {/* Why this tool */}
        <section className="bg-white py-20">
          <div className="container mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="mb-12 text-center text-3xl font-bold text-slate-900 md:text-4xl">
              Why creators choose Creator AI&apos;s {tool.name}
            </h2>
            <ul className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-3">
              {tool.benefits.map((benefit) => (
                <li key={benefit.title}>
                  <FeatureCard
                    title={benefit.title}
                    icon={<benefit.icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />}
                    description={benefit.description}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-12 flex justify-center">
              <GoogleSignupCta
                source={`tool-${tool.slug}-why`}
                label="Sign up free with Google"
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
              How the {tool.name} works
            </h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {tool.steps.map((step, i) => (
                <li
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Long-form body */}
        <section className="bg-white py-16">
          <div className="mx-auto max-w-3xl px-6">
            {tool.sections.map((section) => (
              <div key={section.heading} className="mb-12 last:mb-0">
                <h2 className="mb-5 border-b border-slate-200 pb-3 text-2xl font-bold tracking-tight text-slate-900">
                  {section.heading}
                </h2>
                {section.body.map((paragraph, i) => (
                  <p key={i} className="mb-4 text-[1.05rem] leading-relaxed text-slate-700">
                    <RichText text={paragraph} />
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Use cases */}
        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
              When creators reach for this
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {tool.useCases.map((useCase) => (
                <div
                  key={useCase.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="flex items-start gap-2 font-semibold text-slate-900">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" aria-hidden="true" />
                    {useCase.title}
                  </h3>
                  <p className="mt-2 pl-6 text-sm leading-relaxed text-slate-600">
                    {useCase.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Upgrade path + other tools */}
        <section className="bg-white py-16">
          <div className="mx-auto max-w-5xl px-6">
            <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                This is the free sample. The real thing knows your channel.
              </h2>
              <p className="mt-3 max-w-2xl text-[1.02rem] leading-relaxed text-slate-700">
                {tool.upgrade.blurb}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <GoogleSignupCta
                  source={`tool-${tool.slug}`}
                  label="Get 500 free credits"
                  className="px-5 py-2.5 text-sm"
                />
                <Link
                  href={tool.upgrade.featureAnchor}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-purple-300 hover:text-purple-700"
                >
                  {tool.upgrade.label}
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:text-purple-700"
                >
                  Compare plans
                </Link>
              </div>
            </div>

            {otherTools.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xl font-bold text-slate-900">More free tools</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {otherTools.map((other) => (
                    <Link
                      key={other.slug}
                      href={`/tools/${other.slug}`}
                      className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-purple-300 hover:shadow-md"
                    >
                      <h3 className="font-semibold text-slate-900 group-hover:text-purple-700">
                        {other.name}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {other.cardDescription}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-600">
                        Try it free
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-12">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <BookOpen className="h-5 w-5 text-purple-600" aria-hidden="true" />
                Go deeper
              </h2>
              <ul className="mt-4 space-y-2.5">
                {tool.relatedPosts.map((post) => (
                  <li key={post.slug}>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="text-[1.02rem] text-purple-700 underline underline-offset-2 hover:text-purple-800"
                    >
                      {post.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ, JSON-LD is emitted in the route's layout, not here */}
        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-3xl px-6">
            <BlogFaqAccordion faqs={tool.faqs} />
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-slate-900 py-20 text-white">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Stop starting from a blank page</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300 md:text-lg">
              Scripts, ideas, thumbnails, subtitles and dubbing, all trained on your channel.
              500 credits a month, free, no card.
            </p>
            <div className="mt-8 flex justify-center">
              <GoogleSignupCta
                source={`tool-${tool.slug}-footer`}
                label="Create your free account"
              />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
