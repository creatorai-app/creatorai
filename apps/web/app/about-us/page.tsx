"use client"

import Footer from "@/components/footer"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import { SparklesCore } from "@repo/ui/sparkles"
import { TextGenerateEffect } from "@repo/ui/text-generate-effect"
import { InfiniteMovingCards } from "@repo/ui/infinite-moving-cards"
import { BackgroundBeams } from "@repo/ui/background-beams"
import { MButton } from "@repo/ui/moving-border"
import { motion } from "motion/react"
import Link from "next/link"
import {
  Zap, Heart, Users, TrendingUp, Lightbulb,
  Video, PenTool, Search, ImageIcon, BookOpen,
  FileText, Volume2, Gift, ArrowRight,
  Globe, MessageSquare, Settings, Sparkles,
} from "lucide-react"
import FeatureCard from "@/components/feature-card"
import { useEffect } from "react"
import Lenis from "lenis"
import "lenis/dist/lenis.css"

const benefits = [
  {
    title: "Truly Personalized Output",
    description: "Unlike generic AI, Creator AI trains on your past videos. Every output reflects your unique voice, tone, and style.",
    icon: Sparkles,
    gradient: "from-purple-500 to-indigo-500",
  },
  {
    title: "Save Hours of Brain Drain",
    description: "Reduces scripting time from 2–5 hours to minutes, enabling consistent posting and preventing burnout.",
    icon: Zap,
    gradient: "from-pink-500 to-rose-500",
  },
  {
    title: "Boost Creative Confidence",
    description: "Eliminates blank-page syndrome with brainstorming, generation, and enhancement, all personalized to your channel.",
    icon: Lightbulb,
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    title: "Your AI Creative Team",
    description: "Functions as a copywriter, researcher, scriptwriter, thumbnail assistant, and title generator, trained on you.",
    icon: Users,
    gradient: "from-emerald-500 to-green-500",
  },
  {
    title: "Authentic Engagement",
    description: "Because every script sounds like you, your audience stays connected, with no generic feel, just real content.",
    icon: TrendingUp,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    title: "Grow at Your Pace",
    description: "Templates, quick-start tools, and AI training that adapts to your evolving style as your channel grows.",
    icon: Heart,
    gradient: "from-rose-500 to-pink-500",
  },
]

const features = [
  { title: "YouTube Channel Connection", icon: Video, description: "Link your channel to personalize your AI experience." },
  { title: "Personalized AI Training", icon: Sparkles, description: "Upload 3–5 videos to train a custom AI model for your style and language." },
  { title: "Script Generation", icon: PenTool, description: "Input a topic and context to generate personalized scripts or let AI modify your existing draft." },
  { title: "Topic & Idea Research", icon: Search, description: "Add relevant links and stats from the web, uploaded PDFs, or let AI do the research for you." },
  { title: "Thumbnail Generator", icon: ImageIcon, description: "Creates thumbnails based on your past thumbnail style." },
  { title: "Course Module", icon: BookOpen, description: "Dedicated feature for educators to create complete course modules and playlists." },
  { title: "Subtitle Generator", icon: FileText, description: "Creates multi-language, editable subtitles for your videos." },
  { title: "Audio Translation", icon: Volume2, description: "Generate audio in multiple languages in your own voice using generative voice cloning." },
  { title: "Referral Program", icon: Gift, description: "Earn credits via referrals to unlock premium features." },
]

const futureFeatures = [
  { title: "Multi-Platform Support", description: "Expand features for TikTok, Instagram Reels, and podcasts.", icon: Globe },
  { title: "Collaboration Mode", description: "Real-time collaboration for teams.", icon: MessageSquare },
  { title: "Advanced Personalization", description: "Train AI with custom fine-tuned models.", icon: Settings },
  { title: "Creator Community", description: "Share generated content, templates, best prompts, and experiences.", icon: Users },
]

const niches = [
  "Technology", "Media", "Book Reviews", "Movie Reviews",
  "Finance", "Productivity", "Entertainment", "Tutorials", "Education",
]

