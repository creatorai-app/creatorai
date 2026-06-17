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

export const PAGE_TITLE = "Affiliate Program — Earn 20% Recurring Commission";

export const PAGE_DESCRIPTION =
  "Join the Creator AI affiliate program and earn 20% recurring commission on every subscription you refer — for up to 12 months per customer. Free to join, $50 minimum payout, paid via PayPal, Wise, or bank transfer.";

export const FAQ: { question: string; answer: string }[] = [
  {
    question: "How much can I earn with the Creator AI affiliate program?",
    answer:
      "You earn 20% recurring commission on every payment made by customers you refer. For example, a customer on the $20/month Creator+ plan earns you $4 every month they stay subscribed, for up to 12 billing cycles.",
  },
  {
    question: "Is the commission recurring?",
    answer:
      "Yes. As long as a referred customer keeps their subscription active, you earn commission on each successful monthly renewal — up to a maximum of 12 payments per customer.",
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
      "Each affiliate gets a unique link (yourdomain.com/?ref=YOURCODE). When someone signs up through your link and subscribes to a paid plan, the sale is automatically attributed to you. Admin-issued promo codes are also tracked to your account.",
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
    text: "Sign up for Creator AI — no cost, no approval wait. Your Affiliate Hub is available the moment you log in.",
  },
  {
    icon: Share2,
    title: "Share your link or promo code",
    text: "Generate a unique tracking link, or share an admin-issued promo code that gives your audience a discount.",
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
