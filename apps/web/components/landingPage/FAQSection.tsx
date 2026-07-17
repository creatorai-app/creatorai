"use client"

import { motion } from "motion/react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/accordion"
import JsonLd from "@/components/JsonLd"

const faqs = [
  {
    q: "What is Creator AI?",
    a: "Creator AI is an AI-powered tool built specifically for YouTubers. It helps you write scripts, generate video ideas, create thumbnails, add subtitles, and plan your story structure, all personalized to your unique style.",
  },
  {
    q: "How does the AI learn my style?",
    a: "You connect your YouTube channel and select 3-5 of your videos. The AI analyzes your speaking style, tone, vocabulary, and pacing to build a custom model. After that, everything it creates sounds like you.",
  },
  {
    q: "What can I create with it?",
    a: "You can generate video scripts, brainstorm video ideas based on trends, create eye-catching thumbnails, auto-generate subtitles from your videos, build structured story outlines with retention scoring, generate AI videos, and dub your videos into other languages in your own voice. Course building is coming soon.",
  },
  {
    q: "How do credits work?",
    a: "Credits are what power the AI. Each action (like generating a script or creating a thumbnail) uses a certain number of credits. The free Starter plan gives you 500 credits per month. Paid plans, Creator (3,000), Pro (8,000), Business (50,000) and Scale (150,000), give you more.",
  },
  {
    q: "Do I need a YouTube channel to use it?",
    a: "For the best experience, yes. Connecting your channel lets the AI learn your voice and style. However, some features like subtitles work without connecting a channel.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes! The Starter plan is completely free with 500 credits per month and no credit card required. Every feature is unlocked on the free plan, AI voice training, script generation, ideation, thumbnails, subtitles, story builder, dubbing and more. Paid plans simply give you more credits.",
  },
  {
    q: "Can I export my content?",
    a: "Absolutely. You can export scripts, download generated thumbnails, export subtitles as SRT or VTT files, and save your video ideas as PDFs.",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
}

export default function FAQSection() {
  return (
    <section id="faq" className="py-20 bg-slate-50 dark:bg-slate-900">
      <JsonLd data={faqJsonLd} />
      <div className="container px-4 md:px-6">
        <motion.div
          className="flex flex-col items-center text-center space-y-4 mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50">
            Frequently Asked Questions
          </h2>
          <p className="max-w-[700px] text-slate-600 dark:text-slate-400 md:text-lg">
            Got questions? We've got answers. Can't find yours? Email us at{" "}
            <a href="mailto:support@tryscriptai.com" className="text-purple-600 dark:text-purple-400 hover:underline">
              support@tryscriptai.com
            </a>
            .
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <motion.div key={i} variants={itemVariants}>
                <AccordionItem
                  value={`item-${i}`}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800/50 transition-all duration-300"
                >
                  <AccordionTrigger className="text-left hover:no-underline py-5 font-semibold text-slate-900 dark:text-slate-100">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 dark:text-slate-400 pb-5">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
