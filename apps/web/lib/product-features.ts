import type { LucideIcon } from "lucide-react";
import {
  Video,
  PenTool,
  Lightbulb,
  Clapperboard,
  ImageIcon,
  MessageSquare,
  BookOpen,
  BarChart3,
  Gift,
  Languages,
  Film,
} from "lucide-react";
import type { ContentFaq, ContentSection, ContentStep } from "./content-shapes";

/**
 * The canonical list of what Creator AI ships.
 *
 * Lived inline in app/features/page.tsx, which meant the /tools page had to
 * keep its own copy and the two drifted immediately: /features was missing
 * dubbing and video generation entirely even though both have shipped
 * dashboard routes. One list, imported by both, so "all the features" stays
 * true in both places.
 *
 * `id` doubles as the /features anchor, so nav dropdown links like
 * /features#dubbing resolve to a real section.
 *
 * It is also the /features/<slug> segment. `id` is the ONE identifier: the hub
 * anchor and the detail page are the same string, so the two can never point at
 * different features. Do not add a parallel `slug` field.
 *
 * Every core feature also carries the copy its detail page renders. That copy
 * targets PRODUCT intent ("ai script writing for youtube"), while the free
 * tools in lib/free-tools.ts own the TRANSACTIONAL version of the same topic
 * ("youtube script generator") and the blog owns the informational version. All
 * three chasing one phrase would cannibalize each other, so a new focusKeyword
 * here has to be checked against both of those files first.
 */

/**
 * The ~1 minute product demo at the top of a feature page.
 *
 * Video files are NOT committed: there are no .mp4s in apps/web/public and
 * there should not be, so `mp4`/`webm` are public bucket URLs. The poster is
 * small enough to live in public/.
 *
 * Note that a self-hosted file needs a `media-src` on the CSP in
 * next.config.mjs, which currently has no such directive and so falls back to
 * `default-src 'self'`.
 */
export interface FeatureDemoVideo {
  /** H.264 MP4, public URL. */
  mp4: string;
  /** WebM sibling of the same recording, offered first via <source>. */
  webm?: string;
  /** Poster frame, served from public/ so nothing shifts before playback. */
  poster: string;
  /** WebVTT track. Required, not optional: captions are an accessibility need. */
  captions: string;
  /** Runtime in seconds. VideoObject.duration (PT58S) is derived from this. */
  durationSeconds: number;
  /** ISO 8601 date the recording was published, e.g. "2026-09-09". Required:
   *  Google treats uploadDate as a required VideoObject property, and a
   *  VideoObject without one is dropped rather than warned about. */
  uploadDate: string;
  /** Plain-text transcript rendered on the page, one entry per paragraph. This
   *  is the part search and answer engines actually index. */
  transcript: string[];
}

export interface ProductFeature {
  id: string;
  title: string;
  tagline: string;
  /** Card-grid copy: one keyword-bearing sentence, kept to a similar length
   *  across every feature so cards in a row stay the same height. */
  cardDescription: string;
  description: string;
  highlights: string[];
  icon: LucideIcon;
  gradient: string;

  // -- /features/<slug> detail page ------------------------------------------
  // Required, so a feature cannot be added to CORE_FEATURES without the copy its
  // page needs. The two SimpleFeature lists below get no page and no fields.

  /** <title> and OG title. Distinct from `title`, the short nav/card label. */
  seoTitle: string;
  /** Meta description, under 155 chars — the ceiling the blog and /tools use. */
  seoDescription: string;
  /** The ONE product-intent phrase this page ranks for. Read the note on
   *  cannibalization at the top of this file before adding another. */
  focusKeyword: string;
  /** Supporting long-tail terms. */
  keywords: string[];
  /** Page H1. Carries the focus keyword. */
  h1: string;
  /** Lead paragraph. AEO: answers the query in its first sentence. */
  answerSummary: string;
  /** How it works. */
  steps: ContentStep[];
  /** Long-form body, the part that earns the ranking. */
  sections: ContentSection[];
  faqs: ContentFaq[];
  /** Undefined until the recording exists. The page must render without it. */
  demoVideo?: FeatureDemoVideo;
  /** Other CORE_FEATURES ids, rendered as internal links. */
  relatedFeatures?: string[];
  /** Blog posts by slug. `title` is link text and need not match the post's own
   *  headline, matching the convention in free-tools.ts. */
  relatedPosts?: { slug: string; title: string }[];
}

export interface SimpleFeature {
  title: string;
  description: string;
  cardDescription: string;
  icon: LucideIcon;
}

