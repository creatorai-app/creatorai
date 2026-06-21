import {
  Gift,
  Coins,
  Users,
  ShoppingBag,
  Share2,
  UserPlus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export const PAGE_PATH = "/referral-program";

export const PAGE_TITLE = "Referral Program | Give 1,000 Credits, Get 1,000 Credits";

export const PAGE_DESCRIPTION =
  "Invite fellow creators to Creator AI. When a friend you referred makes their first purchase, you both get 1,000 credits, no sign-up bonuses, no limits on how many friends you invite. Free to join.";

export const FAQ: { question: string; answer: string }[] = [
  {
    question: "How many credits do I get for a referral?",
    answer:
      "You earn 1,000 credits for every friend you refer, and your friend gets 1,000 bonus credits too. It's a win for both of you.",
  },
  {
    question: "When are the credits awarded?",
    answer:
      "Credits are awarded only when a friend you referred makes their first purchase on any paid plan. There is no sign-up bonus, the reward unlocks the moment they become a paying customer.",
  },
  {
    question: "Is there a limit on how many people I can refer?",
    answer:
      "No. You can refer as many creators as you like. Every friend who signs up through your link and makes their first purchase earns you another 1,000 credits.",
  },
  {
    question: "What can I do with referral credits?",
    answer:
      "Referral credits work exactly like your monthly credits, use them to generate scripts, ideas, thumbnails, subtitles, dubbing, story builds, and everything else Creator AI offers.",
  },
  {
    question: "How is this different from the affiliate program?",
    answer:
      "The referral program rewards you with credits to power your own content. The affiliate program pays you real cash, 20% recurring commission, when you drive subscriptions. You can take part in both at the same time.",
  },
  {
    question: "How do I share my referral link?",
    answer:
      "Open the Referrals tab in your dashboard, copy your unique referral link, and share it anywhere, your channel description, community posts, or directly with creator friends. Sign-ups through that link are automatically attributed to you.",
  },
];

export const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Share2,
    title: "Share your link",
    text: "Grab your unique referral link from the Referrals tab and send it to creator friends who'd love Creator AI.",
  },
  {
    icon: ShoppingBag,
    title: "They make their first purchase",
    text: "Your friend signs up and upgrades to any paid plan. There's no sign-up bonus, the reward is tied to a real purchase.",
  },
  {
    icon: Gift,
    title: "You both get 1,000 credits",
    text: "The moment they buy, 1,000 credits land in your account, and 1,000 bonus credits land in theirs.",
  },
];

export const HIGHLIGHTS: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
}[] = [
  { icon: Coins, label: "You earn", value: "1,000", sub: "credits per referral" },
  { icon: Gift, label: "Friend gets", value: "1,000", sub: "bonus credits" },
  { icon: ShoppingBag, label: "Unlocks on", value: "First purchase", sub: "no sign-up bonus" },
  { icon: Users, label: "Referrals", value: "Unlimited", sub: "invite everyone" },
];

export const REFERRAL_ICONS = { UserPlus, Sparkles };
