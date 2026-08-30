import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { Compass, Gauge, Layers, Mic, Timer, Wand2 } from "lucide-react";
import SearchIcon from "@/components/dashboard/sidebar/icons/SearchIcon";
import FileTextIcon from "@/components/dashboard/sidebar/icons/FileTextIcon";

/**
 * The public, no-signup tools at /tools.
 *
 * One entry per tool drives everything: the hub page, the tool page's copy and
 * headings, its metadata, its JSON-LD, the sitemap, and the cross-links from the
 * blog. Adding a tool means adding an object here plus a route that renders
 * ToolPageShell with its widget, no SEO wiring to remember.
 *
 * Every tool page targets a TRANSACTIONAL keyword ("...generator"), while the
 * blog posts linked from `relatedPosts` target the INFORMATIONAL versions of the
 * same topic. That split is deliberate: two pages chasing one intent would
 * cannibalize each other (see .claude/skills/blog-post-seo, STEP 0).
 */

export interface ToolStep {
  title: string;
  description: string;
}

export interface ToolSection {
  heading: string;
  body: string[];
}

export interface ToolFaq {
  question: string;
  answer: string;
}

/** The three benefit cards directly under the tool, before the long-form body. */
export interface ToolBenefit {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface FreeTool {
  slug: string;
  /** Nav/hub label, short. */
  name: string;
  /** The icon this tool's feature uses in the dashboard sidebar, so the tool
   *  and the paid feature it samples read as the same thing. */
  icon: ComponentType<{ className: string }>;
  /** The ONE transactional phrase this page is optimized to rank for. */
  focusKeyword: string;
  /** Supporting long-tail terms. */
  keywords: string[];
  seoTitle: string;
  /** Kept under 155 chars, same ceiling the blog enforces. */
  seoDescription: string;
  /** Page H1, contains the focus keyword. */
  h1: string;
  /** One-line promise under the H1. */
  subhead: string;
  /** Hub card blurb. */
  cardDescription: string;
  /** Lead paragraph. AEO: answers the query in the first sentence. */
  answerSummary: string;
  steps: ToolStep[];
  /** Long-form body sections, the part that actually ranks. */
  sections: ToolSection[];
  /** Rendered as cards under the generator, the "why this one" pitch. */
  benefits: ToolBenefit[];
  useCases: { title: string; description: string }[];
  faqs: ToolFaq[];
  /** Related blog posts by slug, rendered as internal links. */
  relatedPosts: { slug: string; title: string }[];
  /** The paid feature this tool is the free sample of. */
  upgrade: { featureAnchor: string; label: string; blurb: string };
}

const SIGNUP_BENEFITS = [
  "500 free credits every month, no card",
  "Train the AI on your own channel so output sounds like you",
  "Scripts, ideas, thumbnails, subtitles, story blueprints and dubbing in one place",
  "Save, edit and export everything you generate",
];

export const FREE_TOOL_SIGNUP_BENEFITS = SIGNUP_BENEFITS;

export const FREE_TOOLS: FreeTool[] = [
  {
    slug: "youtube-video-ideas-generator",
    name: "YouTube Video Ideas Generator",
    icon: SearchIcon,
    focusKeyword: "youtube video ideas generator",
    keywords: [
      "free youtube video idea generator",
      "youtube content idea generator",
      "video topic generator for youtube",
      "youtube video ideas for beginners",
      "ai video idea generator",
    ],
    seoTitle: "Free YouTube Video Ideas Generator 2026: No Signup Needed",
    seoDescription:
      "Free YouTube video ideas generator: get a titled idea with a hook, format, keywords and talking points in seconds. No signup for your first idea.",
    h1: "Free YouTube Video Ideas Generator",
    subhead:
      "Type your niche. Get one fully-formed video idea (title, hook, format, keywords and talking points) in about ten seconds.",
    cardDescription:
      "Turn a niche into a complete video concept: title variations, a 15-second hook, the right format, and the points that structure the video.",
    answerSummary:
      "A YouTube video ideas generator turns a topic or niche into a complete video concept instead of a bare list of titles. This one gives you a primary title plus two variations, the angle that makes it different from what already exists, a specific first-15-seconds hook, the format that suits it, target keywords, and the talking points that structure the video. Your first idea is free and needs no account.",
    steps: [
      {
        title: "Describe your niche",
        description:
          "One line is enough: \"home espresso for beginners\", \"solo travel in Japan\", \"React performance for junior devs\". The narrower you go, the less generic the idea.",
      },
      {
        title: "Add who it's for (optional)",
        description:
          "Naming the audience changes the angle more than any other input. \"People who just bought their first machine\" produces a very different video to \"baristas going pro\".",
      },
      {
        title: "Generate and film",
        description:
          "You get a title, two alternatives, the unique angle, a hook, the suggested format, keywords and 5-7 talking points. That is enough to start filming without a script.",
      },
    ],
    sections: [
      {
        heading: "Why most YouTube video idea generators are useless",
        body: [
          "Type a niche into most free tools and you get twenty titles. They rhyme, they all start with \"10 Things\", and not one of them tells you what the video actually *is*. A title is not an idea. You still have to work out the angle, the opening, the structure and whether anyone is searching for it.",
          "The gap between \"a title\" and \"a video you can film\" is where creators stall. This **youtube video ideas generator** closes that gap by returning the whole concept: the angle that makes it different from the twenty videos already ranking, a hook written for the first fifteen seconds specifically, the format that fits the idea, and the points that give it a spine.",
          "It also scores the opportunity honestly. If your topic is saturated, the score comes back low and says so. A tool that tells you every idea is a 95 is not helping you, it is flattering you.",
        ],
      },
      {
        heading: "What you get from each generated idea",
        body: [
          "**A primary title plus two variations.** Three angles on the same concept, so you can pick the one that fits your channel's voice rather than accepting the first thing the model produced.",
          "**The unique angle.** One line explaining what makes this different from what is already on YouTube. This is the part that decides whether the video is worth making at all.",
          "**A first-15-seconds hook.** Not \"start with a question\" but a specific opening for this specific video. Retention is decided in the first fifteen seconds, so it is the one part of the idea worth being precise about.",
          "**The suggested format.** Tutorial, breakdown, commentary, case study, listicle, how-to, comparison or reaction. The same topic performs very differently depending on which one you pick.",
          "**Target keywords and talking points.** Three to five search terms the video should answer, and five to seven points in the order they should be covered.",
        ],
      },
      {
        heading: "How to get better ideas out of it",
        body: [
          "**Be specific about the niche.** \"Fitness\" returns something you have seen before. \"Strength training for people who sit at a desk all day\" returns something you have not.",
          "**Always fill in the audience.** It is the single highest-leverage field. The audience determines the angle, and the angle is what separates a video that gets watched from one that gets scrolled past.",
          "**Use it as a starting point, not a script.** The generated talking points are a structure. Your experience is what fills them. YouTube's own [Creator Academy](https://www.youtube.com/creators/) is blunt about this: the videos that hold attention are the ones only you could have made.",
          "**Check the opportunity score.** A low score is not a reason to abandon the idea, it is a signal that you need a sharper angle to compete on that topic.",
        ],
      },
      {
        heading: "Free tool vs. the full ideation feature",
        body: [
          "This page runs a single, anonymous version of the ideation engine inside Creator AI. It knows your topic and nothing else, which is why it produces one solid, generic-audience idea.",
          "Inside the app, the same engine connects to your YouTube channel first. It reads what your channel already publishes, which of your videos performed and why, your title patterns, your upload cadence and your content gaps. Then it analyzes live trends in your niche, filters out saturated topics, and runs a differentiation pass so no two ideas overlap with each other or with videos you have already made.",
          "That is the difference between an idea for *a* channel and an idea for *your* channel. The free Starter plan includes 500 credits a month and needs no card, so you can compare the two on your own niche.",
        ],
      },
    ],
    benefits: [
      {
        icon: Layers,
        title: "A concept, not a list of titles",
        description:
          "Most generators hand you twenty titles and leave the thinking to you. This returns the angle, the hook, the format, the keywords and the talking points, so the video is ready to film.",
      },
      {
        icon: Compass,
        title: "An angle nobody else took",
        description:
          "The model is told to find the under-served version of your topic rather than the most obvious one. That is the difference between a video that gets watched and one that gets scrolled past.",
      },
      {
        icon: Gauge,
        title: "An honest opportunity score",
        description:
          "Saturated topics score low and say so. A tool that rates every idea a 95 is flattering you, not helping you decide what to make this week.",
      },
    ],
    useCases: [
      {
        title: "Beating a blank content calendar",
        description:
          "You know you should publish this week and have nothing queued. One niche, one generated concept, and you have a video to film today.",
      },
      {
        title: "Finding an angle on a crowded topic",
        description:
          "The topic is proven but everyone has covered it. The unique-angle field is written specifically to find the version nobody made yet.",
      },
      {
        title: "Starting a new channel",
        description:
          "No back catalogue, no analytics, no idea what to make first. Describe the niche you want to own and get a concrete first video.",
      },
      {
        title: "Briefing an editor or writer",
        description:
          "Hook, format, keywords and talking points is already most of a brief. Paste it into your project tool and hand it off.",
      },
    ],
    faqs: [
      {
        question: "Is this YouTube video ideas generator really free?",
        answer:
          "Yes. Your first idea generates with no account, no card and no email. If you want more, create a free Creator AI account. The Starter plan includes 500 credits every month and still needs no card.",
      },
      {
        question: "Do I need a YouTube channel to use it?",
        answer:
          "No. The free generator only needs a topic. Connecting a channel is what unlocks personalization inside the app, where the AI learns your voice, your title patterns and your content gaps.",
      },
      {
        question: "Are the generated ideas unique?",
        answer:
          "Each generation is fresh, and the model is explicitly instructed to find an under-served angle rather than the most obvious video on the topic. It is not checking against every video on YouTube, so treat the opportunity score as guidance and search the title yourself before you commit.",
      },
      {
        question: "Can I use these ideas commercially?",
        answer:
          "Yes. Anything you generate is yours to use on your channel, in client work, or anywhere else. There is no attribution requirement.",
      },
      {
        question: "What makes this different from asking ChatGPT for video ideas?",
        answer:
          "Structure and specificity. A general chatbot returns a list of titles unless you spend the prompt engineering to get more. This returns a fixed, complete concept every time: angle, hook, format, keywords, talking points and an honest opportunity score. That is because it is running the same prompt spine as Creator AI's ideation feature.",
      },
      {
        question: "How many free ideas can I generate?",
        answer:
          "One per visit without an account. After that you will be asked to create a free account, which comes with 500 monthly credits and access to every other tool, including script writing, thumbnails, subtitles and dubbing.",
      },
    ],
    relatedPosts: [
      {
        slug: "youtube-video-ideation-system-for-youtube-creators-2026",
        title: "The YouTube Video Ideation System That Ends Creative Block",
      },
      {
        slug: "how-to-find-trending-youtube-video-topics-2026",
        title: "How to Find Trending YouTube Video Topics in 2026",
      },
      {
        slug: "how-to-build-a-youtube-content-calendar-that-survives-2026",
        title: "How to Build a YouTube Content Calendar That Survives",
      },
    ],
    upgrade: {
      featureAnchor: "/features#ideation",
      label: "See the full ideation feature",
      blurb:
        "Trend analysis, channel-fit scoring, saturation filtering and up to 20 differentiated ideas per run.",
    },
  },

  {
    slug: "youtube-script-generator",
    name: "YouTube Script Generator",
    icon: FileTextIcon,
    focusKeyword: "youtube script generator",
    keywords: [
      "free youtube script generator",
      "ai script writer for youtube",
      "video script generator no signup",
      "youtube script template",
      "write youtube script with ai",
    ],
    seoTitle: "Free YouTube Script Generator 2026: Full Script, No Signup",
    seoDescription:
      "Free YouTube script generator: a complete, ready-to-record script with a hook, sections and a CTA in under a minute. First script needs no signup.",
    h1: "Free YouTube Script Generator",
    subhead:
      "A complete script (hook, sections, transitions and a call-to-action) written to be read aloud on camera. Your first one needs no account.",
    cardDescription:
      "Turn a topic into a full script you can film from: opens with a real hook, structured in sections, timed to the length you pick.",
    answerSummary:
      "A YouTube script generator turns a video topic into a complete, ready-to-record script rather than an outline. This one writes the hook, the sections, the transitions and the closing call-to-action, paced to the duration you choose and written in spoken rhythm so it reads naturally on camera. Pick a tone, pick a length, and your first script is free with no account.",
    steps: [
      {
        title: "Say what the video is about",
        description:
          "A sentence beats a keyword. \"Why your espresso tastes sour and the three things to change\" gives the model far more to work with than \"espresso\".",
      },
      {
        title: "Pick a tone and a length",
        description:
          "Conversational, educational, motivational, funny or serious, and anywhere from one to five minutes. The script is paced to the duration, not padded to it.",
      },
      {
        title: "Read it straight to camera",
        description:
          "You get a titled script in sections, opening with a hook that earns the first fifteen seconds and closing on a call-to-action. Edit the bits that aren't you and film.",
      },
    ],
    sections: [
      {
        heading: "What this YouTube script generator actually writes",
        body: [
          "Most free script tools return an outline with the word \"script\" on it: three bullet points, a suggestion to \"introduce yourself\", and a note that says [add your content here]. You still have to write the video.",
          "This **youtube script generator** returns the finished thing. A title, a hook written for the opening fifteen seconds, body sections with real transitions between them, and a closing call-to-action. It is written to be spoken rather than read: short sentences, spoken rhythm, and no stage directions to strip out before you can film.",
          "It is also paced honestly. Pick three minutes and you get roughly 450 words, because that is what three minutes of natural speech is. A script that claims to be five minutes and runs ninety seconds on camera is worse than no script.",
        ],
      },
      {
        heading: "Why the hook is the part that matters",
        body: [
          "YouTube's own [Creator Insider](https://www.youtube.com/@CreatorInsider) team and every retention study point at the same window: the opening seconds decide whether the video is watched. A script that opens with \"Hey guys, welcome back to the channel\" has spent that window on nothing.",
          "So the hook is generated as its own deliberate thing, specific to your topic rather than a template. No channel-intro throat-clearing, no \"in today's video we're going to be talking about\", no restating the title back at the viewer.",
          "If you want to go deeper on this, we broke down the patterns that work in [how to write YouTube hooks that stop the scroll](/blog/how-to-write-youtube-hooks-that-stop-the-scroll).",
        ],
      },
      {
        heading: "How to get a script that sounds like you",
        body: [
          "**Give it context, not just a topic.** The single biggest quality jump comes from writing your prompt as a sentence with a point of view. \"Why beginners overpay for their first camera and what to buy instead\" is a video. \"Camera buying guide\" is a category.",
          "**Match the tone to your actual delivery.** Picking \"funny\" when you present dry and factual produces a script you will fight the whole way through. Pick the one that sounds like a normal day on your channel.",
          "**Rewrite the first line yourself.** Even a good generated hook is a starting point. Your version of it will always land better, because you know what your audience has already heard from you.",
          "**Cut, don't add.** Generated scripts run slightly long by design. Deleting is faster than writing, and what survives the cut is usually the good part.",
        ],
      },
      {
        heading: "Free script vs. scripts in your own voice",
        body: [
          "This page runs one anonymous, single-shot version of Creator AI's script engine. It knows your topic, your tone and your target length, and nothing about you. That produces a good generic script, which is exactly what a free sample should be.",
          "The paid feature starts somewhere else entirely. It reads your existing videos through AI Studio and builds a style profile: your tone, vocabulary level, pacing, recurring themes, humour and narrative structure. Every script after that is generated against that profile, so it comes out sounding like your channel instead of like an AI.",
          "It also does the things a one-shot tool cannot: longer videos, five languages, storytelling mode, timestamps, uploaded reference files, and scripts generated directly from an idea you saved in ideation. The free Starter plan includes 500 credits a month with no card, which is enough to train the AI and feel the difference.",
        ],
      },
    ],
    benefits: [
      {
        icon: Wand2,
        title: "A finished script, not an outline",
        description:
          "No bullet points, no \"introduce yourself here\", no [add your content]. A title, a hook, body sections with real transitions, and a closing call to action.",
      },
      {
        icon: Mic,
        title: "Written to be spoken",
        description:
          "Short sentences and spoken rhythm, with no stage directions to strip out. You can read it straight to camera instead of rewriting it into something sayable.",
      },
      {
        icon: Timer,
        title: "Paced to the length you pick",
        description:
          "Three minutes means roughly 450 words, because that is what three minutes of natural speech is. A script that claims five minutes and runs ninety seconds is worse than none.",
      },
    ],
    useCases: [
      {
        title: "Filming today with nothing written",
        description:
          "The camera is set up and the doc is blank. A minute here gets you something to read instead of another day of not publishing.",
      },
      {
        title: "Getting past the first line",
        description:
          "Most script paralysis is the opening. Generate one, hate it, rewrite it. That is still faster than staring at the cursor.",
      },
      {
        title: "Testing a topic before committing",
        description:
          "Seeing a topic as a full script tells you very quickly whether there are actually eight minutes in it.",
      },
      {
        title: "Scripting a Short",
        description:
          "Set it to sixty seconds and the whole script has to earn its place. Good discipline, and a fast way to batch a week of Shorts.",
      },
    ],
    faqs: [
      {
        question: "Is this YouTube script generator free?",
        answer:
          "Yes. Your first script generates with no account, no card and no email. After that, a free Creator AI account gives you 500 credits every month, still with no card required.",
      },
      {
        question: "How long can the free script be?",
        answer:
          "Between one and five minutes. Longer scripts, multiple languages, storytelling mode, timestamps and reference files are part of the full script feature inside the app.",
      },
      {
        question: "Will the script sound like me?",
        answer:
          "Not from this page. It has no way to know what you sound like. It writes a clean, well-structured generic script. Sounding like you requires training the AI on your existing videos in AI Studio, which is what the personalized script feature does.",
      },
      {
        question: "Do I own the scripts I generate?",
        answer:
          "Yes. Anything you generate is yours, including commercially. No attribution, no licensing, no restrictions on using it in monetized videos.",
      },
      {
        question: "Can I use this for YouTube Shorts and TikTok?",
        answer:
          "Yes. Set the duration to sixty seconds and the script is structured for a short-form video: a hard hook, one idea, and a fast close. It works the same for Shorts, Reels and TikTok.",
      },
      {
        question: "Will YouTube penalize an AI-written script?",
        answer:
          "No. YouTube's policies are about the content itself (whether it is original, valuable and not misleading) rather than which tools you used to make it. A script you have edited, delivered and made your own is your content.",
      },
    ],
    relatedPosts: [
      {
        slug: "youtube-scripts-that-keep-viewers-watching",
        title: "How to Write YouTube Scripts That Keep Viewers Watching",
      },
      {
        slug: "how-to-write-youtube-hooks-that-stop-the-scroll",
        title: "How to Write YouTube Hooks That Stop the Scroll",
      },
      {
        slug: "best-free-ai-script-generator-tools-for-youtube-videos-2026",
        title: "The Best Free AI Script Generator Tools for YouTube",
      },
    ],
    upgrade: {
      featureAnchor: "/features#scripts",
      label: "See the full script feature",
      blurb:
        "Scripts in your own voice, five languages, any length, storytelling mode, timestamps and reference files.",
    },
  },
];

export function getFreeTool(slug: string): FreeTool | undefined {
  return FREE_TOOLS.find((tool) => tool.slug === slug);
}