export const CORE_FEATURES: ProductFeature[] = [
  {
    id: "ai-studio",
    title: "AI Studio",
    cardDescription:
      "Train the AI on your own YouTube videos so every script matches your tone, pacing and vocabulary.",
    tagline: "Train the AI to sound like you",
    description:
      "Connect your YouTube channel and pick a few of your best videos. The AI watches them and learns your tone, vocabulary, pacing, and style. Once trained, everything it creates is personalized to you, not generic.",
    highlights: [
      "Connect your YouTube channel in one click",
      "Select 3-5 videos to train your personal AI model",
      "AI learns your speaking style, humor, and vocabulary",
      "Powers all other features with your unique voice",
    ],
    icon: Video,
    gradient: "from-purple-500 to-indigo-500",
    seoTitle: "Train AI on Your YouTube Channel | Creator AI Studio",
    seoDescription:
      "Train AI on your YouTube channel in minutes. AI Studio learns your tone, pacing and vocabulary from your own videos, then writes everything in your voice.",
    focusKeyword: "train ai on your youtube channel",
    keywords: [
      "ai trained on your own videos",
      "youtube voice profile ai",
      "ai that sounds like you",
      "personalised ai for youtube creators",
      "ai writing in your own voice",
    ],
    h1: "Train AI on Your YouTube Channel",
    answerSummary:
      "AI Studio trains Creator AI on your YouTube channel so everything it writes sounds like you rather than a generic model. You connect your channel, pick three to five videos you are happy with, and the AI studies your tone, vocabulary, pacing and structure. That trained voice profile then powers scripts, ideas, story outlines and dubbing across the rest of the product.",
    steps: [
      {
        title: "Connect your channel",
        description:
          "One click links your YouTube account. The connection is read-only: Creator AI reads your public video data and the uploads you pick, and never posts on your behalf.",
      },
      {
        title: "Pick three to five videos",
        description:
          "Choose uploads that sound the way you want to sound. Your best-performing video is not always your most characteristic one, and the AI learns from character.",
      },
      {
        title: "Generate in your own voice",
        description:
          "Training runs in the background. After it finishes, every script, idea and outline is written through your voice profile instead of a default model tone.",
      },
    ],
    sections: [
      {
        heading: "Why generic AI writes scripts that sound like nobody",
        body: [
          "Ask a general-purpose model for a YouTube script and you get the average of every script on the internet. It is competent, it is structurally fine, and it sounds like no particular person. Viewers notice inside about fifteen seconds, which is exactly the window where they decide whether to stay.",
          "The problem is not the model's writing ability, it is that a prompt is a very thin description of a voice. Tell a model to be *casual and funny* and it produces a stranger's idea of casual and funny. What it cannot do from a prompt is reproduce the specific way you open a video, the phrases you overuse, or the pacing you have settled into after two hundred uploads.",
          "**Training on your own videos closes that gap by giving the model examples instead of adjectives.** Your uploads already contain everything a description leaves out.",
        ],
      },
      {
        heading: "What AI Studio actually learns from your videos",
        body: [
          "**Vocabulary and phrasing.** The words you reach for, the ones you avoid, and the transitions you say out loud rather than the ones that only exist in writing.",
          "**Pacing and structure.** How long you spend on a hook, whether you tease the payoff or deliver it, where you place a recap. This is the part that carries retention, and it is the part a prompt cannot describe.",
          "**Tone under pressure.** How you handle a sponsor read, a correction, or a section you personally find boring. A voice profile built only from your best moments does not survive a real script.",
        ],
      },
      {
        heading: "Retraining, and when to train AI on your YouTube channel again",
        body: [
          "Channels drift. The way you presented two years ago is not the way you present now, and a voice profile pinned to old uploads slowly stops matching. Retraining on a fresher set of videos takes the same few minutes as the first run.",
          "It is also the fastest fix when output feels slightly off. Nine times out of ten the problem is the training set rather than the prompt: a profile built from three unusually formal videos keeps producing unusually formal scripts no matter what you type into the brief.",
        ],
      },
    ],
    faqs: [
      {
        question: "How many videos do I need to train the AI?",
        answer:
          "Three to five is enough. More videos do not linearly improve the profile, and a large set of inconsistent uploads produces a blurrier voice than a small set of characteristic ones.",
      },
      {
        question: "Does Creator AI get permission to post to my channel?",
        answer:
          "No. The connection is read-only. Creator AI reads your public video data and the uploads you select for training, and it never publishes, edits or comments on your behalf.",
      },
      {
        question: "What if my channel is new and I only have a few videos?",
        answer:
          "You can train on as little as one video, though the profile is thinner. Creators starting out often train on whichever videos sound closest to how they want to sound, then retrain once they have a real back catalogue.",
      },
      {
        question: "Can I retrain the AI later?",
        answer:
          "Yes, as often as you like. Retraining replaces the existing voice profile, and everything generated afterwards uses the new one.",
      },
    ],
    relatedFeatures: ["scripts", "ideation"],
    relatedPosts: [
      {
        slug: "ai-script-tool-that-learns-your-voice-from-your-videos",
        title: "Which AI Script Tools Actually Train on Your Videos",
      },
      {
        slug: "creator-ai-vs-chatgpt-for-youtube-creators",
        title: "Creator AI vs ChatGPT: Why Generic AI Falls Short for YouTube",
      },
    ],
  },
  {
    id: "scripts",
    title: "Script Writing",
    cardDescription:
      "Generate full YouTube scripts in your own voice, with a hook, real transitions and a closing call to action.",
    tagline: "Full scripts in your voice, in minutes",
    description:
      "Tell the AI what your video is about, pick a tone, add any context you want, and get a complete script that actually sounds like you. Choose your language, set the duration, and even enable storytelling mode or timestamps.",
    highlights: [
      "Generate scripts from a simple prompt",
      "Choose tone, language, and video length",
      "Add references, links, or upload files for context",
      "Enable storytelling mode and timestamps",
    ],
    icon: PenTool,
    gradient: "from-pink-500 to-rose-500",
    seoTitle: "AI Script Writing for YouTube, in Your Voice | Creator AI",
    seoDescription:
      "AI script writing for YouTube that sounds like you. Get a full script with a hook, real transitions and a closing CTA, trained on your own channel.",
    focusKeyword: "ai script writing for youtube",
    keywords: [
      "ai youtube script writer",
      "write youtube scripts with ai",
      "youtube script ai in your own voice",
      "ai scriptwriting tool for creators",
      "generate a youtube script from a prompt",
    ],
    h1: "AI Script Writing for YouTube, in Your Own Voice",
    answerSummary:
      "Creator AI turns a one-line brief into a complete YouTube script written through your trained voice profile. You get a hook built for the first fifteen seconds, sections that flow rather than restart, and a closing call to action, in the language and runtime you choose. Because the model is trained on your uploads, the draft starts close to your voice instead of needing to be rewritten into it.",
    steps: [
      {
        title: "Describe the video",
        description:
          "One sentence is enough. Add references, links or a file when the video depends on specific facts, and the script uses them instead of inventing them.",
      },
      {
        title: "Set tone, language and length",
        description:
          "Runtime drives structure more than any other input. A six-minute script and a sixteen-minute script are different shapes, not the same script padded out.",
      },
      {
        title: "Generate, then edit",
        description:
          "You get a full draft with hook, body and CTA. Storytelling mode and timestamps are toggles, so one brief can produce a narrative cut or a segmented tutorial.",
      },
    ],
    sections: [
      {
        heading: "Why a script is not just copy",
        body: [
          "Written copy is read at the reader's pace, on a page they can scan and re-read. A script is heard once, in order, by someone who can leave at any moment. Every structural decision follows from that, and it is why general-purpose writing tools produce scripts that read well and perform badly.",
          "A YouTube script has to earn each next thirty seconds. That means open loops that actually close, transitions that carry momentum instead of announcing a new topic, and a hook that promises something specific enough to be worth waiting for. **Those are retention mechanics, not style choices.**",
        ],
      },
      {
        heading: "What AI script writing for YouTube actually produces",
        body: [
          "**A hook written for the first fifteen seconds.** Not a summary of the video, a reason to stay for it.",
          "**A body with real transitions.** Sections that hand off to each other, rather than eight paragraphs that each start from a standstill.",
          "**A closing CTA in your voice.** The part most creators improvise and most script templates leave blank.",
          "**Timestamps on request**, so the description is half written by the time you finish filming.",
        ],
      },
      {
        heading: "Where the free generator ends and this begins",
        body: [
          "The [free YouTube script generator](/tools/free-youtube-script-generator) writes from your prompt alone, with no account, and the output is yours to use. It is genuinely useful for a one-off.",
          "The difference here is the voice profile. A trained account writes through [AI Studio](/features/ai-studio), so the draft arrives already sounding like your channel instead of needing a pass to make it sound like anyone at all. Across a weekly upload schedule, that pass is the actual cost.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I write scripts in a language other than English?",
        answer:
          "Yes. Pick the output language before generating. The voice profile still applies, so the script keeps your structure and pacing in the target language.",
      },
      {
        question: "How long can a generated script be?",
        answer:
          "Set a target runtime and the script is structured for it. Longer runtimes change the shape of the script, adding sections and recaps rather than stretching one outline.",
      },
      {
        question: "Can I give the AI source material to work from?",
        answer:
          "Yes. Add links, pasted references or uploaded files as context and the script draws on them, which is how you keep a factual video factual.",
      },
      {
        question: "Do I have to train the AI before writing scripts?",
        answer:
          "No, but it is the difference between a good generic script and a draft in your voice. Untrained accounts get the same structure with a default tone.",
      },
    ],
    relatedFeatures: ["ai-studio", "story-builder"],
    relatedPosts: [
      {
        slug: "youtube-scripts-that-keep-viewers-watching",
        title: "How to Write YouTube Scripts That Keep Viewers Watching",
      },
      {
        slug: "how-to-write-youtube-hooks-that-stop-the-scroll",
        title: "How to Write YouTube Hooks That Stop the Scroll",
      },
    ],
  },
  {
    id: "ideation",
    title: "Video Ideas",
    cardDescription:
      "Find trending video ideas in your niche, scored for opportunity and matched to what your channel already publishes.",
    tagline: "Never run out of video ideas",
    description:
      "Let the AI find trending topics in your niche and generate video ideas tailored to your channel. It looks at what's working, spots gaps, and suggests ideas with high potential. You can go fully automatic or focus on a specific topic.",
    highlights: [
      "AI-powered trend analysis for your niche",
      "Auto mode or manual topic focus",
      "Generate 1-5 ideas per session",
      "Opportunity scores and trend snapshots for each idea",
    ],
    icon: Lightbulb,
    gradient: "from-amber-500 to-orange-500",
    seoTitle: "AI Video Ideas for YouTube, Scored by Opportunity",
    seoDescription:
      "AI video ideas for YouTube, matched to your niche and scored for opportunity. See what is trending, where the gaps are, and which idea is worth filming.",
    focusKeyword: "ai video ideas for youtube",
    keywords: [
      "ai youtube video idea tool",
      "youtube content ideas ai",
      "video ideas for my niche",
      "youtube idea opportunity score",
      "ai trend analysis for youtube",
    ],
    h1: "AI Video Ideas for YouTube, Scored Before You Film",
    answerSummary:
      "Creator AI generates video ideas for your niche and scores each one for opportunity instead of handing you a list of titles. It looks at what is currently working, finds the gaps your channel could fill, and returns every idea with a trend snapshot attached. You can run it fully automatic across your niche, or point it at a specific topic you already want to cover.",
    steps: [
      {
        title: "Pick auto mode or a topic",
        description:
          "Auto mode reads your channel and niche and proposes ideas unprompted. Topic mode narrows the search to something you already have in mind.",
      },
      {
        title: "Generate one to five ideas",
        description:
          "Each idea comes back with an angle, a trend snapshot and an opportunity score, so the shortlist is comparable rather than a wall of titles.",
      },
      {
        title: "Send it straight to a story or a script",
        description:
          "An idea you like can be pushed into Story Builder or into a script, so the concept does not have to be retyped to be used.",
      },
    ],
    sections: [
      {
        heading: "Why a list of titles is the wrong output",
        body: [
          "Most idea tools optimise for volume. Twenty titles feels generous until you try to film one and realise you still have to work out the angle, the opening, and whether anybody is actually looking for it. The list was never the hard part.",
          "The hard part is knowing which idea is worth a weekend of your time. That is a judgement about competition, timing and fit with your channel, and it is precisely the judgement a bare list refuses to make.",
        ],
      },
      {
        heading: "What an opportunity score is actually measuring",
        body: [
          "The score weighs how much demand a topic currently has against how well it is already served. A saturated topic with strong existing coverage scores low even when it is popular, because popularity you cannot rank against is not an opportunity.",
          "**It is designed to be able to tell you no.** A tool that scores every idea in the nineties is flattering you rather than helping you, and it makes the score worthless as a filter.",
        ],
      },
      {
        heading: "AI video ideas for YouTube that fit your channel, not the average one",
        body: [
          "Trend data on its own produces ideas for a generic creator in your niche. Combined with a trained voice profile and your upload history, the same trend produces ideas you could actually make: the angle assumes your format, your depth, and the audience you already have.",
          "There is a free version of this at the [YouTube video ideas generator](/tools/free-youtube-video-ideas-generator), which works from a niche alone and needs no account.",
        ],
      },
    ],
    faqs: [
      {
        question: "How is this different from asking ChatGPT for video ideas?",
        answer:
          "A general model generates plausible ideas from its training data, with no view of what is currently working or what your channel has already covered. The scoring and the trend snapshot are the parts a chat prompt cannot produce.",
      },
      {
        question: "Can I focus the ideas on a specific topic?",
        answer:
          "Yes. Auto mode proposes ideas across your niche, and topic mode takes a subject you name and generates angles within it.",
      },
      {
        question: "How many ideas can I generate at once?",
        answer:
          "One to five per session. The cap is deliberate: five scored ideas you will compare beats fifty you will not read.",
      },
      {
        question: "Do the ideas come with anything I can film from?",
        answer:
          "Each idea carries an angle, a hook direction and talking points, and can be sent into Story Builder or a script without being retyped.",
      },
    ],
    relatedFeatures: ["story-builder", "scripts"],
    relatedPosts: [
      {
        slug: "how-to-find-trending-youtube-video-topics-2026",
        title: "How to Find Trending YouTube Video Topics",
      },
      {
        slug: "youtube-video-ideation-system-for-youtube-creators-2026",
        title: "The YouTube Video Ideation System That Beats Guessing",
      },
    ],
  },
  {
    id: "story-builder",
    title: "Story Builder",
    cardDescription:
      "Plan your video structure with hooks and escalation points, plus a retention score before you start filming.",
    tagline: "Plan videos that keep viewers watching",
    description:
      "Create a structured story blueprint before you start writing. Define your audience, content type, and tone. The AI builds a full outline with hooks, escalation points, and a retention score so you know if your video will hold attention.",
    highlights: [
      "Structured story outlines with hooks and pacing",
      "Retention scoring to predict viewer engagement",
      "Choose audience, duration, and content type",
      "Link ideation ideas directly into your story",
    ],
    icon: Clapperboard,
    gradient: "from-cyan-500 to-blue-500",
    seoTitle: "YouTube Video Outline Planner With Retention Scoring",
    seoDescription:
      "A YouTube video outline planner that maps hooks, escalation and payoff, then scores the structure for retention before you spend a day filming it.",
    focusKeyword: "youtube video outline planner",
    keywords: [
      "youtube video structure planner",
      "plan a youtube video before filming",
      "retention score for video outlines",
      "video blueprint tool for creators",
      "hook and payoff planning youtube",
    ],
    h1: "A YouTube Video Outline Planner That Scores Retention First",
    answerSummary:
      "Story Builder is a YouTube video outline planner that maps a video's structure before you write a word of script. You set the audience, content type, tone and runtime, and it returns a blueprint with a hook, escalation points and a payoff, plus a retention score predicting whether that shape will hold attention. Weak structure is cheap to fix at the outline stage and expensive to fix after filming.",
    steps: [
      {
        title: "Define the video",
        description:
          "Audience, content type, tone and target runtime. These four inputs change the shape of the outline more than the topic itself does.",
      },
      {
        title: "Get a structured blueprint",
        description:
          "Hook, escalation points, payoff and the beats between them, laid out in order rather than as a list of things you ought to mention.",
      },
      {
        title: "Read the retention score, then adjust",
        description:
          "The score flags where attention is likely to drop. Reordering beats now costs minutes; finding the same problem in the edit costs the shoot.",
      },
    ],
    sections: [
      {
        heading: "Why a YouTube video outline planner beats writing the script first",
        body: [
          "Most videos that lose viewers do not lose them to bad writing. They lose them to a shape that was never going to work: a payoff placed too late, three escalations of the same size, or a middle section that exists because it was on the list.",
          "Writing the script first hides this. Prose is persuasive, and a well-written scene reads fine inside a structure that cannot hold attention. Planning the shape first makes the problem visible while it is still free to fix.",
        ],
      },
      {
        heading: "What the retention score is, and what it is not",
        body: [
          "The score is a prediction about structure, based on where attention typically drops in videos of that type and length. It is not a promise, and it knows nothing about how good your delivery is.",
          "**Used as a comparator it is genuinely useful:** two outlines for the same video, scored, tells you which shape to film. Used as a number to maximise, it will push you toward formulaic videos, which is not what it is for.",
        ],
      },
      {
        heading: "From outline to script without retyping",
        body: [
          "A finished blueprint feeds straight into script writing, so the structure you approved is the structure the script follows. Ideas from [Video Ideas](/features/ideation) can be linked in at the top of the same flow.",
          "The [free story structure generator](/tools/free-youtube-story-structure-generator) runs the same idea without an account, at a shorter length and without your voice profile attached.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is the retention score based on?",
        answer:
          "Where attention typically drops in videos of the same type and runtime, applied to the shape of your outline. It scores structure, not delivery or production quality.",
      },
      {
        question: "Do I have to use Story Builder before writing a script?",
        answer:
          "No. It exists for videos where structure is the risk, which is most long-form and narrative content. A short tutorial usually does not need it.",
      },
      {
        question: "Can I edit the blueprint it gives me?",
        answer:
          "Yes. The outline is a starting structure, not a locked template, and rescoring after an edit shows whether the change actually helped.",
      },
      {
        question: "Can I bring in an idea I already generated?",
        answer:
          "Yes. Ideas from Video Ideas link directly into a story, so the angle and hook carry over instead of being rewritten.",
      },
    ],
    relatedFeatures: ["ideation", "scripts"],
    relatedPosts: [
      {
        slug: "youtube-video-story-structure-for-retention-2026",
        title: "Story Structure 101: Plan Videos That People Actually Finish",
      },
      {
        slug: "improve-youtube-audience-retention-watch-time",
        title: "How to Improve YouTube Audience Retention and Watch Time",
      },
    ],
  },
  {
    id: "thumbnails",
    title: "Thumbnails",
    cardDescription:
      "Create click-worthy YouTube thumbnails from a prompt, a frame of your video, or your own reference images.",
    tagline: "Thumbnails that get clicks",
    description:
      "Generate eye-catching thumbnails that match your brand style. Describe what you want, upload a frame from your video, or add reference images. The AI creates professional thumbnails you can use right away.",
    highlights: [
      "AI-generated thumbnails from text descriptions",
      "Upload video frames or reference images",
      "Multiple aspect ratio options",
      "Consistent with your brand identity",
    ],
    icon: ImageIcon,
    gradient: "from-emerald-500 to-green-500",
    seoTitle: "AI Thumbnail Generator for YouTube | Creator AI",
    seoDescription:
      "An AI thumbnail generator for YouTube that works from a prompt, a frame of your video or your own references, and keeps your channel style consistent.",
    focusKeyword: "ai thumbnail generator for youtube",
    keywords: [
      "generate youtube thumbnails with ai",
      "thumbnail from video frame",
      "consistent thumbnail style youtube",
      "ai thumbnail from reference images",
      "youtube thumbnail aspect ratios",
    ],
    h1: "An AI Thumbnail Generator for YouTube That Keeps Your Style",
    answerSummary:
      "Creator AI generates YouTube thumbnails from a text description, a frame pulled out of your own video, or reference images you upload. It produces finished images at the aspect ratios YouTube actually uses, and it can work from your existing thumbnails so a new one looks like it belongs on your channel. The point is a usable thumbnail in a minute, not a design brief.",
    steps: [
      {
        title: "Describe it, or start from a frame",
        description:
          "A text description is enough to get going. Pulling a frame out of the video itself is usually better, because the face and the moment are already right.",
      },
      {
        title: "Add reference images for style",
        description:
          "Upload thumbnails you have used before and the generator matches the treatment, which is what keeps a channel visually consistent over time.",
      },
      {
        title: "Generate and pick an aspect ratio",
        description:
          "Output arrives at the ratios you need, ready to upload rather than ready to crop.",
      },
    ],
    sections: [
      {
        heading: "Why an AI thumbnail generator for YouTube should copy your own style",
        body: [
          "A thumbnail's first job is not to be striking. It is to be recognisable in a feed where your video sits next to eleven others, one of which is also yours. Channels with a visual signature get clicked by people who already know them, and that is most of your early traffic.",
          "This is why generating from references matters more than generating from a prompt. **A prompt produces a good image; references produce your image.**",
        ],
      },
      {
        heading: "Working from a frame of the real video",
        body: [
          "The strongest thumbnails usually come out of the footage. The expression is real, the lighting matches the video, and the viewer is not promised a moment that never actually happens on screen.",
          "Pulling a frame and generating around it keeps that authenticity while fixing what a raw frame gets wrong: the crop, the contrast, and the empty third where text has to go.",
        ],
      },
      {
        heading: "What this does not try to be",
        body: [
          "This is not a full design editor and does not pretend to be one. If you already have a thumbnail process in Canva or Photoshop that works, the sensible use here is generating the base image and finishing it where you already work.",
          "For creators without that process, it removes the step that most often delays an upload by a day.",
        ],
      },
    ],
    faqs: [
      {
        question: "What size are the generated thumbnails?",
        answer:
          "They come out at YouTube's standard 16:9 proportions, with other aspect ratios available for Shorts and for use off the platform.",
      },
      {
        question: "Can I use my own photos or previous thumbnails?",
        answer:
          "Yes, and it is the recommended path. Uploading references is what makes a new thumbnail look like it belongs to your channel rather than to a model.",
      },
      {
        question: "Can I pull the image from the video itself?",
        answer:
          "Yes. Upload the video, choose a frame, and generate around it.",
      },
      {
        question: "Do I need design skills to use it?",
        answer:
          "No. The output is a finished image. Creators who already have a design workflow tend to use it for the base and finish elsewhere.",
      },
    ],
    relatedFeatures: ["subtitles", "video-generation"],
    relatedPosts: [
      {
        slug: "youtube-thumbnail-mistakes-killing-your-ctr-2026",
        title: "5 Thumbnail Mistakes Killing Your CTR",
      },
      {
        slug: "best-ai-thumbnail-maker-tools-that-boost-youtube-ctr-2026",
        title: "17 AI Thumbnail Tools Tested on Real Uploads",
      },
    ],
  },
  {
    id: "subtitles",
    title: "Subtitles",
    cardDescription:
      "Auto-generate accurate video subtitles, edit them inline against the player, and export them as SRT or VTT.",
    tagline: "Accurate subtitles, automatically",
    description:
      "Upload your video and get timed subtitles generated automatically. Edit them inline with a built-in video player, style them how you want, and export as SRT or VTT. No manual transcription needed.",
    highlights: [
      "Auto-transcription from video upload",
      "Built-in subtitle editor with video player",
      "Style and customize your subtitles",
      "Export as SRT or VTT files",
    ],
    icon: MessageSquare,
    gradient: "from-violet-500 to-purple-500",
    seoTitle: "Automatic Video Subtitle Generator With SRT and VTT Export",
    seoDescription:
      "An automatic video subtitle generator with an inline editor and SRT or VTT export. Upload a video, get timed captions, fix what matters, then publish.",
    focusKeyword: "automatic video subtitle generator",
    keywords: [
      "auto generate subtitles for video",
      "srt and vtt export tool",
      "edit subtitles against the video",
      "add captions to youtube videos",
      "video transcription and timing",
    ],
    h1: "An Automatic Video Subtitle Generator You Can Actually Edit",
    answerSummary:
      "Creator AI transcribes an uploaded video into timed subtitles and gives you an editor with the player beside the text, so corrections happen in context. Once the captions are right you export them as SRT or VTT and upload them with the video. That editing step is the point: automatic transcription is fast everywhere, and it is the names, jargon and product terms it gets wrong that cost you.",
    steps: [
      {
        title: "Upload the video",
        description:
          "Transcription and timing happen together, so the first draft is already synced rather than a wall of text you have to align by hand.",
      },
      {
        title: "Fix it against the player",
        description:
          "The editor sits beside the video. You correct a line while hearing it, which is the only reliable way to catch a wrong word that is still a real word.",
      },
      {
        title: "Style it and export",
        description:
          "Export as SRT or VTT. Both are plain text and both upload directly to YouTube.",
      },
    ],
    sections: [
      {
        heading: "Where every automatic video subtitle generator fails",
        body: [
          "Automatic transcription is accurate on ordinary speech and unreliable on the words that carry your video: names, technical terms, product names, and anything said quickly or over music. Those are also the words a viewer notices being wrong.",
          "The accuracy figure a tool advertises is an average across ordinary speech. **It tells you very little about the twenty words in your video that actually have to be right**, which is why an editing pass is not optional.",
        ],
      },
      {
        heading: "Subtitles are a watch-time feature, not a checkbox",
        body: [
          "Captions are an accessibility requirement, and that alone justifies them. They are also, on YouTube specifically, a retention feature: a large share of viewing happens muted, in public, or in a second language.",
          "A video without captions is unavailable to those viewers in the first few seconds, which is the same window everything else on this page is about.",
        ],
      },
      {
        heading: "SRT or VTT, and when the difference matters",
        body: [
          "SRT is the universal format and the right default for YouTube. VTT supports styling and positioning, which matters when captions have to avoid burned-in text or sit somewhere specific on screen.",
          "Both export from the same editor, so the choice is about where the file is going rather than about redoing the work. [SRT vs VTT](/blog/srt-vs-vtt-subtitle-formats-explained-2026) covers where each one breaks.",
        ],
      },
    ],
    faqs: [
      {
        question: "What formats can I export?",
        answer:
          "SRT and VTT. SRT is the safe default for YouTube; VTT is the one to pick when you need caption styling or positioning.",
      },
      {
        question: "How accurate is the automatic transcription?",
        answer:
          "Accurate enough on ordinary speech that editing is a pass rather than a retype, and unreliable on names and jargon, which is exactly what the inline editor is for.",
      },
      {
        question: "Can I edit the timings as well as the words?",
        answer:
          "Yes. Timing and text are both editable against the player, so a caption that lands late can be nudged rather than rewritten.",
      },
      {
        question: "Do subtitles help with YouTube search?",
        answer:
          "Indirectly. The clearer win is watch time from muted and non-native viewers, which is a much larger share of the audience than most creators assume.",
      },
    ],
    relatedFeatures: ["dubbing", "thumbnails"],
    relatedPosts: [
      {
        slug: "how-subtitles-boost-youtube-views-and-watch-time",
        title: "How Subtitles Increase YouTube Views and Watch Time",
      },
      {
        slug: "accurate-ai-subtitle-generator-for-youtube-tested-2026",
        title: "7 AI Subtitle Generators Tested on Real Accents",
      },
    ],
  },
  {
    id: "dubbing",
    title: "Audio Dubbing",
    cardDescription:
      "Dub your videos into other languages using a clone of your own voice rather than a stock narrator.",
    tagline: "Reach a global audience in your own voice",
    description:
      "Dub a finished video into another language without hiring a voice actor. The AI clones your voice, so the translated version still sounds like your channel rather than a stock narrator.",
    highlights: [
      "Dub finished videos into other languages",
      "Voice cloning keeps your own delivery",
      "Translated audio timed to the original video",
      "Download the dubbed track when it is done",
    ],
    icon: Languages,
    gradient: "from-teal-500 to-emerald-500",
    seoTitle: "Dub Videos in Your Own Voice With AI | Creator AI",
    seoDescription:
      "Dub videos in your own voice instead of a stock narrator. Creator AI clones your voice, translates the audio and times it against the original video.",
    focusKeyword: "dub videos in your own voice",
    keywords: [
      "ai dubbing with voice cloning",
      "translate youtube videos keeping your voice",
      "dubbed audio track for youtube",
      "multi language youtube channel",
      "voice clone dubbing for creators",
    ],
    h1: "Dub Videos in Your Own Voice, Not a Stranger's",
    answerSummary:
      "Creator AI dubs a finished video into another language using a clone of your own voice, so the translated version still sounds like your channel. The translated audio is timed against the original video and downloads as a track you can attach to your upload. The alternative, on YouTube's own auto-dubbing and on most tools, is a competent stranger reading your script.",
    steps: [
      {
        title: "Upload the finished video",
        description:
          "Dubbing runs on a finished cut rather than a script, so what gets translated is what viewers actually hear.",
      },
      {
        title: "Pick the target language",
        description:
          "The AI translates and performs the audio in a clone of your voice rather than handing it to a stock narrator.",
      },
      {
        title: "Download the dubbed track",
        description:
          "The audio comes back timed to the original video, ready to attach as an alternate track.",
      },
    ],
    sections: [
      {
        heading: "Voice is most of what a subscriber subscribed to",
        body: [
          "A dubbed video in a generic synthesized voice reaches a new audience with the one thing your channel is built on removed. The information survives. The reason anyone chose you does not.",
          "**This is the specific gap voice cloning closes.** YouTube's native auto-dubbing is free, wide, and reads your script in somebody else's voice. That is a reasonable trade for some channels and a bad one for any channel whose delivery is the product.",
        ],
      },
      {
        heading: "What dubbing costs, and when it is worth it",
        body: [
          "Dubbing is priced per minute of finished video, so the cost of testing a language is one video rather than a commitment. That is the sensible way to find out whether a market exists for your content before translating a back catalogue into it.",
          "The videos worth dubbing first are usually evergreen. A tutorial that still pulls traffic two years on earns the translation back; a news reaction does not.",
        ],
      },
      {
        heading: "When to dub videos in your own voice, and where it fits",
        body: [
          "Dubbing is the last step. It runs on the finished video, after the script, the edit and usually the [subtitles](/features/subtitles) are done.",
          "Captions and a dub answer different problems, though, and one is not a substitute for the other: captions serve viewers who cannot or will not use audio, and a dub serves viewers who would simply rather listen in their own language.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does it use my real voice or a synthetic one?",
        answer:
          "A clone of your voice, built from your own audio, so the dubbed track keeps your delivery instead of replacing it with a stock narrator.",
      },
      {
        question: "How is this different from YouTube's free auto-dubbing?",
        answer:
          "YouTube's auto-dubbing is free and generic: it translates accurately into a synthesized voice you do not control. Voice cloning keeps the voice, which for most channels is the entire point of dubbing.",
      },
      {
        question: "Is it legal to clone my own voice?",
        answer:
          "Yes. Cloning a voice you own, for your own content, is uncontroversial. Consent is what the law cares about here, and it is yours to give.",
      },
      {
        question: "How is dubbing priced?",
        answer:
          "Per minute of finished video, which makes a single video a cheap way to test whether an audience exists in a language before committing to more.",
      },
    ],
    relatedFeatures: ["subtitles", "ai-studio"],
    relatedPosts: [
      {
        slug: "how-to-dub-youtube-videos-into-multiple-languages-ai",
        title: "How to Dub YouTube Videos Into Multiple Languages With AI",
      },
      {
        slug: "youtube-auto-dubbing-vs-ai-voice-cloning-explained",
        title: "YouTube Auto-Dubbing vs AI Voice Cloning",
      },
    ],
  },
  {
    id: "video-generation",
    title: "Video Generation",
    cardDescription:
      "Generate short video clips with audio from a text prompt or a starting image, ready for B-roll and openers.",
    tagline: "Turn a prompt into a usable clip",
    description:
      "Generate short video clips from a text prompt or a starting image, with audio. Useful for B-roll, an opening shot, or testing how an idea looks before committing to a full shoot.",
    highlights: [
      "Generate clips from a text prompt",
      "Start from an image for more control",
      "Audio generated alongside the video",
      "Download and drop straight into your edit",
    ],
    icon: Film,
    gradient: "from-fuchsia-500 to-pink-500",
    seoTitle: "AI Video Clip Generator for B-Roll and Openers",
    seoDescription:
      "An AI video clip generator that turns a prompt or a starting image into a short clip with audio, for B-roll, openers and testing a shot before filming.",
    focusKeyword: "ai video clip generator",
    keywords: [
      "generate b-roll with ai",
      "text to video clip for youtube",
      "image to video generation",
      "ai opener clips for videos",
      "short ai video with audio",
    ],
    h1: "An AI Video Clip Generator for B-Roll and Openers",
    answerSummary:
      "Creator AI generates short video clips, with audio, from a text prompt or a starting image. The clips are meant to be used inside a real edit as B-roll, an opening shot, or a visual for something you cannot film, and they download ready to drop onto a timeline. It is also the cheapest way to see whether a shot you have in mind works before you build it.",
    steps: [
      {
        title: "Write the shot, or start from an image",
        description:
          "Describe the clip you need. Starting from an image gives you far more control over framing and subject than a prompt alone does.",
      },
      {
        title: "Generate with audio",
        description:
          "Audio is generated alongside the video, so the clip is usable without a separate sound pass.",
      },
      {
        title: "Download and cut it in",
        description:
          "The clip downloads in a standard format and goes straight onto the timeline in whatever editor you already use.",
      },
    ],
    sections: [
      {
        heading: "What an AI video clip generator is actually good for",
        body: [
          "Generated video is not a replacement for filming, and treating it as one produces videos that feel synthetic. Where it earns its place is the footage you were never going to film anyway: an establishing shot of a place you are not in, an abstract visual over a narration section, a three-second opener.",
          "**This is the B-roll problem**, and it is the reason creators end up paying stock libraries for clips that look like everybody else's.",
        ],
      },
      {
        heading: "Starting from an image instead of a prompt",
        body: [
          "A prompt gives the model total freedom, which is why prompt-only clips often look impressive and fit nothing. Starting from an image pins down the subject, the framing and the palette, and asks the model only to handle motion.",
          "For anything that has to match the rest of your video, image-to-video is the mode to reach for.",
        ],
      },
      {
        heading: "Testing an idea before committing to a shoot",
        body: [
          "A generated clip is a cheap storyboard that moves. If a shot in your head is going to cost half a day to set up, it is worth seeing an approximation of it first.",
          "The same logic applies to openers, which get rewritten more often than any other part of a video.",
        ],
      },
    ],
    faqs: [
      {
        question: "How long are the generated clips?",
        answer:
          "Short, in the range you would use for B-roll or an opener rather than a full scene. They are built to be cut into a video, not to be one.",
      },
      {
        question: "Does the clip come with audio?",
        answer:
          "Yes. Audio is generated with the video, so the clip is usable without a separate sound pass.",
      },
      {
        question: "Can I control the look of the clip?",
        answer:
          "Starting from an image gives you the most control: it fixes the subject and framing and leaves the model to handle motion. Prompt-only generation is freer and less predictable.",
      },
      {
        question: "What can I do with the clips once they are generated?",
        answer:
          "Download and use them in your edit. They are ordinary video files and go into any editor.",
      },
    ],
    relatedFeatures: ["thumbnails", "scripts"],
    relatedPosts: [
      {
        slug: "best-ai-tools-for-faceless-youtube-channels-2026",
        title: "10 Best AI Tools for Faceless YouTube Channels",
      },
      {
        slug: "best-ai-tools-to-turn-long-videos-into-shorts-2026",
        title: "9 Best AI Tools to Turn Long Videos Into YouTube Shorts",
      },
    ],
  },
]

export const COMING_SOON_FEATURES: SimpleFeature[] = [
  {
    title: "Course Builder",
    description: "Break down complex topics into structured video courses with organized outlines and scripts.",
    cardDescription:
      "Break a complex topic into a structured video course with organized outlines and a script per lesson.",
    icon: BookOpen,
  },
]

export const EXTRA_FEATURES: SimpleFeature[] = [
  {
    title: "Channel Stats",
    cardDescription:
      "Track your YouTube subscribers, views and video count from a single dashboard overview of your channel.",
    description: "See your YouTube channel overview, subscribers, views, video count, and more, right in your dashboard.",
    icon: BarChart3,
  },
  {
    title: "Referral Program",
    cardDescription:
      "Invite creator friends and earn free Creator AI credits through your own personal referral link.",
    description: "Invite friends and earn free credits for every creator who signs up through your link.",
    icon: Gift,
  },
]

/**
 * Lookup by slug for the /features/<slug> route. Mirrors getFreeTool in
 * lib/free-tools.ts. Only CORE_FEATURES get pages: the COMING_SOON and EXTRA
 * lists are SimpleFeature, carry no id and no page copy, and stay on the hub.
 */
export function getFeature(slug: string): ProductFeature | undefined {
  return CORE_FEATURES.find((feature) => feature.id === slug);
}

/** Every slug with a detail page, for generateStaticParams and the sitemap. */
export const FEATURE_SLUGS: string[] = CORE_FEATURES.map((feature) => feature.id);
