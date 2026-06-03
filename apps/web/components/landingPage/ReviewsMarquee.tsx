"use client"

import { Star } from "lucide-react"
import { motion } from "motion/react"

import { Marquee } from "@repo/ui/marquee"
import { LANDING_DUMMY_REVIEWS } from "@/lib/landing-dummy-reviews"
import { cn } from "@/lib/utils"

function ReviewCard({
  img,
  name,
  handle,
  subscriberLine,
  quote,
}: {
  img: string
  name: string
  handle: string
  subscriberLine: string
  quote: string
}) {
  return (
    <figure
      className={cn(
        "relative h-full w-64 shrink-0 cursor-pointer overflow-hidden rounded-xl border p-4",
        "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
        "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]"
      )}
    >
      <div className="mb-2 flex gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
            strokeWidth={0}
          />
        ))}
      </div>
      <div className="flex flex-row items-start gap-2">
        <img
          className="rounded-full"
          width={32}
          height={32}
          loading="lazy"
          alt={`${name}, YouTube creator`}
          src={img}
        />
        <div className="min-w-0 flex-1">
          <figcaption className="text-sm font-medium text-slate-900 dark:text-white">
            {name}
          </figcaption>
          <p className="truncate text-xs font-medium text-slate-500 dark:text-white/40">
            {handle}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            {subscriberLine}
          </p>
        </div>
      </div>
      <blockquote className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {quote}
      </blockquote>
    </figure>
  )
}

export default function ReviewsMarquee() {
  const mid = Math.ceil(LANDING_DUMMY_REVIEWS.length / 2)
  const firstRow = LANDING_DUMMY_REVIEWS.slice(0, mid)
  const secondRow = LANDING_DUMMY_REVIEWS.slice(mid)

  return (
    <div className="w-full">
      <motion.div
        className="container mx-auto mb-10 max-w-6xl px-4 text-center md:px-6"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1.5 text-sm font-medium text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
          Social proof
        </span>
        <h2 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-50 md:text-4xl">
          Loved by creators
        </h2>
      </motion.div>

      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
        <Marquee pauseOnHover className="[--duration:20s]">
          {firstRow.map((r) => (
            <ReviewCard
              key={r.id}
              img={r.img}
              name={r.name}
              handle={r.handle}
              subscriberLine={r.subscriberLine}
              quote={r.quote}
            />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:20s]">
          {secondRow.map((r) => (
            <ReviewCard
              key={r.id}
              img={r.img}
              name={r.name}
              handle={r.handle}
              subscriberLine={r.subscriberLine}
              quote={r.quote}
            />
          ))}
        </Marquee>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-white to-transparent dark:from-slate-800" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-white to-transparent dark:from-slate-800" />
      </div>
    </div>
  )
}
