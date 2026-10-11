// Canonical marketing presentation of the pricing plans. Used by the landing
// PricingSection and the /pricing page so copy stays consistent. The billing
// dashboard (and checkout) are driven by the `plans` table in Supabase, keep
// the names, prices and credit counts here in sync with the
// 20260619000000_pricing_plans_rebuild.sql migration.

import { VIDEO_GENERATION_PLANS } from "@repo/validation";

export interface MarketingPlan {
  /** Display slug (not the DB uuid). */
  id: string;
  name: string;
  /** Monthly price in USD. */
  priceMonthly: number;
  /** Per-month price when billed annually, or null if monthly-only. */
  priceAnnualMonthly: number | null;
  /** Monthly credit allowance. */
  credits: number;
  /** One short reason to choose this plan. */
  tagline: string;
  /**
   * Name of the plan this one builds on. The card renders "Everything in X, plus:" and
   * `features` lists ONLY what this tier adds, so no bullet is repeated down the ladder.
   * Omitted on Starter, which is the baseline every other plan inherits.
   */
  inheritsFrom?: string;
  features: string[];
  popular?: boolean;
  /** Grouping for layout: consumer creators vs. studios/agencies. */
  group: "free" | "consumer" | "studio";
}

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 0,
    priceAnnualMonthly: 0,
    credits: 500,
    tagline: "Best for trying Creator AI risk-free, no card.",
    features: [
      "500 credits every month",
      "Build AI memory on your own voice",
      "Scripts & Story Builder",
      "1 video idea and 1 thumbnail per run",
      "Subtitles in 70+ languages",
      "Dubbing in 90+ languages",
    ],
    group: "free",
  },
  {
    id: "creator",
    name: "Creator",
    priceMonthly: 24,
    priceAnnualMonthly: 19,
    credits: 3000,
    tagline: "Best for weekly creators who want a steady flow of scripts, thumbnails and ideas.",
    inheritsFrom: "Starter",
    features: [
      "3,000 credits every month",
      "Up to 3 video ideas per run",
      "Idea comparison matrix",
      "3 thumbnail variations for A/B testing",
    ],
    popular: true,
    group: "consumer",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 49,
    priceAnnualMonthly: 39,
    credits: 8000,
    tagline: "Best for daily uploaders and growing channels publishing at full speed.",
    inheritsFrom: "Creator",
    features: [
      "8,000 credits every month",
      "Up to 10 video ideas per run",
      "AI video generation",
      "Priority generation speed",
    ],
    group: "consumer",
  },
  {
    id: "business",
    name: "Business",
    priceMonthly: 299,
    priceAnnualMonthly: null,
    credits: 50000,
    tagline: "Best for studios and multi-channel teams producing content at scale.",
    inheritsFrom: "Pro",
    features: [
      "50,000 credits every month",
      "Built for studios & teams",
      "Highest generation throughput",
      "Priority support",
    ],
    group: "studio",
  },
  {
    id: "scale",
    name: "Scale",
    priceMonthly: 599,
    priceAnnualMonthly: null,
    credits: 100000,
    tagline: "Best for agencies and networks running high-volume content operations.",
    inheritsFrom: "Business",
    features: [
      "100,000 credits every month",
      "Built for agencies & networks",
      "Maximum generation throughput",
    ],
    group: "studio",
  },
];

/**
 * Rows of the /pricing comparison table. `plans` limits a check mark to those plan ids
 * (omitted means every plan); `values` shows text per plan id instead of a check.
 */
export const ALL_FEATURES: { name: string; plans?: readonly string[]; values?: Record<string, string> }[] = [
  { name: "AI voice & style memory" },
  { name: "Video ideas per run", values: { starter: "1", creator: "Up to 3", pro: "Up to 10", business: "Up to 10", scale: "Up to 10" } },
  { name: "Idea comparison matrix", plans: ["creator", "pro", "business", "scale"] },
  { name: "Script writing" },
  { name: "Story Builder with retention score" },
  { name: "Thumbnail generation", values: { starter: "1 per run", creator: "3 variations", pro: "3 variations", business: "3 variations", scale: "3 variations" } },
  { name: "Subtitle generation & export" },
  { name: "Subtitles in 70+ languages" },
  { name: "Dubbing in 90+ languages" },
  { name: "Video generation", plans: VIDEO_GENERATION_PLANS },
  { name: "Referral & affiliate programs" },
];
