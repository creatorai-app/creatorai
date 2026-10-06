import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  Clock,
  Languages,
  Lock,
  Sparkles,
  Wand2,
} from "lucide-react"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import SmoothScroll from "@/components/SmoothScroll"
import JsonLd from "@/components/JsonLd"
import PipelineSVG from "@/components/howItWorks/PipelineSVG"
import GenerationFlowSVG from "@/components/howItWorks/GenerationFlowSVG"
import { FREE_TOOLS } from "@/lib/free-tools"
import { siteConfig } from "@/lib/seo"

/**
 * /how-it-works is the long-form answer to "what actually happens when I use
 * this", linked from the homepage's three-step summary.
 *
 * Server component, like the /tools pages and for the same reason: the copy
 * that has to rank belongs in the HTML. Reveals are CSS (tailwindcss-animate)
 * rather than motion's whileInView, so nothing waits on a hydration pass. That
 * is the same trade the homepage hero documents.
 *
 * Photography: Unsplash (free licence, commercial use, no attribution
 * required), downloaded into /public so it is served same-origin and stays
 * inside the existing `img-src 'self'` CSP.
 */

const PAGE_URL = `${siteConfig.url}/how-it-works`

const RISE = "animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700"

const STEPS = [
  {
    n: "01",
    title: "Connect your channel",
    text: "Sign in with Google and link your YouTube channel. Creator AI reads your public videos and channel stats, so it starts from what you have already published instead of a blank profile.",
    bullets: [
      "One-click Google sign-in",
      "Your subscribers, views and video count in the dashboard",
      "Nothing is posted to your channel",
    ],
    image: "/how-it-works/connect-train.webp",
    alt: "A creator holding a video camera on a shoot",
  },
  {
    n: "02",
    title: "Train the AI on your best videos",
    text: "Pick three to five videos that sound most like you. The model watches them, the actual footage rather than the titles and descriptions, and builds a style profile of your tone, pacing, vocabulary and the way you open a video.",
    bullets: [
      "Choose the videos that represent you best",
      "Learns tone, pacing, humour and vocabulary",
      "Retrain whenever your style moves on",
    ],
    image: "/how-it-works/camera-rig.webp",
    alt: "A professional video camera recording a performance",
  },
  {
    n: "03",
    title: "Create in your own voice",
    text: "Ask for a script, a set of video ideas, a story structure, a thumbnail or subtitles. Every generation is conditioned on your style profile, so the draft arrives sounding like your channel rather than like an AI.",
    bullets: [
      "Scripts with a real hook, sections and a closing CTA",
      "Ideas scored for opportunity in your niche",
      "Story structures with a retention score before you film",
    ],
    image: "/how-it-works/create.webp",
    alt: "A creator working at a laptop",
  },
  {
    n: "04",
    title: "Publish, then go further",
    text: "Export the script, download the thumbnail, pull subtitles out as SRT or VTT. When the video is finished, dub it into another language in a clone of your own voice and reach viewers who never found you before.",
    bullets: [
      "Export scripts, thumbnails, SRT and VTT",
      "Dub finished videos in your own cloned voice",
      "Generate short clips for B-roll and openers",
    ],
    image: "/how-it-works/grow.webp",
    alt: "A film crew gathered around a camera setup",
  },
]

const UNDER_THE_HOOD = [
  {
    icon: Wand2,
    title: "Your style is an input, not a prompt",
    text: "The profile built during training is attached to every generation. That is the difference between asking a chatbot to \"write like a YouTuber\" and having a model that has watched your videos.",
  },
  {
    icon: Sparkles,
    title: "Built for YouTube specifically",
    text: "Scripts are structured the way retention actually works: a hook in the first fifteen seconds, sections that re-hook, and a close that earns the next click. Generic assistants have no opinion about any of that.",
  },
  {
    icon: Lock,
    title: "Your channel stays yours",
    text: "Creator AI reads your videos to learn from them and never publishes on your behalf. Everything it generates is yours to use commercially, with no watermark and no attribution.",
  },
]

