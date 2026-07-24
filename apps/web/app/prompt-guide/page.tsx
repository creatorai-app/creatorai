"use client"
import Link from "next/link";
import * as motion from "motion/react-m";
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar";
import Footer from "@/components/footer";
import { Type, ImageIcon, Layers, Wand2, Camera, Lightbulb, ArrowRight } from "lucide-react"

const formula = [
  { key: "Subject", hint: "Who or what is on screen: a red fox, a vintage car, a barista." },
  { key: "Action", hint: "What it does: sprinting, drifting, pouring a latte." },
  { key: "Setting", hint: "Where it happens: a snowy forest, a neon alley, a sunlit café." },
  { key: "Camera", hint: "How it's shot: slow push-in, drone flyover, handheld follow." },
  { key: "Lighting & mood", hint: "The feeling: golden hour, moody neon, soft overcast calm." },
]

const modes = [
  {
    icon: Type,
    title: "Text-to-video prompts",
    body:
      "With text-to-video you build the whole scene from words, so detail wins. Instead of \"a dog running\", try \"a golden retriever sprinting along a wet beach at sunrise, camera tracking alongside, warm backlight\". Name one clear subject, one main action, and the camera move. Piling on five subjects usually muddies the shot.",
    example: "A lone lighthouse on a cliff during a storm, waves crashing below, slow aerial orbit, dramatic overcast light.",
  },
  {
    icon: ImageIcon,
    title: "Image-to-video prompts",
    body:
      "Image-to-video animates a still you provide, so your prompt should describe motion, not the scene. The picture already sets the look. Your words say what moves and how the camera behaves. Keep it about action: \"gently zoom in as she turns her head and smiles, hair moving in the breeze\".",
    example: "Slowly push in on the character while steam rises from the cup and neon signs flicker behind them.",
  },
  {
    icon: Layers,
    title: "Reference-to-video prompts",
    body:
      "Reference-to-video takes up to three subject images and stages them together in a new clip. Upload clean, well-lit references, then describe the scene they act out. Great for keeping a character, product, or mascot consistent across videos without re-describing them each time.",
    example: "The mascot from image 1 waves next to the product from image 2 on a bright studio backdrop, playful bounce.",
  },
]

const mistakes = [
  "Stuffing keywords instead of directing a shot: write like a director, not a search box.",
  "Asking for many actions at once: one clear beat per clip reads far cleaner than five.",
  "Forgetting the camera and lighting: they decide the mood as much as the subject does.",
  "Starting over to fix one detail: use editing to change a single thing and keep the rest.",
]

const faqs = [
  {
    q: "How do I write a good prompt for AI video generation?",
    a: "Direct it like a shot: name the subject, the action, the setting, the camera move, and the lighting or mood. Specific, cinematic direction beats a long list of adjectives.",
  },
  {
    q: "What's the difference between text-to-video, image-to-video, and reference-to-video?",
    a: "Text-to-video builds a scene from words alone. Image-to-video animates a still you upload, so you describe motion. Reference-to-video uses subject images to keep characters or products consistent in a new scene.",
  },
  {
    q: "How do I edit an AI-generated video without regenerating it?",
    a: "Use stateful editing: after a clip is made, ask for one change at a time (\"make it night\", \"remove the text\"). The model keeps everything else intact instead of starting from scratch.",
  },
  {
    q: "How long can AI-generated video clips be?",
    a: "Clips run up to about 10 seconds with synchronized audio. For longer stories, generate several clips and stitch them together.",
  },
]

export default function PromptGuidePage() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <LandingPageNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-32 pb-16">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-300"
          >
            <Wand2 className="h-3.5 w-3.5" /> AI Video Prompt Guide
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="mt-5 text-4xl md:text-5xl font-bold tracking-tight"
          >
            How to write prompts for AI video generation
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-slate-600 dark:text-slate-400"
          >
            A plain-English guide to writing better AI video prompts (text-to-video, image-to-video,
            and reference-to-video) with a simple prompt formula, real examples, and the mistakes to skip.
          </motion.p>
        </div>
      </section>

      {/* Formula */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Camera className="h-5 w-5 text-purple-600" />
          <h2 className="text-2xl font-bold">The AI video prompt formula</h2>
        </div>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Every strong prompt answers five quick questions. Run through them in order and you'll write
          shootable prompts that AI video generators actually understand.
        </p>
        <div className="grid gap-3">
          {formula.map((f, i) => (
            <div key={f.key} className="flex items-start gap-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 font-semibold text-sm">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold">{f.key}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{f.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modes */}
      <section className="px-6 py-12 max-w-4xl mx-auto space-y-10">
        <h2 className="text-2xl font-bold">Prompts for each type of AI video</h2>
        {modes.map(({ icon: Icon, title, body, example }) => (
          <div key={title} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">{title}</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400">{body}</p>
            <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Example prompt</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 italic">&ldquo;{example}&rdquo;</p>
            </div>
          </div>
        ))}
      </section>

      {/* Editing */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Wand2 className="h-5 w-5 text-purple-600" />
          <h2 className="text-2xl font-bold">Editing prompts: change one thing at a time</h2>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          The fastest way to a great clip is rarely the first prompt. It's the edits. After a video is
          generated, you can refine it with short instructions like &ldquo;make it night time&rdquo;,
          &ldquo;remove the on-screen text&rdquo;, or &ldquo;add falling snow&rdquo;. Because the edit is
          stateful, everything you didn't mention stays the same, so you can dial in a shot step by step
          instead of rolling the dice on a brand-new generation.
        </p>
      </section>

      {/* Mistakes */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Lightbulb className="h-5 w-5 text-purple-600" />
          <h2 className="text-2xl font-bold">Common AI video prompt mistakes</h2>
        </div>
        <ul className="space-y-3">
          {mistakes.map((m) => (
            <li key={m} className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
              {m}
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">AI video prompt FAQ</h2>
        <div className="space-y-5">
          {faqs.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{f.q}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <div className="rounded-3xl bg-slate-900 p-10 text-center text-white relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-600/30 rounded-full blur-3xl" />
          <h2 className="relative text-2xl md:text-3xl font-bold">Put it to work</h2>
          <p className="relative mt-2 text-slate-300">Turn your next prompt into a finished video clip.</p>
          <Link
            href="/dashboard/video-generation"
            className="relative mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Start generating <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}
