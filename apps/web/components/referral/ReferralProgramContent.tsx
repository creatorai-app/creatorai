"use client";

import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { Gift, CheckCircle2, ArrowRight } from "lucide-react";

import { FAQ, STEPS, HIGHLIGHTS } from "./referral-program-data";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const viewport = { once: true, margin: "-80px" } as const;

const REWARD_POINTS = [
  "1,000 credits for you on every successful referral",
  "1,000 bonus credits for your friend on their first purchase",
  "Rewards unlock on a real purchase. No empty sign-up bonuses",
  "No cap. Invite as many fellow creators as you want",
];

export default function ReferralProgramContent() {
  return (
    <main className="bg-white dark:bg-slate-950">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <motion.div
          aria-hidden
          className="absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-purple-300/25 blur-3xl dark:bg-purple-700/25"
          animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.08, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.18)_1px,transparent_0)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="relative mx-auto max-w-5xl px-6 py-20 text-center md:py-28"
        >
          <motion.span
            variants={fadeUp}
            className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-300"
          >
            <Gift className="h-3.5 w-3.5" /> Give 1,000, get 1,000
          </motion.span>
          <motion.h1
            variants={fadeUp}
            className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl"
          >
            Invite creator friends to{" "}
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-indigo-400">
              Creator AI
            </span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-400"
          >
            When a friend you referred makes their first purchase, you{" "}
            <strong>both get 1,000 credits</strong>. No sign-up bonuses, no limits,
            just real rewards for sharing a tool you love.
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-purple-600/20 transition-colors hover:bg-purple-700"
              >
                Start referring, it&apos;s free <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/dashboard/referrals"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                Open Referrals
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          {HIGHLIGHTS.map((h) => (
            <motion.div
              key={h.label}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5 text-center transition-colors hover:border-purple-300 dark:hover:border-purple-800"
            >
              <h.icon className="mx-auto h-6 w-6 text-purple-500" />
              <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {h.value}
              </div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {h.label}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{h.sub}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Why refer */}
      <section className="mx-auto max-w-5xl px-6 pb-4 pt-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-8 text-center"
        >
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Why share Creator AI?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
            Every creator you bring on board gets a head start with bonus credits and
            you get rewarded for growing the community around a tool that already saves you
            hours every week. The more creators you help, the more credits you stack up to
            fuel your own scripts, thumbnails, and ideas.
          </p>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
          >
            <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-600 dark:text-slate-400">
              Three steps from sharing your link to stacking credits.
            </p>
          </motion.div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="mt-10 grid gap-6 md:grid-cols-3"
          >
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 transition-colors hover:border-purple-300 dark:hover:border-purple-800"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/40">
                  <s.icon className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                </div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-purple-500">
                  Step {i + 1}
                </div>
                <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{s.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* What you get */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={viewport}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              What you both get
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              The referral program is built to be fair: rewards land only when your friend
              becomes a real customer, and when they do, you&apos;re both better off.
            </p>
            <motion.ul
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={viewport}
              className="mt-6 space-y-3"
            >
              {REWARD_POINTS.map((line) => (
                <motion.li
                  key={line}
                  variants={fadeUp}
                  className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {line}
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={viewport}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 p-8 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Example</p>
            <p className="mt-1 text-slate-700 dark:text-slate-300">
              Refer <strong>5 creators</strong> who each make a purchase:
            </p>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Credits per referral</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">1,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">5 referrals</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">5,000</span>
              </div>
              <div className="flex items-center justify-between border-t border-purple-200 dark:border-purple-900/50 pt-3">
                <span className="text-slate-600 dark:text-slate-400">You earn</span>
                <span className="text-lg font-bold text-purple-700 dark:text-purple-300">5,000 credits</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Plus your 5 friends collect 1,000 bonus credits each, 5,000 credits shared with
              the community on top.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Referral vs Affiliate */}
      <section className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewport}>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Referral or affiliate?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
              Want credits to power your own content? Use the <strong>referral program</strong>.
              Want real cash for driving subscriptions? Join the{" "}
              <Link
                href="/affiliate-program"
                className="font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400"
              >
                affiliate program
              </Link>{" "}
              and earn 20% recurring commission. You&apos;re welcome to do both.
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
          >
            Frequently asked questions
          </motion.h2>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
            className="mt-10 space-y-4"
          >
            {FAQ.map((f) => (
              <motion.details
                key={f.question}
                variants={fadeUp}
                className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-colors hover:border-purple-300 dark:hover:border-purple-800"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-slate-900 dark:text-slate-100 marker:hidden">
                  {f.question}
                  <span className="shrink-0 text-purple-500 transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {f.answer}
                </p>
              </motion.details>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewport}>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Ready to start referring?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-400">
            Grab your referral link and start sharing Creator AI with your community in under a
            minute.
          </p>
          <div className="mt-8 flex justify-center">
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-7 py-3 text-sm font-semibold text-white shadow-sm shadow-purple-600/20 transition-colors hover:bg-purple-700"
              >
                Get my referral link <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
