// Canonical marketing presentation of the pricing plans. Used by the landing
// PricingSection and the /pricing page so copy stays consistent. The billing
// dashboard (and checkout) are driven by the `plans` table in Supabase, keep
// the names, prices and credit counts here in sync with the
// 20260619000000_pricing_plans_rebuild.sql migration.

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
    tagline: "Best for trying Creator AI risk-free, every feature unlocked, no card.",
    features: [
      "500 credits every month",
      "No credit card required",
      "Train the AI on your own voice",
      "Scripts, ideas, thumbnails & subtitles",
      "Story Builder, dubbing & video generation",
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
    features: [
      "3,000 credits every month",
      "Every feature included",
      "Save 20% with annual billing",
      "Voice-matched scripts in minutes",
      "Click-worthy thumbnails & subtitles",
      "Referral + affiliate rewards",
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
    features: [
      "8,000 credits every month",
      "Every feature included",
      "Save 20% with annual billing",
      "Priority generation speed",
      "All AI tools, fully unlocked",
      "Referral + affiliate rewards",
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
    features: [
      "50,000 credits every month",
      "Every feature included",
      "Built for studios & teams",
      "Highest generation throughput",
      "All AI tools, fully unlocked",
      "Priority support",
    ],
    group: "studio",
  },
  {
    id: "scale",
    name: "Scale",
    priceMonthly: 599,
    priceAnnualMonthly: null,
    credits: 150000,
    tagline: "Best for agencies and networks running high-volume content operations.",
    features: [
      "150,000 credits every month",
      "Every feature included",
      "Built for agencies & networks",
      "Maximum generation throughput",
      "All AI tools, fully unlocked",
      "Priority support",
    ],
    group: "studio",
  },
];

/** Every feature is available on every plan, listed once for comparison UIs. */
export const ALL_FEATURES: string[] = [
  "AI voice & style training",
  "Video idea generation",
  "Script writing",
  "Story Builder with retention score",
  "Thumbnail generation",
  "Subtitle generation & export",
  "Multi-language support",
  "Audio dubbing",
  "Video generation",
  "Course Builder",
  "Referral & affiliate programs",
];
