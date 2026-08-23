import {
  Repeat,
  Hourglass,
  PiggyBank,
  TrendingUp,
  Share2,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const PAGE_PATH = "/affiliate-program";

export const PAGE_TITLE = "Use, promote and Earn | Creator AI Affiliate Program (20% Recurring)";

export const PAGE_DESCRIPTION =
  "Join the Creator AI affiliate program and earn 20% recurring commission on every subscription you refer, for up to 12 months per customer. Share a tracking link or a promo code that discounts your audience, get a month of Creator free, and withdraw from $50 via PayPal, Wise, or bank transfer.";

export const FAQ: { question: string; answer: string }[] = [
  {
    question: "How much can I earn with the Creator AI affiliate program?",
    answer:
      "You earn 20% recurring commission on every payment made by customers you refer. For example, a customer on the $24/month Creator plan earns you $4.80 every month they stay subscribed, for up to 12 billing cycles.",
  },
  {
    question: "Is the commission recurring?",
    answer:
      "Yes. As long as a referred customer keeps their subscription active, you earn commission on each successful monthly renewal, up to a maximum of 12 payments per customer.",
  },
  {
    question: "How and when do I get paid?",
    answer:
      "Commissions are held as 'pending' for 30 days to account for refunds, then mature into your available balance. Once your available balance reaches $50, you can request a withdrawal via PayPal, Wise, or bank transfer from your Affiliate Hub.",
  },
  {
    question: "Does it cost anything to join?",
    answer:
      "No. The Creator AI affiliate program is completely free to join. Create a free account, open the Affiliate Hub, and generate your tracking link in seconds.",
  },
  {
    question: "How are referrals tracked?",
    answer:
      "Each affiliate gets a unique link (trycreatorai.com/?ref=YOURCODE). When someone signs up through your link and subscribes to a paid plan, the sale is automatically attributed to you. The referral is remembered in the visitor's browser for 30 days, so they don't have to buy on the same visit.",
  },
  {
    question: "What is a promo code and how do I get one?",
    answer:
      "A promo code is a discount our team issues to you and ties to your account. Your audience gets money off, and you still earn your commission on the sale. Codes are issued at our discretion, usually to affiliates who are actively promoting; any code assigned to you appears in your Affiliate Hub.",
  },
  {
    question: "How does the promo code discount work at checkout?",
    answer:
      "Share the code itself, or the link version (trycreatorai.com/?promo=YOURCODE) which applies the discount automatically at checkout so nobody has to remember to type it. Unless stated otherwise on the code, the discount applies to the buyer's first payment — your commission still runs across their renewals, up to 12 payments.",
  },
  {
    question: "Do I get anything on Creator AI itself for being an affiliate?",
    answer:
      "Yes. Active affiliates get one month of Creator membership free, granted by our team once your first referred payment matures. It's one per affiliate account and can't be exchanged for cash or credit.",
  },
  {
    question: "What if someone uses my promo code but arrived on another affiliate's link?",
    answer:
      "A sale is credited to one affiliate. If a buyer has both a stored referral link and a redeemed promo code, the promo code wins, because that's the code that actually discounted the order.",
  },
  {
    question: "What happens if a referred customer asks for a refund?",
    answer:
      "If a referred order is refunded, the related commission is automatically reversed. This is why commissions are held for 30 days before becoming available to withdraw.",
  },
];

export const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: UserPlus,
    title: "Create a free account",
    text: "Sign up for Creator AI, no cost, no approval wait. Your Affiliate Hub is available the moment you log in.",
  },
  {
    icon: Share2,
    title: "Share your link or promo code",
    text: "Generate a unique tracking link, or share a promo code issued to you — it discounts your audience and applies itself at checkout.",
  },
  {
    icon: Wallet,
    title: "Earn & withdraw",
    text: "Earn 20% on every referred payment. Once $50 has matured, withdraw via PayPal, Wise, or bank transfer.",
  },
];

export const HIGHLIGHTS: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
}[] = [
  { icon: TrendingUp, label: "Commission", value: "20%", sub: "of every payment" },
  { icon: Repeat, label: "Recurring", value: "Up to 12 mo", sub: "per customer" },
  { icon: Hourglass, label: "Holding period", value: "30 days", sub: "refund protection" },
  { icon: PiggyBank, label: "Minimum payout", value: "$50", sub: "PayPal · Wise · bank" },
];
