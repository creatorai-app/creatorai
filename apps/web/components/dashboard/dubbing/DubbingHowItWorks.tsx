"use client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/accordion";
import * as motion from "motion/react-m";
import { UploadCloud, Languages, Mic, Clapperboard } from "lucide-react";

const steps = [
  { step: 1, title: "Upload media", desc: "Drop in an audio or video file up to 500MB, 45 minutes.", icon: UploadCloud },
  { step: 2, title: "Transcribe & translate", desc: "We transcribe the speech and translate it into your target language.", icon: Languages },
  { step: 3, title: "Clone the voice", desc: "The original voice is cloned and speaks the translation naturally.", icon: Mic },
  { step: 4, title: "Merge & preview", desc: "For video, the dubbed audio is merged back over your footage.", icon: Clapperboard },
];

export function DubbingHowItWorks() {
  return (
    <Accordion type="single" collapsible defaultValue="how-it-works" className="w-full">
      <AccordionItem value="how-it-works" className="border-none">
        <AccordionTrigger className="font-semibold">How does audio dubbing work?</AccordionTrigger>
        <AccordionContent className="pt-4">
          <div className="space-y-6">
            {steps.map(({ step, title, desc, icon: Icon }) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: step * 0.08, duration: 0.35 }}
                className="flex items-start gap-4"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="pt-0.5">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
