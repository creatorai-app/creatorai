"use client";

import { useEffect } from "react";
import * as motion from "motion/react-m";
import Link from "next/link";
import { type Variants } from "motion/react";
import { Repeat, CheckCircle2, ArrowRight } from "lucide-react";

import { FAQ, STEPS, HIGHLIGHTS } from "./affiliate-program-data";
import { useSmoothScroll } from "@/hooks/useSmoothScroll"

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const viewport = { once: true, margin: "-80px" } as const;

const EARNINGS_POINTS = [
  "20% of every payment, automatically attributed to you",
  "Recurring for up to 12 monthly renewals per customer",
  "Refund-protected with a 30-day maturity window",
  "Withdraw from $50 via PayPal, Wise, or bank transfer",
];

export default function AffiliateProgramContent() {
  useSmoothScroll();

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
            <Repeat className="h-3.5 w-3.5" /> 20% recurring commission
          </motion.span>
          <motion.h1
            variants={fadeUp}
            className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl"
          >
            Use, promote and{" "}
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-indigo-400">
              Earn
            </span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-400"
          >
            Refer creators to Creator AI and earn <strong>20% recurring commission</strong> on
            every subscription, for up to 12 months per customer. It&apos;s free to join and
            takes less than a minute to start.
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
                Start earning, it&apos;s free <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/dashboard/affiliate"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                Open Affiliate Hub
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
              Three steps from sign-up to your first payout.
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

      {/* Earnings example */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={viewport}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              What you actually earn
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Commission is paid on every successful payment, not just the first one. Because
              Creator AI is a subscription, your earnings compound as your referrals stay.
            </p>
            <motion.ul
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={viewport}
              className="mt-6 space-y-3"
            >
              {EARNINGS_POINTS.map((line) => (
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
              Refer <strong>10 creators</strong> to the Creator plan ($24/mo):
            </p>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Per customer / month</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">$4.80</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">10 customers / month</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">$48.00</span>
              </div>
              <div className="flex items-center justify-between border-t border-purple-200 dark:border-purple-900/50 pt-3">
                <span className="text-slate-600 dark:text-slate-400">Over 12 months</span>
                <span className="text-lg font-bold text-purple-700 dark:text-purple-300">$576.00</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Illustrative figures based on the $24/month Creator plan and a 20% recurring rate.
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
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewport}
        >
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Ready to start earning?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-400">
            Create your free account and grab your affiliate link in under a minute.
          </p>
          <div className="mt-8 flex justify-center">
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-7 py-3 text-sm font-semibold text-white shadow-sm shadow-purple-600/20 transition-colors hover:bg-purple-700"
              >
                Join the affiliate program <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
