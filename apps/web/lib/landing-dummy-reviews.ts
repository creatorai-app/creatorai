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
      "I started a second channel without burning out. Scripting used to eat my whole weekend, now I get a draft that sounds like me in minutes and spend that time actually playing and filming.",
  },
  {
    id: "r2",
    name: "Priya S.",
    handle: "@priyaedu",
    subscriberLine: "Education · 180K subs",
    img: "https://avatar.vercel.sh/priya-s",
    quote:
      "I wanted more clicks without hiring a designer. Now I test a handful of thumbnails before every upload and pick the winner, my CTR went up and I never touch Photoshop.",
  },
  {
    id: "r3",
    name: "Alex R.",
    handle: "@alextech",
    subscriberLine: "Tech · 95K subs",
    img: "https://avatar.vercel.sh/alex-r",
    quote:
      "I wanted my whole workflow in one place instead of five tabs. Script, subtitles, thumbnail, it's all here, so I publish faster and finally stay consistent.",
  },
  {
    id: "r4",
    name: "Sam K.",
    handle: "@samvlogs",
    subscriberLine: "Lifestyle vlog · 310K subs",
    img: "https://avatar.vercel.sh/sam-k",
    quote:
      "The reason I stayed: it actually sounds like me. I record straight from the draft with barely any edits, so I shoot more and stress less about the blank page.",
  },
  {
    id: "r5",
    name: "Taylor L.",
    handle: "@taylorfinance",
    subscriberLine: "Finance · 75K subs",
    img: "https://avatar.vercel.sh/taylor-l",
    quote:
      "I needed people to stop clicking away in the first 30 seconds. The retention-focused structure tightened my intros and my average view duration is up, that's real growth for me.",
  },
  {
    id: "r6",
    name: "Morgan D.",
    handle: "@morganfit",
    subscriberLine: "Fitness · 220K subs",
    img: "https://avatar.vercel.sh/morgan-d",
    quote:
      "I wanted to stop scrambling every Sunday night. Now I plan a month of videos in one sitting, ideas, scripts and thumbnails together, and my uploads are finally predictable.",
  },
  {
    id: "r7",
    name: "Casey V.",
    handle: "@caseybeats",
    subscriberLine: "Music · 140K subs",
    img: "https://avatar.vercel.sh/casey-v",
    quote:
      "I always wanted to reach fans who don't speak English. AI dubbing made that a 10-minute step instead of a whole project, my international views are climbing.",
  },
  {
    id: "r8",
    name: "Riley N.",
    handle: "@rileydiy",
    subscriberLine: "DIY · 60K subs",
    img: "https://avatar.vercel.sh/riley-n",
    quote:
      "As a smaller channel I needed pro output without a team. This gives me scripts and thumbnails that don't look AI-generated, it's the upgrade that made my videos look serious.",
  },
] as const
