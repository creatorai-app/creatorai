"use client"

import { useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { WobbleCard } from "@repo/ui/wobble-card";
import * as motion from "motion/react-m";
import { Check } from "lucide-react";
import { useSupabase } from "../supabase-provider";
import { MARKETING_PLANS, type MarketingPlan } from "@/lib/pricing-plans"
import { trackFunnel } from "@/lib/funnel"

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}
const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 14 } },
}

export default function PricingSection({ hideHeader = false }: { hideHeader?: boolean }) {
    const { user } = useSupabase()
    const [annual, setAnnual] = useState(false)

    const billingHref = (planId: string) =>
        user
            ? `/dashboard/settings?tab=billing&plan=${planId}`
            : `/login?redirectTo=${encodeURIComponent(`/dashboard/settings?tab=billing&plan=${planId}`)}`

    const consumerPlans = MARKETING_PLANS.filter((p) => p.group !== "studio")
    const studioPlans = MARKETING_PLANS.filter((p) => p.group === "studio")

    return (
        <div className="container px-4 sm:px-6 lg:px-8">
            {!hideHeader && (
                <motion.div
                    className="flex flex-col items-center text-center space-y-4 sm:space-y-6 mb-6 sm:mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                >
                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-slate-50">
                        Pricing
                    </h2>
                    <p className="max-w-xs sm:max-w-md md:max-w-lg lg:max-w-prose text-sm sm:text-base md:text-lg lg:text-xl text-slate-600 dark:text-slate-400">
                        Pick the plan that matches how much you create. Start free, upgrade only when you need more credits. Enjoy!
                    </p>
                </motion.div>
            )}

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mb-10">
                <span className={cn("text-sm font-medium", !annual ? "text-slate-900 dark:text-slate-100" : "text-slate-500")}>
                    Monthly
                </span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={annual}
                    onClick={() => setAnnual((v) => !v)}
                    className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        annual ? "bg-purple-600" : "bg-slate-300 dark:bg-slate-600"
                    )}
                >
                    <span
                        className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            annual ? "translate-x-6" : "translate-x-1"
                        )}
                    />
                </button>
                <span className={cn("text-sm font-medium", annual ? "text-slate-900 dark:text-slate-100" : "text-slate-500")}>
                    Annual
                </span>
                <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
                    Save 20%
                </span>
            </div>

            {/* Consumer plans */}
            <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
            >
                {consumerPlans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} annual={annual} href={billingHref(plan.id)} />
                ))}
            </motion.div>

            {/* Studio plans */}
            <div className="mt-14">
                <div className="text-center mb-8">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
                        Scaling a studio, team or agency?
                    </h3>
                    <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                        High-volume plans with the same all-access feature set and tens of thousands of credits.
                    </p>
                </div>
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                >
                    {studioPlans.map((plan) => (
                        <PlanCard key={plan.id} plan={plan} annual={annual} href={billingHref(plan.id)} />
                    ))}
                </motion.div>
            </div>
        </div>
    )
}

function PlanCard({ plan, annual, href }: { plan: MarketingPlan; annual: boolean; href: string }) {
    const isPopular = !!plan.popular
    const isFree = plan.priceMonthly === 0
    const showAnnual = annual && plan.priceAnnualMonthly != null
    const displayPrice = showAnnual ? plan.priceAnnualMonthly! : plan.priceMonthly

    return (
        <motion.div variants={itemVariants}>
            <WobbleCard
                className={cn(
                    "flex flex-col h-full p-6 sm:p-8 md:p-9 relative",
                    isPopular ? "bg-slate-50 dark:bg-slate-700" : "bg-white dark:bg-slate-800",
                    "border border-slate-200 dark:border-slate-700 rounded-lg shadow-md",
                    "hover:shadow-purple-500/10 dark:hover:shadow-purple-400/5 transition-shadow"
                )}
            >
                {isPopular && (
                    <div className="absolute top-0 right-0 mr-3 sm:mr-4 bg-purple-600 text-white text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1 rounded-full">
                        POPULAR
                    </div>
                )}

                <h3 className="text-lg sm:text-xl md:text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-50">
                    {plan.name}
                </h3>

                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50">
                    ${displayPrice}
                    <span className="text-sm sm:text-base font-normal text-slate-600 dark:text-slate-400">
                        /mo
                    </span>
                </div>
                <div className="h-5 mt-1 mb-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {isFree
                        ? "Free forever"
                        : showAnnual
                            ? `Billed annually ($${plan.priceAnnualMonthly! * 12}/yr)`
                            : plan.priceAnnualMonthly != null
                                ? `or $${plan.priceAnnualMonthly}/mo billed annually`
                                : "Billed monthly"}
                </div>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-5 min-h-[2.5rem]">
                    {plan.tagline}
                </p>

                <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((f, i) => (
                        <li
                            key={i}
                            className="flex items-start text-sm sm:text-base text-slate-600 dark:text-slate-400"
                        >
                            <Check className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-500 flex-shrink-0 mt-0.5" />
                            {f}
                        </li>
                    ))}
                </ul>

                <Button
                    asChild
                    className={cn(
                        "w-full text-sm sm:text-base",
                        isPopular
                            ? "bg-purple-600 hover:bg-purple-700 text-white"
                            : "border-slate-300 dark:border-slate-600 hover:border-purple-300 dark:hover:border-purple-700"
                    )}
                    variant={isPopular ? "default" : "outline"}
                >
                    <Link href={href} onClick={() => trackFunnel("plan_clicked", plan.name)}>
                        {isFree ? "Start Free" : "Get Started"}
                    </Link>
                </Button>
            </WobbleCard>
        </motion.div>
    )
}
