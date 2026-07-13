"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/accordion"
import { Button } from "@repo/ui/button"
import { Clapperboard, Camera, Sparkles, ArrowUpRight } from "lucide-react"

// Two-to-three quick, paraphrased tips from Omni's prompting guidance — the full,
// SEO-optimized version lives on the public /prompt-guide page.
const tips = [
  {
    title: "Direct it like a shot, not a keyword list",
    desc: "Name the subject, the action, the setting, and how the camera moves (slow push-in, drone flyover). Specific, cinematic direction beats a pile of adjectives.",
    icon: Camera,
  },
  {
    title: "Set the mood and lighting",
    desc: "Golden-hour glow, moody neon, soft overcast — lighting and tone tell the AI video generator what feeling to render, not just what to show.",
    icon: Sparkles,
  },
  {
    title: "Refine, don't restart",
    desc: "Generate once, then use Regenerate / edit to change one thing at a time (\"make it night\", \"remove the text\"). Stateful editing keeps everything else intact.",
    icon: Clapperboard,
  },
]

export function VideoHowItWorksGuide() {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Accordion type="single" collapsible defaultValue="how-it-works" className="w-full">
        <AccordionItem value="how-it-works">
          <AccordionTrigger className="font-semibold">How does AI video generation work?</AccordionTrigger>
          <AccordionContent className="pt-4">
            <div className="space-y-6">
              {tips.map(({ title, desc, icon: Icon }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="pt-0.5">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/prompt-guide" target="_blank" rel="noopener noreferrer">
                  Read the full AI video prompt guide
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </motion.div>
  )
}
