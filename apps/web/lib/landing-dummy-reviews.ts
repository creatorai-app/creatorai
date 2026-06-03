export type LandingDummyReview = {
  id: string
  name: string
  handle: string
  subscriberLine: string
  quote: string
  img: string
}

export const LANDING_DUMMY_REVIEWS: readonly LandingDummyReview[] = [
  {
    id: "r1",
    name: "Jordan M.",
    handle: "@jordanplays",
    subscriberLine: "Gaming · 420K subs",
    img: "https://avatar.vercel.sh/jordan-m",
    quote:
      "Full script days are gone. I get a YouTube-ready first pass in minutes — hooks and pacing baked in — and it still sounds like me.",
  },
  {
    id: "r2",
    name: "Priya S.",
    handle: "@priyaedu",
    subscriberLine: "Education · 180K subs",
    img: "https://avatar.vercel.sh/priya-s",
    quote:
      "The thumbnail generator alone paid for itself. More variants each week, no designer burnout, and more people actually click.",
  },
  {
    id: "r3",
    name: "Alex R.",
    handle: "@alextech",
    subscriberLine: "Tech · 95K subs",
    img: "https://avatar.vercel.sh/alex-r",
    quote:
      "AI subtitles and SRT export just work. I stopped duct-taping ChatGPT with three other tabs for every upload.",
  },
  {
    id: "r4",
    name: "Sam K.",
    handle: "@samvlogs",
    subscriberLine: "Lifestyle vlog · 310K subs",
    img: "https://avatar.vercel.sh/sam-k",
    quote:
      "I was skeptical about voice matching, but my scripts sound human now — not that flat AI tone. Fewer rewrites before I record.",
  },
  {
    id: "r5",
    name: "Taylor L.",
    handle: "@taylorfinance",
    subscriberLine: "Finance · 75K subs",
    img: "https://avatar.vercel.sh/taylor-l",
    quote:
      "Retention-focused structure helped me tighten intros. Average view duration is up since I stopped winging the first 30 seconds.",
  },
  {
    id: "r6",
    name: "Morgan D.",
    handle: "@morganfit",
    subscriberLine: "Fitness · 220K subs",
    img: "https://avatar.vercel.sh/morgan-d",
    quote:
      "Scripts, thumbnails, and trending topic ideas in one dashboard — I plan a month ahead instead of scrambling on Sunday night.",
  },
  {
    id: "r7",
    name: "Casey V.",
    handle: "@caseybeats",
    subscriberLine: "Music · 140K subs",
    img: "https://avatar.vercel.sh/casey-v",
    quote:
      "AI dubbing for non-English audiences used to be a whole project. Upload, generate, export — friction is basically gone.",
  },
  {
    id: "r8",
    name: "Riley N.",
    handle: "@rileydiy",
    subscriberLine: "DIY · 60K subs",
    img: "https://avatar.vercel.sh/riley-n",
    quote:
      "Snappy UI, and drafts don't read like generic chatbot output. It's part of my weekly upload ritual now.",
  },
] as const
