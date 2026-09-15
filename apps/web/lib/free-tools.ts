import type { LucideIcon } from "lucide-react";
import { Compass, Gauge, Layers, Mic, Timer, Wand2 } from "lucide-react";
import type { ContentFaq, ContentSection, ContentStep } from "./content-shapes";

/**
 * The public, no-signup tools at /tools.
 *
 * One entry per tool drives everything: the hub page, the tool page's copy and
 * headings, its metadata, its JSON-LD, the sitemap, and the cross-links from the
 * blog. Adding a tool means adding an object here plus a route that renders
 * ToolPageShell with its widget, no SEO wiring to remember.
 *
 * Data only, no React components: scripts/generate-llms.mts imports this from
 * plain node, which resolves neither the "@/" alias nor JSX. The hub page owns
 * the per-tool icon (see app/tools/page.tsx), which is the only place one is
 * rendered.
 *
 * Every tool page targets a TRANSACTIONAL keyword ("...generator"), while the
 * blog posts linked from `relatedPosts` target the INFORMATIONAL versions of the
 * same topic. That split is deliberate: two pages chasing one intent would
 * cannibalize each other (see .claude/skills/blog-post-seo, STEP 0).
 */

// Shared with the /features landing pages, so the shapes live in one neutral
// module. The Tool* names stay as aliases: every existing import of them keeps
// working, and a tool page still reads as if it owns its own types.
export type ToolStep = ContentStep;
export type ToolSection = ContentSection;
export type ToolFaq = ContentFaq;

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
  /** Label for the quiet "connect your channel" link under the generator. */
  connectLabel: string;
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
    slug: "free-youtube-video-ideas-generator",
    name: "YouTube Video Ideas Generator",
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
    connectLabel: "Connect your channel for personalized ideas",
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
    slug: "free-youtube-script-generator",
    name: "YouTube Script Generator",
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
    connectLabel: "Connect your channel for scripts in your own voice",
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

  {
    slug: "free-youtube-story-structure-generator",
    name: "YouTube Story Structure Generator",
    focusKeyword: "youtube story structure generator",
    keywords: [
      "free video outline generator",
      "youtube video structure template",
      "retention score for youtube videos",
      "video hook and escalation planner",
      "story blueprint for youtube",
    ],
    seoTitle: "Free YouTube Story Structure Generator 2026: Plan Retention",
    seoDescription:
      "Free YouTube story structure generator: a hook, escalation segments, a climax and a retention score before you film. First blueprint needs no signup.",
    h1: "Free YouTube Story Structure Generator",
    subhead:
      "A modular blueprint for your next video: the hook, the segments that escalate, the climax, and a retention score that says where viewers would leave. Your first one needs no account.",
    cardDescription:
      "Turn a topic into a beat-by-beat video structure: a 15-second hook, escalating segments with their own micro-hooks, and an honest retention score.",
    answerSummary:
      "A YouTube story structure generator turns a video topic into an ordered plan rather than a script: an opening hook with a promise and stakes, three to five escalation segments that each re-earn attention, a climax, a resolution, and a retention score that predicts where viewers drop off. This one builds the full blueprint from one sentence, and your first blueprint is free with no account.",
    steps: [
      {
        title: "Say what the video is about",
        description:
          "One sentence with a point of view. \"Why your espresso tastes sour and the three things to change\" gives the model a promise to structure around; \"espresso\" does not.",
      },
      {
        title: "Pick the shape",
        description:
          "Length, structure template (tutorial, case study, commentary, personal story and four more) and story mode. The same topic produces a very different outline as a documentary than as a high-energy breakdown.",
      },
      {
        title: "Film against the beats",
        description:
          "You get the hook, the context setup, the escalation segments with their transitions, the climax, the resolution and a retention score. That is a shot list, not a mood board.",
      },
    ],
    sections: [
      {
        heading: "Why an outline is not a story structure",
        body: [
          "Most video outlines are a list of the things you plan to say, in the order you thought of them. That is a table of contents. It tells you what is in the video and nothing about whether anyone stays for it.",
          "A structure is different: it is a plan for *attention*. Where the curiosity gap opens, where it closes, which segment re-hooks a viewer who was about to leave, and what the payoff is that justifies the promise you made in the first fifteen seconds. This **youtube story structure generator** builds that layer, because it is the one that decides retention.",
          "YouTube is explicit that ranking depends on how well the title, description and video content match a search, *and* on which videos drive engagement for it. Structure is the half of that sentence nobody plans. See [YouTube's own search and discovery documentation](https://support.google.com/youtube/answer/141805).",
        ],
      },
      {
        heading: "What each generated blueprint contains",
        body: [
          "**A hook with a promise and stakes.** Not \"open with a question\", but the exact curiosity statement, the promise the video is making, what is at risk if the viewer clicks away, a suggested opening line and what should be on screen for the first fifteen seconds.",
          "**Context setup.** The problem, why it matters now, and the minimum background a new viewer needs before the first real point lands.",
          "**Three to five escalation segments.** Each has its own micro-hook, the insight it delivers, an estimated duration, and the tension it hands to the next segment. This is what stops a video sagging in the middle.",
          "**A climax and a resolution.** The biggest insight, the counter-intuitive turn, then closing the loop you opened at the start and a soft call-to-action that fits the narrative rather than interrupting it.",
          "**A retention score.** An honest 0-10 prediction with per-section scores for curiosity density, emotional shift and information spike, plus the drop-risk rating. A section that scores badly is telling you to rewrite it before you film it, which is the cheapest moment to find out.",
        ],
      },
      {
        heading: "How to get a better blueprint out of it",
        body: [
          "**Name the audience level.** \"Beginner\" and \"advanced\" produce genuinely different escalation orders, because the amount of setup a viewer needs before the interesting part changes everything about pacing.",
          "**Pick the structure template deliberately.** A topic framed as a case study escalates through investigation and findings; the same topic as a listicle escalates through ranked, standalone items. If you pick the wrong one, the blueprint says so and names a better fit.",
          "**Be honest about the length.** The timestamps are paced to the duration you choose. Asking for a 30-minute structure and filming eight minutes gives you an outline with four segments you will cut.",
          "**Read the low-scoring section first.** The value of a retention score is not the number at the top, it is the one section scoring 4 while everything else scores 8.",
        ],
      },
      {
        heading: "What the free version leaves out",
        body: [
          "This page runs a single, anonymous version of the story builder inside Creator AI. It knows your topic and the shape you picked, which is why the blueprint is solid and generic.",
          "Inside the app, the same engine reads your channel first: your tone, your pacing, how long your segments usually run, how often you use humour, your ratio of direct address to storytelling, and the structures your best videos already used. The blueprint is then built to be filmable *by you* rather than by a generic presenter.",
          "It also links to ideation, so a scored idea becomes a structure without retyping it, and to script writing, so the blueprint becomes a full script in your voice. The free Starter plan includes 500 credits a month and needs no card.",
        ],
      },
    ],
    connectLabel: "Connect your channel for blueprints built around your pacing",
    benefits: [
      {
        icon: Timer,
        title: "A retention score before you film",
        description:
          "Per-section curiosity, emotional shift and information density, with a drop-risk rating. Finding the weak segment in a document costs minutes; finding it in the analytics costs the video.",
      },
      {
        icon: Layers,
        title: "Segments that stand on their own",
        description:
          "Each escalation segment gets its own micro-hook and a transition that hands tension to the next one. That is also what makes a long video clippable later.",
      },
      {
        icon: Wand2,
        title: "Structure, not a mood board",
        description:
          "Exact opening lines, estimated durations, where the CTAs go and why. Specific enough to film from, which is the whole difference between a plan and an intention.",
      },
    ],
    useCases: [
      {
        title: "A topic you know is good but cannot shape",
        description:
          "You have the idea and the research and no sense of what order any of it goes in. The blueprint gives you the order and tells you where it will sag.",
      },
      {
        title: "Videos that lose people at ninety seconds",
        description:
          "Retention cliffs are usually a structure problem, not a delivery problem. The per-section scores point at the segment that causes it.",
      },
      {
        title: "Long-form you plan to clip",
        description:
          "Self-contained segments with their own hooks are what a clipping tool can actually find later. Structure the long video and the Shorts come free.",
      },
      {
        title: "Briefing someone else to film or edit",
        description:
          "Hook, beats, timings and CTA placement is already most of a brief. Hand it to an editor and skip the round of \"what did you mean here\".",
      },
    ],
    faqs: [
      {
        question: "Is this YouTube story structure generator really free?",
        answer:
          "Yes. Your first blueprint generates with no account, no card and no email. Exporting it needs a free account, and so does your second blueprint. The Starter plan includes 500 credits every month and still needs no card.",
      },
      {
        question: "What is the difference between this and a script generator?",
        answer:
          "A script is the words. A structure is the order and the pacing: where the hook lands, how each segment re-earns attention, where the payoff goes. Most creators who feel stuck writing are actually stuck structuring, which is why doing this first usually makes the script faster.",
      },
      {
        question: "How is the retention score calculated?",
        answer:
          "The model scores each section on curiosity density, emotional shift and information spike, then rolls those into an overall 0-10 prediction and a drop-risk rating. It is a structural estimate, not a forecast of your analytics: treat a low-scoring section as a prompt to rewrite it, not as a number to optimise.",
      },
      {
        question: "Which structure template should I pick?",
        answer:
          "Pick the one that matches how you would explain the topic out loud. If you would walk someone through steps, it is a tutorial; if you would tell them what happened to you, it is a personal story. If the model thinks you picked wrong, it names a better fit in the blueprint.",
      },
      {
        question: "Can I turn the blueprint into a script?",
        answer:
          "Yes, inside the app. Sign up and the blueprint is saved to your dashboard, where the script writer can build on it using a voice profile trained on your own videos. On this page you get the structure itself, which is the part most outlines are missing.",
      },
      {
        question: "How many free blueprints can I generate?",
        answer:
          "One per visit without an account. After that you will be asked to create a free account, which comes with 500 monthly credits and access to every other tool, including ideation, script writing, thumbnails, subtitles and dubbing.",
      },
    ],
    relatedPosts: [
      {
        slug: "youtube-video-story-structure-for-retention-2026",
        title: "YouTube Video Story Structure That Holds Retention",
      },
      {
        slug: "improve-youtube-audience-retention-watch-time",
        title: "How to Improve YouTube Audience Retention and Watch Time",
      },
      {
        slug: "how-to-write-youtube-hooks-that-stop-the-scroll",
        title: "How to Write YouTube Hooks That Stop the Scroll",
      },
    ],
    upgrade: {
      featureAnchor: "/features#story-builder",
      label: "See the full story builder",
      blurb:
        "Blueprints built around your own pacing and tone, linked to your scored ideas, and handed straight to the script writer.",
    },
  },
];

export function getFreeTool(slug: string): FreeTool | undefined {
  return FREE_TOOLS.find((tool) => tool.slug === slug);
}
