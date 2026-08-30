import Link from "next/link"
import { ArrowRight, Sparkles, Zap, Lock, Wand2 } from "lucide-react"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import FeatureCard from "@/components/feature-card"
import GoogleSignupCta from "@/components/tools/GoogleSignupCta"
import { FREE_TOOLS } from "@/lib/free-tools"
import { CORE_FEATURES, EXTRA_FEATURES } from "@/lib/product-features"

/**
 * The /tools hub. The tools themselves are the first thing under the hero,
 * because someone landing here came to use one, not to read about them. The
 * pitch comes after, once they have seen what is on offer.
 */

const WHY_FREE_TOOLS = [
  {
    icon: Wand2,
    title: "Real generators, not demos",
    description:
      "Each tool runs the same engine as the paid feature, trimmed to one generation. What you get here is the quality you get inside the app.",
  },
  {
    icon: Zap,
    title: "Nothing to set up",
    description:
      "No account, no card, no onboarding. Type one line, get a finished result in about ten seconds, and use it however you like.",
  },
  {
    icon: Lock,
    title: "Yours to keep",
    description:
      "Everything you generate is yours commercially, with no attribution and no watermark. Copy it out and put it on your channel.",
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
            <div className="mt-8 flex justify-center">
              <GoogleSignupCta source="tools-hub-hero" label="Get started free" />
            </div>
          </div>

          {/* The tools, immediately */}
          <div className="relative z-10 mx-auto mt-12 grid max-w-5xl gap-6 px-6 md:grid-cols-2">
            {FREE_TOOLS.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:border-purple-300 hover:shadow-lg"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-100 bg-purple-50 text-purple-600 shadow-sm">
                  <tool.icon className="h-6 w-6" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-slate-900 group-hover:text-purple-700">
                  {tool.name}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                  {tool.cardDescription}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-purple-600">
                  Try it free
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Why creators use them */}
        <section className="border-t border-slate-200 bg-white py-20">
          <div className="container mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-12 flex flex-col items-center text-center">
              <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                Why creators use Creator AI&apos;s free tools
              </h2>
              <p className="mt-4 max-w-2xl text-slate-600 md:text-lg">
                Most free generators are a taste of a demo. These are the real thing, capped at one
                run so you can judge the output before deciding anything.
              </p>
            </div>

            <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {WHY_FREE_TOOLS.map((item) => (
                <li key={item.title}>
                  <FeatureCard
                    title={item.title}
                    icon={<item.icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />}
                    description={item.description}
                  />
                </li>
              ))}
            </ul>

            <div className="mt-12 flex justify-center">
              <GoogleSignupCta source="tools-hub-why" label="Sign up free with Google" />
            </div>
          </div>
        </section>

        {/* Everything in the free account */}
        <section className="bg-slate-50 py-20">
          <div className="container mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-12 flex flex-col items-center text-center">
              <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
                Inside the free account
              </h2>
              <p className="mt-4 max-w-2xl text-slate-600 md:text-lg">
                The Starter plan unlocks every feature. The limit is credits, not capability, and
                there is no card required to start.
              </p>
            </div>

            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {CORE_FEATURES.map((feature) => (
                <li key={feature.id}>
                  <Link href={`/features#${feature.id}`} className="block h-full">
                    <FeatureCard
                      title={feature.title}
                      icon={
                        <feature.icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      }
                      description={feature.tagline}
                    />
                  </Link>
                </li>
              ))}
              {EXTRA_FEATURES.map((feature) => (
                <li key={feature.title}>
                  <Link href="/features" className="block h-full">
                    <FeatureCard
                      title={feature.title}
                      icon={
                        <feature.icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      }
                      description={feature.description}
                    />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <GoogleSignupCta source="tools-hub-features" label="Get 500 free credits" />
              <Link
                href="/features"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-purple-300 hover:text-purple-700 sm:text-base"
              >
                See all features
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
            <div className="mt-8 flex justify-center">
              <GoogleSignupCta source="tools-hub-footer" label="Start free with Google" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
