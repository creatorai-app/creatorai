"use client"

import React, { useEffect } from "react";
import * as motion from "motion/react-m";
import Link from "next/link";
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar";
import Footer from "@/components/footer";
import { SparklesCore } from "@repo/ui/sparkles";
import { MButton } from "@repo/ui/moving-border";
import { ArrowRight } from "lucide-react";
import { useSmoothScroll } from "@/hooks/useSmoothScroll"
import {
  CORE_FEATURES as coreFeatures,
  COMING_SOON_FEATURES as comingSoonFeatures,
  EXTRA_FEATURES as extraFeatures,
} from "@/lib/product-features"

export default function FeaturesPage() {
  useSmoothScroll();

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
              particleDensity={25}
            />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
                Every Tool You Need,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                  In One Place
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
                From brainstorming ideas to publishing your video, Creator AI helps you at every step of the content creation process.
              </p>
              <p className="mt-6 text-slate-600">
                Want to try before signing up?{" "}
                <Link
                  href="/tools"
                  className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-700"
                >
                  Use our free AI tools
                </Link>
                . No account needed.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Core Features */}
        {coreFeatures.map((feature, idx) => (
          <section
            key={feature.id}
            id={feature.id}
            className={`scroll-mt-20 py-20 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
          >
            <div className="container max-w-6xl mx-auto px-6">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${idx % 2 !== 0 ? "lg:grid-flow-dense" : ""}`}
              >
                <div className={idx % 2 !== 0 ? "lg:col-start-2" : ""}>
                  <div className={`inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} items-center justify-center mb-6`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                    {feature.title}
                  </h2>
                  <p className="text-lg text-purple-600 font-medium mb-4">
                    {feature.tagline}
                  </p>
                  <p className="text-slate-600 leading-relaxed mb-6">
                    {feature.description}
                  </p>
                  <ul className="space-y-3">
                    {feature.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-700">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {h}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/features/${feature.id}`}
                    className="mt-8 inline-flex items-center gap-1.5 font-medium text-purple-600 hover:text-purple-700"
                  >
                    See how it works
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>

                <div className={`${idx % 2 !== 0 ? "lg:col-start-1" : ""} flex items-center justify-center`}>
                  <div className={`w-full max-w-md aspect-square rounded-3xl bg-gradient-to-br ${feature.gradient} opacity-10`} />
                </div>
              </motion.div>
            </div>
          </section>
        ))}

        {/* Coming Soon */}
        <section className="py-20 bg-white">
          <div className="container max-w-5xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Coming Soon
              </h2>
              <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                We're building even more tools to help you create better content.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {comingSoonFeatures.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex flex-col items-center text-center gap-4 p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 hover:border-purple-300 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-lg text-slate-800">{feature.title}</h3>
                  <p className="text-sm text-slate-600">{feature.description}</p>
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                    Coming Soon
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Extra Features */}
        <section className="py-20 bg-slate-50">
          <div className="container max-w-4xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Plus More Built-In Tools
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {extraFeatures.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex items-start gap-4 p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-md transition-shadow"
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

        {/* CTA */}
        <section className="py-20 bg-slate-900 text-white">
          <motion.div
            className="container px-6 text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Start Creating Better Content Today
            </h2>
            <p className="max-w-[600px] mx-auto text-slate-300 md:text-lg mb-8">
              Sign up for free and see how Creator AI can change the way you make videos.
            </p>
            <Link href="/signup">
              <MButton
                size="lg"
                className="bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 hover:brightness-110 text-white shadow-md transition-all"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </MButton>
            </Link>
          </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