const FIRST_TEN_MINUTES = [
  { at: "0:00", label: "Sign in with Google and connect your channel" },
  { at: "0:30", label: "Pick 3-5 videos and start training" },
  { at: "~5:00", label: "Training finishes, your style profile is ready" },
  { at: "6:00", label: "Generate your first script in your own voice" },
  { at: "8:00", label: "Tweak the hook, export, and start filming" },
]

const FAQS = [
  {
    q: "How long does training take?",
    a: "A few minutes for three to five videos. You only do it once. After that every script, idea and story structure uses the profile it built, and you can retrain whenever your style changes.",
  },
  {
    q: "Do I need a YouTube channel to start?",
    a: "You can use the free tools with no account at all, and features like subtitles work without connecting a channel. But training is what makes the output sound like you, so a connected channel is where Creator AI earns its keep.",
  },
  {
    q: "What does the free plan actually include?",
    a: "The Starter plan is free, needs no card, and gives you 500 credits a month. That covers AI training, scripts, ideation, story structures, thumbnails and subtitles. Dubbing is available on every plan, with videos up to 45 minutes on Starter. Video generation needs a Pro plan or above.",
  },
  {
    q: "Will the scripts sound like AI wrote them?",
    a: "That is the problem the training step exists to solve. The model is conditioned on your own delivery, so the draft comes back in your vocabulary and pacing. Most creators record straight from it with light edits.",
  },
  {
    q: "Can I try it before signing up?",
    a: "Yes. The free tools run the same engines as the paid features with no account and no card. One full run each of the video ideas generator, script generator and story structure generator.",
  },
]

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to use Creator AI",
  description:
    "Connect your YouTube channel, train the AI on your own videos, and generate scripts, thumbnails, subtitles and dubs in your own voice.",
  totalTime: "PT10M",
  step: STEPS.map((s, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: s.title,
    text: s.text,
    url: `${PAGE_URL}#step-${i + 1}`,
  })),
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
}

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
    { "@type": "ListItem", position: 2, name: "How It Works", item: PAGE_URL },
  ],
}

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SmoothScroll />
      <JsonLd data={howToJsonLd} />
      <JsonLd data={faqJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <LandingPageNavbar />

      <main className="flex-1">
        {/* 1. Hero */}
        <section className="relative w-full overflow-hidden bg-gradient-to-b from-white to-slate-50 pb-20 pt-32">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-0 -z-0 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-purple-100/50 blur-3xl"
          />
          <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
            <div>
              <span
                className={`${RISE} inline-flex w-fit items-center gap-2 rounded-full border border-purple-200 bg-white/70 px-3 py-1 text-xs font-medium text-purple-700 backdrop-blur`}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                From blank page to published
              </span>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                How Creator AI{" "}
                <span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                  works
                </span>
              </h1>
              <p className={`${RISE} delay-150 mt-5 max-w-xl text-lg leading-relaxed text-slate-600`}>
                Most AI tools hand everyone the same output. Creator AI watches your videos
                first, builds a profile of how you actually talk, and writes from that. Here is
                the whole process, start to finish.
              </p>
              <div className={`${RISE} delay-300 mt-8 flex flex-col gap-3 sm:flex-row`}>
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/tools"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-purple-300 hover:text-purple-700"
                >
                  Try a tool without signing up
                </Link>
              </div>
              <p className={`${RISE} delay-500 mt-4 text-sm text-slate-500`}>
                500 free credits every month. No card required.
              </p>
            </div>

            <div className={`${RISE} delay-300`}>
              <PipelineSVG className="h-auto w-full" />
            </div>
          </div>
        </section>

        {/* 2. The four steps */}
        <section className="border-t border-slate-200 bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                The process
              </span>
              <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
                Four steps, and only one of them takes any setup
              </h2>
              <p className="mt-4 text-slate-600 md:text-lg">
                Training is the part that makes everything else personal. You do it once.
              </p>
            </div>

            <div className="mt-16 space-y-20 lg:space-y-28">
              {STEPS.map((step, i) => (
                <div
                  key={step.n}
                  id={`step-${i + 1}`}
                  className="grid scroll-mt-28 items-center gap-10 lg:grid-cols-2 lg:gap-16"
                >
                  <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl font-bold text-purple-200">{step.n}</span>
                      <span className="h-px flex-1 bg-gradient-to-r from-purple-200 to-transparent" />
                    </div>
                    <h3 className="mt-4 text-2xl font-bold text-slate-900 md:text-3xl">
                      {step.title}
                    </h3>
                    <p className="mt-4 leading-relaxed text-slate-600">{step.text}</p>
                    <ul className="mt-6 space-y-3">
                      {step.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-100">
                            <Check className="h-3 w-3 text-purple-600" aria-hidden="true" />
                          </span>
                          <span className="text-sm text-slate-700">{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                    <div className="relative overflow-hidden rounded-2xl shadow-lg ring-1 ring-slate-200">
                      <Image
                        src={step.image}
                        alt={step.alt}
                        width={1400}
                        height={933}
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="aspect-[4/3] w-full object-cover"
                        priority={i === 0}
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-purple-900/25 via-transparent to-transparent"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Under the hood */}
        <section className="border-t border-slate-200 bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                Under the hood
              </span>
              <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
                What happens when you press Generate
              </h2>
              <p className="mt-4 text-slate-600 md:text-lg">
                Your prompt never travels alone. It is combined with the style profile built from
                your own videos before a single word is written.
              </p>
            </div>

            <div className="mt-12 overflow-x-auto rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
              <GenerationFlowSVG className="mx-auto h-auto w-full min-w-[540px] max-w-3xl" />
            </div>

            <ul className="mt-12 grid auto-rows-fr gap-6 md:grid-cols-3">
              {UNDER_THE_HOOD.map((item) => (
                <li
                  key={item.title}
                  className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 ring-1 ring-purple-100">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 4. Your first ten minutes */}
        <section className="border-t border-slate-200 bg-white py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                Your first session
              </span>
              <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
                Ten minutes from sign-up to a script you can film
              </h2>
              <p className="mt-4 leading-relaxed text-slate-600">
                Nothing to install, nothing to configure. The only wait is training, and it runs
                while you get on with something else.
              </p>

              <ol className="mt-8 space-y-0">
                {FIRST_TEN_MINUTES.map((item, i) => (
                  <li key={item.at} className="flex gap-5">
                    <div className="flex flex-col items-center">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-700">
                        {i + 1}
                      </span>
                      {i < FIRST_TEN_MINUTES.length - 1 && (
                        <span className="w-px flex-1 bg-gradient-to-b from-purple-200 to-purple-100" />
                      )}
                    </div>
                    <div className="pb-7">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {item.at}
                      </span>
                      <p className="mt-1 text-sm text-slate-700">{item.label}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                <Languages
                  className="mr-2 inline h-4 w-4 text-purple-600"
                  aria-hidden="true"
                />
                Already have a finished video? Skip straight to subtitles or dubbing. Neither
                needs a trained profile.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl shadow-lg ring-1 ring-slate-200">
              <Image
                src="/how-it-works/edit-desk.webp"
                alt="An editing workstation with a large monitor"
                width={1400}
                height={2100}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="aspect-[4/5] w-full object-cover"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-purple-900/30 via-transparent to-transparent"
              />
            </div>
          </div>
        </section>

        {/* 5. Questions, free tools and the CTA */}
        <section className="border-t border-slate-200 bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-6">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                Before you start
              </span>
              <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">
                The questions people ask first
              </h2>
            </div>

            <dl className="mt-12 space-y-4">
              {FAQS.map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-7"
                >
                  <dt className="font-semibold text-slate-900">{faq.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-slate-600">{faq.a}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-14 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-center text-lg font-semibold text-slate-900">
                Or skip the reading and run one now
              </h3>
              <ul className="mt-6 flex flex-wrap justify-center gap-3">
                {FREE_TOOLS.map((tool) => (
                  <li key={tool.slug}>
                    <Link
                      href={`/tools/${tool.slug}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-purple-300 hover:text-purple-700"
                    >
                      {tool.name}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-900 py-20 text-white">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Train it on your channel tonight</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300 md:text-lg">
              Connect YouTube, pick a few videos, and every script after that sounds like you
              wrote it. 500 free credits a month, no card required.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 px-7 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
              >
                Get started free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                See every feature
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