export default function AboutPage() {
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true })
    return () => lenis.destroy()
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <LandingPageNavbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative w-full min-h-[100vh] flex items-center justify-center bg-gradient-to-b from-white to-slate-50 overflow-hidden pt-24">
          <div aria-hidden="true" className="absolute inset-0 -z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] bg-purple-100/40 rounded-full blur-3xl" />
            <SparklesCore
              background="transparent"
              minSize={0.2}
              maxSize={0.8}
              className="absolute inset-0 w-full h-full z-0"
              particleColor="#a855f7"
              particleDensity={35}
            />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
                An AI That Learns{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                  Your Voice
                </span>
              </h1>
              <h2 className="text-xl md:text-2xl text-slate-600 mb-8">
                Not just another generic tool, a content partner trained on you.
              </h2>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              <TextGenerateEffect
                words="Creator AI trains on your past videos, learns your tone, style, and language, then generates scripts, thumbnails, and subtitles that actually sound like you. Not generic. Personal."
                className="!text-slate-500 max-w-2xl mx-auto"
              />
            </motion.div>
          </div>
        </section>

        {/* Entity Profile, factual summary for search & AI crawlers */}
        <section className="py-16 bg-white border-b border-slate-100">
          <div className="container max-w-3xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">
                What is Creator AI?
              </h2>
              <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-4">
                <p>
                  <strong className="text-slate-800">Creator AI</strong> is an AI-powered production
                  platform for YouTube creators, available at{" "}
                  <a href="https://tryscriptai.com" className="text-purple-600 hover:text-purple-700">
                    tryscriptai.com
                  </a>
                  . Founded to solve the gap between generic AI tools and YouTube-specific content
                  creation, Creator AI learns each creator&apos;s unique voice from their existing
                  videos and generates scripts, thumbnails, subtitles, and dubbed audio in one
                  workflow.
                </p>
                <p>
                  Unlike general-purpose chatbots such as ChatGPT, Creator AI is built exclusively
                  for the YouTube creator pipeline, from topic research and story planning through
                  voice-matched script generation, CTR-optimized thumbnails, SRT/VTT subtitle export,
                  and AI dubbing in 24+ languages.
                </p>
              </div>
              <dl className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <dt className="font-semibold text-slate-800 mb-1">Product</dt>
                  <dd className="text-slate-600">Creator AI, AI assistant for YouTube creators</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800 mb-1">Website</dt>
                  <dd className="text-slate-600">tryscriptai.com</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800 mb-1">Core capability</dt>
                  <dd className="text-slate-600">Voice-matched script generation from your YouTube channel</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800 mb-1">Target users</dt>
                  <dd className="text-slate-600">YouTube UGC creators, solo and small teams</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800 mb-1">Key features</dt>
                  <dd className="text-slate-600">Scripts, thumbnails, subtitles, dubbing, ideation, story blueprints</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-800 mb-1">Differentiator</dt>
                  <dd className="text-slate-600">Learns your voice from videos, not prompt-based tone guessing</dd>
                </div>
              </dl>
              <blockquote className="mt-8 border-l-4 border-purple-400 pl-6 italic text-slate-700">
                &ldquo;Every creator has a voice their audience trusts. Generic AI flattens that voice.
                Creator AI exists so creators can publish faster without sounding like everyone
                else.&rdquo;, Creator AI Team
              </blockquote>
            </motion.div>
          </div>
        </section>

        {/* UVP */}
        <section className="py-24 bg-white overflow-hidden">
          <div className="container max-w-4xl mx-auto px-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                Personalization Is Our Core
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Every creator has a unique voice. Generic AI tools ignore that, Creator AI trains a custom AI
                on your past videos, learning your tone, vocabulary, pacing, and style. Every output is built from{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 font-bold">
                  your
                </span>{" "}
                creative fingerprint.
              </p>
            </motion.div>
          </div>

          <InfiniteMovingCards
            items={[
              { quote: "Generic AI gives everyone the same script. Creator AI gives you YOUR script, in your voice, your style, your words.", name: "Personalized Scripts", title: "Trained on your past videos" },
              { quote: "Upload 3–5 videos and the AI learns your tone, pacing, and vocabulary. Every output sounds authentically you.", name: "AI That Learns You", title: "Custom model per creator" },
              { quote: "Thumbnails that match your visual identity, not a one-size-fits-all template from a generic tool.", name: "Your Thumbnail Style", title: "Consistent brand identity" },
              { quote: "Subtitles and dubbed audio in multiple languages, all preserving your natural voice through generative cloning.", name: "Your Voice, Any Language", title: "Global reach, personal touch" },
              { quote: "From topic research to final script, every step is personalized to your channel's niche, audience, and history.", name: "End-to-End Personalization", title: "Not just output, the entire workflow" },
            ]}
            direction="left"
            speed="slow"
            pauseOnHover
            className="mx-auto"
          />
          <div className="mt-6">
            <InfiniteMovingCards
              items={[
                { quote: "Other tools treat every creator the same. Creator AI evolves with your channel, the more you use it, the better it gets.", name: "Adaptive Intelligence", title: "AI that grows with you" },
                { quote: "Course modules structured to your teaching style. Playlists organized the way your audience expects.", name: "Educator-Friendly", title: "Personalized course creation" },
                { quote: "2–5 hours of scripting reduced to minutes, without losing the authentic voice your audience subscribed for.", name: "Hours Saved, Voice Kept", title: "Speed without compromise" },
                { quote: "Your referral credits, your workflow, your creative fingerprint, everything in Creator AI revolves around you.", name: "Built Around You", title: "Every feature, personalized" },
              ]}
              direction="right"
              speed="slow"
              pauseOnHover
              className="mx-auto"
            />
          </div>
        </section>

        {/* Why Creator AI */}
        <section className="py-24 bg-slate-50">
          <div className="container max-w-6xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Why Personalization Changes Everything
              </h2>
              <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                When your AI actually understands you, content creation stops being a grind
                and starts feeling like a creative superpower.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((benefit, i) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${benefit.gradient} flex items-center justify-center mb-4`}>
                    <benefit.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">{benefit.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{benefit.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Target Audience */}
        <section className="py-24 bg-white">
          <div className="container max-w-4xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Built For Creators Like You
              </h2>
              <p className="text-lg text-slate-600">
                YouTube UGC content creators, solo or part of small to mid-sized teams.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-wrap justify-center gap-3"
            >
              {niches.map((niche) => (
                <span
                  key={niche}
                  className="px-4 py-2 rounded-full bg-purple-50 text-purple-700 text-sm font-medium border border-purple-100 hover:bg-purple-100 transition-colors"
                >
                  {niche}
                </span>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 bg-slate-50">
          <div className="container px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Every Feature, Personalized
              </h2>
              <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                Scripts, thumbnails, subtitles, dubbing, each powered by an AI model trained on your content, not generic templates.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              transition={{ staggerChildren: 0.1 }}
            >
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <motion.div
                    key={feature.title}
                    variants={{
                      hidden: { opacity: 0, y: 30 },
                      show: { opacity: 1, y: 0 },
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <FeatureCard
                      title={feature.title}
                      icon={<Icon className="h-6 w-6 text-slate-500" />}
                      description={feature.description}
                    />
                  </motion.div>
                )
              })}
            </motion.div>
          </div>
        </section>

        {/* Coming Soon */}
        <section className="py-24 bg-white">
          <div className="container max-w-5xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                What&apos;s Coming Next
              </h2>
              <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                We&apos;re just getting started. Here&apos;s a glimpse of what&apos;s on the roadmap.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {futureFeatures.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex items-start gap-4 p-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 hover:border-purple-300 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-1">{feature.title}</h3>
                    <p className="text-sm text-slate-600">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
