import Link from "next/link"
import { ArrowRight, BookOpen, Check } from "lucide-react"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import SmoothScroll from "@/components/SmoothScroll"
import BlogFaqAccordion from "@/components/blog/BlogFaqAccordion"
import FeatureCard from "@/components/feature-card"
import FeatureDemoVideo from "@/components/features/FeatureDemoVideo"
import RichText from "@/components/RichText"
import GoogleSignupCta from "@/components/tools/GoogleSignupCta"
import { CORE_FEATURES, type ProductFeature } from "@/lib/product-features"

/**
 * Every /features/<slug> page is this shell plus its registry entry. Server
 * rendered, like ToolPageShell: the copy that has to rank is in the HTML, and
 * the only client JS is the navbar and the FAQ accordion.
 *
 * ToolPageShell was the obvious thing to reuse and does not fit — it is typed to
 * FreeTool and about a third of it is tools-only ("free, no signup for your first
 * run", the /tools breadcrumb, ConnectChannelCta, the "this is the free sample"
 * upgrade panel). Making one component serve both would have meant threading half
 * a dozen booleans through it. The parts that genuinely are shared — RichText,
 * BlogFaqAccordion, FeatureCard, GoogleSignupCta — are imported, not copied.
 *
 * Section order follows the visit: what it is, then proof it works, then the
 * detail that earns the ranking, then the questions, then where to go next.
 */
export default function FeaturePageShell({ feature }: { feature: ProductFeature }) {
  // Curated siblings first, then everything else, so the set stays fully
  // interlinked without the hand-picked pair losing its place.
  const curated = feature.relatedFeatures ?? []
  const otherFeatures = CORE_FEATURES.filter((f) => f.id !== feature.id).sort(
    (a, b) =>
      (curated.indexOf(a.id) === -1 ? 99 : curated.indexOf(a.id)) -
      (curated.indexOf(b.id) === -1 ? 99 : curated.indexOf(b.id)),
  )
  const relatedPosts = feature.relatedPosts ?? []

  return (
    <div className="flex min-h-screen flex-col">
      <SmoothScroll />
      <LandingPageNavbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative w-full overflow-hidden bg-gradient-to-b from-white to-slate-50 pb-16 pt-32">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-0 -z-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-purple-100/40 blur-3xl"
          />
          <div className="relative z-10 mx-auto max-w-3xl px-6">
            <nav aria-label="Breadcrumb" className="mb-6 text-center text-sm text-slate-500">
              <Link href="/features" className="hover:text-purple-600">
                Features
              </Link>
              <span className="mx-2 text-slate-300">/</span>
              <span className="text-slate-700">{feature.title}</span>
            </nav>

            <div
              className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient}`}
            >
              <feature.icon className="h-7 w-7 text-white" aria-hidden="true" />
            </div>

            <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
              {feature.h1}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-purple-600">
              {feature.tagline}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <GoogleSignupCta source={`feature-${feature.id}-hero`} label="Start free" />
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-purple-300 hover:text-purple-700 sm:text-base"
              >
                See pricing
              </Link>
            </div>
          </div>
        </section>

        {/* Demo. Renders nothing until the feature has a demoVideo. */}
        {feature.demoVideo && (
          <section className="bg-white pt-12">
            <div className="mx-auto max-w-3xl px-6">
              <FeatureDemoVideo video={feature.demoVideo} title={feature.title} />
            </div>
          </section>
        )}

        {/* AEO: the direct answer, first thing after the hero */}
        <section className="border-y border-slate-200 bg-white py-12">
          <div className="mx-auto max-w-3xl px-6">
            <p className="border-l-4 border-purple-500 bg-slate-50 py-4 pl-5 pr-4 text-[1.05rem] leading-relaxed text-slate-700">
              {feature.answerSummary}
            </p>
          </div>
        </section>

        {/* What you get */}
        <section className="bg-white py-16">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              What {feature.title} gives you
            </h2>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-700">
              {feature.description}
            </p>
            <ul className="mt-8 space-y-3">
              {feature.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-3 text-slate-700">
                  <Check
                    className="mt-1 h-5 w-5 shrink-0 text-green-500"
                    aria-hidden="true"
                  />
                  <span className="text-[1.02rem] leading-relaxed">{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
              How {feature.title} works
            </h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {feature.steps.map((step, i) => (
                <li
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-12 flex justify-center">
              <GoogleSignupCta
                source={`feature-${feature.id}-steps`}
                label="Try it free with Google"
              />
            </div>
          </div>
        </section>

        {/* Long-form body */}
        <section className="bg-white py-16">
          <div className="mx-auto max-w-3xl px-6">
            {feature.sections.map((section) => (
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

        {/* FAQ. JSON-LD for these is emitted in the route's layout, not here. */}
        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-3xl px-6">
            <BlogFaqAccordion faqs={feature.faqs} />
          </div>
        </section>

        {/* Where to go next: the rest of the product, then the reading */}
        <section className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Explore the rest of Creator AI
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              Every plan includes all of it. {feature.title} is one part of the workflow.
            </p>
            <ul className="mt-8 grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {otherFeatures.map((other) => (
                <li key={other.id}>
                  <Link href={`/features/${other.id}`} className="block h-full">
                    <FeatureCard
                      title={other.title}
                      icon={
                        <other.icon
                          className="h-6 w-6 text-purple-600 dark:text-purple-400"
                          aria-hidden="true"
                        />
                      }
                      description={other.cardDescription}
                    />
                  </Link>
                </li>
              ))}
            </ul>

            {relatedPosts.length > 0 && (
              <div className="mt-16">
                <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                  <BookOpen className="h-5 w-5 text-purple-600" aria-hidden="true" />
                  Related reading
                </h2>
                <ul className="mt-5 space-y-2.5">
                  {relatedPosts.map((post) => (
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
                <Link
                  href="/blog"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700"
                >
                  Read the blog
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-slate-900 py-20 text-white">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              Start using {feature.title} today
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300 md:text-lg">
              Scripts, ideas, thumbnails, subtitles and dubbing, all trained on your channel.
              500 credits a month, free, no card.
            </p>
            <div className="mt-8 flex justify-center">
              <GoogleSignupCta
                source={`feature-${feature.id}-footer`}
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
