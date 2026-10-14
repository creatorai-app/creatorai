"use client"

import Link from "next/link";
import * as motion from "motion/react-m";
import FeatureCard from "../feature-card"
import {
  CORE_FEATURES,
  EXTRA_FEATURES,
} from "@/lib/product-features"

// This section used to keep its own hand-written list, which is how the landing
// page ended up advertising dubbing and video generation as "coming soon"
// months after both shipped. Same registry /features and /tools read from, so
// the next feature lands here for free.
const features = [
  ...CORE_FEATURES.map((f) => ({
    key: f.id,
    href: `/features#${f.id}`,
    title: f.title,
    icon: f.icon,
    description: f.cardDescription,
  })),
  ...EXTRA_FEATURES.map((f) => ({
    key: f.title,
    href: f.href ?? "/features",
    title: f.title,
    icon: f.icon,
    description: f.cardDescription,
  })),
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

export default function FeatureSection() {
  return (
    <div className="container px-4 md:px-6">
      <motion.div
        className="flex flex-col items-center text-center space-y-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50">
          Everything You Need to Create Better Content
        </h2>
        <p className="max-w-[700px] text-slate-600 dark:text-slate-400 md:text-lg">
          From the first idea to a dubbed, subtitled, published video. Creator AI has a tool for
          every step.
        </p>
      </motion.div>

      {/* A real <ul>/<li>: screen readers then announce the item count and let
          users step through the features. Tailwind's preflight already strips the
          markers, so nothing changes visually. */}
      <motion.ul
        className="grid auto-rows-fr grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <motion.li
              key={feature.key}
              variants={itemVariants}
              transition={{ type: "spring", stiffness: 100, damping: 14 }}
            >
              <Link href={feature.href} className="block h-full">
                <FeatureCard
                  title={feature.title}
                  icon={<Icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />}
                  description={feature.description}
                />
              </Link>
            </motion.li>
          )
        })}
      </motion.ul>
    </div>
  )
}
