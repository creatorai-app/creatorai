"use client"

import * as motion from "motion/react-m";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/accordion"

export interface BlogFaqItem {
  question: string
  answer: string
}

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

/**
 * Animated FAQ accordion shared across all blog posts. Mirrors the landing-page
 * FAQSection animation (staggered fade/slide + collapsible accordion). JSON-LD
 * for these FAQs is emitted centrally in blog/[id]/layout.tsx, so this component
 * is presentation only — do not add FAQPage schema here or it will duplicate.
 */
export default function BlogFaqAccordion({ faqs }: { faqs: BlogFaqItem[] }) {
  if (faqs.length === 0) return null

  return (
    <div className="mt-16 pt-10 border-t border-slate-200">
      <h2
        id="frequently-asked-questions"
        className="scroll-mt-24 text-2xl md:text-[1.65rem] font-bold text-slate-900 tracking-tight mb-6 pb-3 border-b border-slate-200"
      >
        Frequently Asked Questions
      </h2>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <motion.div key={faq.question} variants={itemVariants}>
              <AccordionItem
                value={`faq-${i}`}
                className="border border-slate-200 rounded-xl px-4 bg-white shadow-sm hover:shadow-md hover:border-purple-200 transition-all duration-300"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4 font-semibold text-slate-800">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-[1.02rem] leading-relaxed text-slate-600 pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </motion.div>
    </div>
  )
}
