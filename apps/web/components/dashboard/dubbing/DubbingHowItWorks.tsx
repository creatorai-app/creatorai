"use client";
import * as motion from "motion/react-m";
import { UploadCloud, Languages, Mic, Clapperboard } from "lucide-react";

const steps = [
  { step: 1, title: "Upload media", desc: "Drop in an audio or video file. Starter covers 500MB and 45 minutes in one language; paid plans go up to 3GB and 3 hours, in two or three languages at once.", icon: UploadCloud },
  { step: 2, title: "Find the speakers & translate", desc: "Pick Cypher (in-house dubbing) or ElevenLabs. Both work out who speaks when and translate every line.", icon: Languages },
  { step: 3, title: "Clone every voice", desc: "Each speaker gets their own cloned voice, so every person in the original speaks the translation.", icon: Mic },
  { step: 4, title: "Merge & preview", desc: "For video, the dubbed audio is merged back over your footage, one file per language.", icon: Clapperboard },
];

// Same walkthrough embedded on the dubbing blog posts. nocookie + lazy so opening the
// panel does not set a YouTube cookie or fetch the player until it is actually shown.
const DEMO_VIDEO_ID = "Yg4J8mUJo-M";

export function DubbingHowItWorks() {
  return (
    <div className="space-y-8">
      <div>
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}`}
            title="Creator AI audio dubbing walkthrough"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Watch a full dub end to end, from upload to the finished track.
        </p>
      </div>

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
    </div>
  );
}
