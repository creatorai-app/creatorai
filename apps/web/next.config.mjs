import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Next.js only reads env files from this app's own dir. Load the monorepo-root
// .env so web shares the single source of truth with api/workers. Runs before
// build, so NEXT_PUBLIC_* still get inlined. No-ops in prod where the file is
// absent (Vercel injects env directly) — dotenv silently ignores a missing path.
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

// --- Content Security Policy ------------------------------------------------
// Built from env so dev (localhost API) and prod (real API host) share one
// policy instead of two that drift apart.
//
// Shipped as Content-Security-Policy-REPORT-ONLY on purpose: it reports
// violations without blocking, so real traffic proves the allowlist is complete
// before anything can break. See the note in headers() for the enforce path.
const isDev = process.env.NODE_ENV === "development";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
// Supabase realtime uses a websocket on the same host.
const supabaseWs = supabaseUrl.replace(/^https:/, "wss:");

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' is load-bearing while these pages stay static. Nonces are
  // the strong alternative, but Next can only inject them during dynamic
  // rendering, which turns off static generation, ISR and CDN caching — the
  // exact wins the recent perf work bought. inlineCss also emits inline
  // <style> tags by design.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://lmsqueezy.com https://app.lemonsqueezy.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://avatar.vercel.sh https://yt3.ggpht.com https://i.ytimg.com https://www.google-analytics.com ${supabaseUrl}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} ${backendUrl} https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com`,
  // Demo video (Drive) and the checkout overlay.
  "frame-src 'self' https://drive.google.com https://www.youtube-nocookie.com https://www.youtube.com https://app.lemonsqueezy.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Modern replacement for the X-Frame-Options below, which stays for old browsers.
  "frame-ancestors 'self'",
  // Skipped in dev: it would rewrite the http://localhost API calls to https.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .filter(Boolean)
  .join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.output = {
      ...config.output,
      hashFunction: 'xxhash64',
    };
    return config;
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'yt3.ggpht.com'
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com'
      }
    ],
  },
  transpilePackages: ["@repo/ui"],
  poweredByHeader: false,
  // Tree-shake barrel files so importing one icon/animation helper doesn't pull
  // the package's whole module graph into a route's first-load JS. Next already
  // does this for lucide-react, @tabler/icons-react, recharts and date-fns.
  experimental: {
    optimizePackageImports: ["motion", "@repo/ui", "@tsparticles/slim"],
    // Inline the Tailwind CSS as a <style> tag instead of a render-blocking
    // <link>, killing the CSS request waterfall that PageSpeed flags (~930ms
    // mobile). Right feature for App Router — optimizeCss/critters can't stream.
    // ponytail: experimental + build-only (invisible in `next dev`); verify on
    // the Vercel preview before merge. Trade-off is returning visitors re-fetch
    // the ~30KiB CSS per load — negligible for a first-visitor landing page.
    inlineCss: true,
  },
  // 301s from the original blog slugs to the longer, keyword-rich SEO slugs.
  // Preserves rankings/backlinks after the 2026 SEO slug migration.
  async redirects() {
    return [
      { source: "/blog/creator-ai-vs-chatgpt-for-youtubers", destination: "/blog/creator-ai-vs-chatgpt-for-youtube-creators", permanent: true },
      { source: "/blog/chatgpt-alternatives-for-youtubers", destination: "/blog/best-chatgpt-alternatives-for-youtubers-2026", permanent: true },
      { source: "/blog/how-creator-ai-learns-your-voice", destination: "/blog/ai-script-tool-that-learns-your-voice-from-your-videos", permanent: true },
      { source: "/blog/how-creator-ai-learns-your-youtube-channel-voice", destination: "/blog/ai-script-tool-that-learns-your-voice-from-your-videos", permanent: true },
      { source: "/blog/thumbnail-mistakes-killing-ctr", destination: "/blog/youtube-thumbnail-mistakes-killing-your-ctr-2026", permanent: true },
      { source: "/blog/guide-to-finding-trending-video-topics", destination: "/blog/how-to-find-trending-youtube-video-topics-2026", permanent: true },
      { source: "/blog/subtitles-boost-youtube-views", destination: "/blog/how-subtitles-boost-youtube-views-and-watch-time", permanent: true },
      { source: "/blog/story-structure-plan-videos", destination: "/blog/youtube-video-story-structure-for-retention-2026", permanent: true },
      { source: "/blog/ai-youtube-dubbing-multilingual-growth", destination: "/blog/how-to-dub-youtube-videos-into-multiple-languages-ai", permanent: true },
      { source: "/blog/youtube-auto-dubbing-vs-ai-voice-cloning", destination: "/blog/youtube-auto-dubbing-vs-ai-voice-cloning-explained", permanent: true },
      { source: "/blog/best-ai-dubbing-tool-for-youtubers-2026", destination: "/blog/best-ai-dubbing-tool-for-youtubers-2026-compared", permanent: true },

      // Free-tool slugs gained a "free-" prefix, which is the word people
      // actually search alongside these tools and was already the first word of
      // both page titles. Both URLs are indexed and linked from the blog, so
      // they 301 rather than 404. The blog bodies still point at the old paths
      // and resolve through these; they are DB rows, and rewriting live post
      // content to save one redirect hop is the more expensive side of the fix.
      { source: "/tools/youtube-script-generator", destination: "/tools/free-youtube-script-generator", permanent: true },
      { source: "/tools/youtube-video-ideas-generator", destination: "/tools/free-youtube-video-ideas-generator", permanent: true },

      // 2026 cluster consolidation. Eight clusters had several posts chasing one
      // search intent, which split link equity and produced the "Duplicate,
      // Google chose a different canonical" reports. Each cluster now has one
      // page; the merged posts' unique sections were folded into the hub and
      // their URLs 301 here. Old pre-migration slugs point straight at the final
      // hub rather than through the deleted middle slug — no redirect chains.
      { source: "/blog/best-ai-thumbnail-design-tools-for-youtube-video-covers-2026", destination: "/blog/best-ai-thumbnail-maker-tools-that-boost-youtube-ctr-2026", permanent: true },
      { source: "/blog/best-youtube-thumbnail-software-ranked-and-tested-for-creators-2026", destination: "/blog/best-ai-thumbnail-maker-tools-that-boost-youtube-ctr-2026", permanent: true },
      { source: "/blog/best-ai-thumbnail-generator-for-youtube-creators-2026", destination: "/blog/best-ai-thumbnail-maker-tools-that-boost-youtube-ctr-2026", permanent: true },
      { source: "/blog/best-ai-thumbnail-generator-youtube-2026", destination: "/blog/best-ai-thumbnail-maker-tools-that-boost-youtube-ctr-2026", permanent: true },

      { source: "/blog/is-chatgpt-good-for-youtube-content-creation", destination: "/blog/creator-ai-vs-chatgpt-for-youtube-creators", permanent: true },
      { source: "/blog/5-things-a-youtube-ai-tool-does-that-chatgpt-cant", destination: "/blog/creator-ai-vs-chatgpt-for-youtube-creators", permanent: true },
      { source: "/blog/5-things-creator-ai-does-that-chatgpt-cant", destination: "/blog/creator-ai-vs-chatgpt-for-youtube-creators", permanent: true },
      { source: "/blog/why-generic-ai-tools-dont-work-for-youtube-creators", destination: "/blog/creator-ai-vs-chatgpt-for-youtube-creators", permanent: true },
      { source: "/blog/problem-with-generic-ai-for-youtube", destination: "/blog/creator-ai-vs-chatgpt-for-youtube-creators", permanent: true },

      { source: "/blog/chatgpt-for-youtube-scripts-review-tested-2026", destination: "/blog/best-chatgpt-alternatives-for-youtubers-2026", permanent: true },
      { source: "/blog/chatgpt-for-youtube-scripts-review", destination: "/blog/best-chatgpt-alternatives-for-youtubers-2026", permanent: true },

      { source: "/blog/best-ai-script-writer-for-youtube-2026-compared", destination: "/blog/best-free-ai-script-generator-tools-for-youtube-videos-2026", permanent: true },
      { source: "/blog/best-ai-script-writer-for-youtube-2026", destination: "/blog/best-free-ai-script-generator-tools-for-youtube-videos-2026", permanent: true },

      { source: "/blog/how-to-make-ai-scripts-sound-more-human-youtube", destination: "/blog/youtube-scripts-that-keep-viewers-watching", permanent: true },
      { source: "/blog/why-ai-scripts-sound-robotic", destination: "/blog/youtube-scripts-that-keep-viewers-watching", permanent: true },

      { source: "/blog/best-ai-video-idea-generator-for-youtube-creators-2026", destination: "/blog/youtube-video-ideation-system-for-youtube-creators-2026", permanent: true },

      { source: "/blog/claude-for-youtube-scripts-honest-review-2026", destination: "/blog/creator-ai-vs-claude-for-youtube-creators", permanent: true },

      // Retargeted away from the "best ai subtitle generator" head term (page 1
      // is ScreenApp/OpusClip/Maestra) onto the accuracy angle we can actually
      // win. Slug changed with the keyword, so the old URL 301s here.
      { source: "/blog/best-ai-subtitle-generator-for-youtube-videos-tested-2026", destination: "/blog/accurate-ai-subtitle-generator-for-youtube-tested-2026", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Server", value: "CreatorAI/1.0 (+https://trycreatorai.com)" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Two years, the value Lighthouse and OWASP both ask for. `preload` is
          // deliberately absent: it needs a manual submission to
          // hstspreload.org and is slow to undo, so it should be a conscious
          // choice rather than a side effect of this commit.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // Isolates this window from cross-origin documents that open it.
          // `-allow-popups` rather than plain `same-origin` so any popup we open
          // (checkout) keeps its window.opener link. OAuth here is redirect
          // based, so it is unaffected either way.
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          // Report-only for now. Enforcing needs one of: nonces (costs static
          // rendering), experimental.sri (keeps static, still experimental), or
          // accepting 'unsafe-inline' (which Lighthouse will keep flagging).
          // Collect real violations first, then pick.
          {
            key: "Content-Security-Policy-Report-Only",
            value: contentSecurityPolicy,
          },
        ],
      },
      {
        // /public assets are served with no caching by default, which Lighthouse
        // flags as an inefficient cache policy. They are not content-hashed, so
        // 30 days rather than immutable — long enough for repeat visits, short
        // enough that a replaced asset still rolls out.
        source: "/:path*.(png|jpg|jpeg|webp|avif|svg|ico|woff2)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000" },
        ],
      },
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
