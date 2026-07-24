"use client"

import * as motion from "motion/react-m";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/accordion";
import { PenTool, Sparkles, Settings2 } from "lucide-react"

const steps = [
  {
    step: 1,
    title: "Describe Your Idea",
    desc: "Enter your video topic and any additional context. Pick a quick template or write your own prompt.",
    icon: PenTool,
  },
  {
    step: 2,
    title: "Customize Style",
    desc: "Choose tone, language, duration, and formatting options. The AI adapts to your channel's trained style.",
    icon: Settings2,
  },
  {
    step: 3,
    title: "Generate & Edit",
    desc: "AI writes a full script personalized to your voice. Edit, export as PDF, copy, or regenerate.",
    icon: Sparkles,
  },
]

export function ScriptHowItWorksGuide() {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Accordion type="single" collapsible defaultValue="how-it-works" className="w-full">
        <AccordionItem value="how-it-works">
          <AccordionTrigger className="font-semibold">How does script generation work?</AccordionTrigger>
          <AccordionContent className="pt-4">
            <div className="space-y-6">
              {steps.map(({ step, title, desc, icon: Icon }) => (
                <div key={step} className="flex items-start gap-4">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="pt-0.5">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </motion.div>
  )
}
