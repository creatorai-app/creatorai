"use client"

import React, { useEffect } from "react";
import * as motion from "motion/react-m";
import Link from "next/link";
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar";
import Footer from "@/components/footer";
import PricingSection from "@/components/landingPage/PricingSection";
import FAQSection from "@/components/landingPage/FAQSection";
import { SparklesCore } from "@repo/ui/sparkles";
import { MButton } from "@repo/ui/moving-border";
import { ArrowRight, Check, Zap, CreditCard, Shield } from "lucide-react";
import { useSupabase } from "@/components/supabase-provider";
import { MARKETING_PLANS, ALL_FEATURES } from "@/lib/pricing-plans";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { trackFunnel } from "@/lib/funnel";

export default function PricingPage() {
  const { user } = useSupabase()

  useSmoothScroll();

  useEffect(() => {
    trackFunnel("pricing_viewed")
  }, [])

  const billingHref = (planId: string) =>
    user
      ? `/dashboard/settings?tab=billing&plan=${planId}`
      : `/login?redirectTo=${encodeURIComponent(`/dashboard/settings?tab=billing&plan=${planId}`)}`

  return (
    <div className="flex flex-col min-h-screen">
      <LandingPageNavbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative w-full pt-32 pb-12 bg-gradient-to-b from-white to-slate-50 overflow-hidden">
          <div aria-hidden="true" className="absolute inset-0 -z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] bg-purple-100/40 rounded-full blur-3xl" />
            <SparklesCore
              background="transparent"
              minSize={0.2}
              maxSize={0.8}
              className="absolute inset-0 w-full h-full z-0"
              particleColor="#a855f7"
              particleDensity={20}
            />
          </div>
          <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-6"
            >
              <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                  Simple Pricing,
                </span>{" "}
                Powerful Results
              </h1>
              <p className="text-lg md:text-xl text-slate-600 max-w-xl mx-auto">
                Join thousands of creators who save 10+ hours every week. Start free, upgrade when you&#39;re ready.
              </p>

              <motion.div
                className="flex flex-wrap justify-center gap-6 pt-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                {[
                  { icon: Zap, text: "500 free credits/month" },
                  { icon: CreditCard, text: "No credit card required" },
                  { icon: Shield, text: "Cancel anytime" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-sm text-slate-600">
                    <Icon className="w-4 h-4 text-purple-500" />
                    <span>{text}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-16 bg-slate-50">
          <PricingSection hideHeader />
        </section>

        {/* Feature Comparison Table */}
        <section className="py-20 bg-white">
          <div className="container max-w-5xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Compare Plans
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="overflow-x-auto"
            >
              <table className="w-full border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-4 px-4 text-slate-600 font-medium"> </th>
                    {MARKETING_PLANS.map((p) => (
                      <th
                        key={p.id}
                        className={`text-center py-4 px-4 font-semibold ${p.popular ? "text-purple-600" : "text-slate-800"}`}
                      >
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-3.5 px-4 text-sm text-slate-700">Monthly price</td>
                    {MARKETING_PLANS.map((p) => (
                      <td key={p.id} className="text-center py-3.5 px-4 text-sm font-semibold text-slate-800">
                        {p.priceMonthly === 0 ? "Free" : `$${p.priceMonthly}/mo`}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    <td className="py-3.5 px-4 text-sm text-slate-700">Annual price</td>
                    {MARKETING_PLANS.map((p) => (
                      <td key={p.id} className="text-center py-3.5 px-4 text-sm text-slate-700">
                        {p.priceAnnualMonthly != null && p.priceMonthly > 0 ? `$${p.priceAnnualMonthly}/mo` : "-"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-3.5 px-4 text-sm text-slate-700">Monthly credits</td>
                    {MARKETING_PLANS.map((p) => (
                      <td key={p.id} className="text-center py-3.5 px-4 text-sm font-medium text-slate-800">
                        {p.credits.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    <td className="py-3.5 px-4 text-sm text-slate-700">Best for</td>
                    {MARKETING_PLANS.map((p) => (
                      <td key={p.id} className="text-center py-3.5 px-4 text-xs text-slate-600">
                        {p.tagline.replace(/^Best for /, "").replace(/\.$/, "")}
                      </td>
                    ))}
                  </tr>
                  {ALL_FEATURES.map((feature) => (
                    <tr key={feature} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-sm text-slate-700">{feature}</td>
                      {MARKETING_PLANS.map((p) => (
                        <td key={p.id} className="text-center py-3.5 px-4">
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </div>
        </section>

        <FAQSection />

        {/* CTA */}
        <section className="py-20 bg-slate-900 text-white">
          <motion.div
            className="container px-6 text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Start Free, Upgrade Anytime
            </h2>
            <p className="max-w-[600px] mx-auto text-slate-300 md:text-lg mb-8">
              No credit card required. Get 500 free credits every month and full access to every feature.
            </p>
            <Link href={billingHref("starter")}>
              <MButton
                size="lg"
                className="bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 hover:brightness-110 text-white shadow-md transition-all"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </MButton>
            </Link>
          </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
