import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Next.js only reads env files from this app's own dir. Load the monorepo-root
// .env so web shares the single source of truth with api/workers. Runs before
// build, so NEXT_PUBLIC_* still get inlined. No-ops in prod where the file is
// absent (Vercel injects env directly) — dotenv silently ignores a missing path.
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

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
  },
  // 301s from the original blog slugs to the longer, keyword-rich SEO slugs.
  // Preserves rankings/backlinks after the 2026 SEO slug migration.
  async redirects() {
    return [
      { source: "/blog/5-things-creator-ai-does-that-chatgpt-cant", destination: "/blog/5-things-a-youtube-ai-tool-does-that-chatgpt-cant", permanent: true },
      { source: "/blog/creator-ai-vs-chatgpt-for-youtubers", destination: "/blog/creator-ai-vs-chatgpt-for-youtube-creators", permanent: true },
      { source: "/blog/chatgpt-for-youtube-scripts-review", destination: "/blog/chatgpt-for-youtube-scripts-review-tested-2026", permanent: true },
      { source: "/blog/chatgpt-alternatives-for-youtubers", destination: "/blog/best-chatgpt-alternatives-for-youtubers-2026", permanent: true },
      { source: "/blog/best-ai-script-writer-for-youtube-2026", destination: "/blog/best-ai-script-writer-for-youtube-2026-compared", permanent: true },
      { source: "/blog/why-ai-scripts-sound-robotic", destination: "/blog/how-to-make-ai-scripts-sound-more-human-youtube", permanent: true },
      { source: "/blog/problem-with-generic-ai-for-youtube", destination: "/blog/why-generic-ai-tools-dont-work-for-youtube-creators", permanent: true },
      { source: "/blog/how-creator-ai-learns-your-voice", destination: "/blog/how-creator-ai-learns-your-youtube-channel-voice", permanent: true },
      { source: "/blog/thumbnail-mistakes-killing-ctr", destination: "/blog/youtube-thumbnail-mistakes-killing-your-ctr-2026", permanent: true },
      { source: "/blog/guide-to-finding-trending-video-topics", destination: "/blog/how-to-find-trending-youtube-video-topics-2026", permanent: true },
      { source: "/blog/subtitles-boost-youtube-views", destination: "/blog/how-subtitles-boost-youtube-views-and-watch-time", permanent: true },
      { source: "/blog/story-structure-plan-videos", destination: "/blog/youtube-video-story-structure-for-retention-2026", permanent: true },
      { source: "/blog/ai-youtube-dubbing-multilingual-growth", destination: "/blog/how-to-dub-youtube-videos-into-multiple-languages-ai", permanent: true },
      { source: "/blog/best-ai-thumbnail-generator-youtube-2026", destination: "/blog/best-ai-thumbnail-generator-for-youtube-creators-2026", permanent: true },
      { source: "/blog/youtube-auto-dubbing-vs-ai-voice-cloning", destination: "/blog/youtube-auto-dubbing-vs-ai-voice-cloning-explained", permanent: true },
      { source: "/blog/best-ai-dubbing-tool-for-youtubers-2026", destination: "/blog/best-ai-dubbing-tool-for-youtubers-2026-compared", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Server", value: "CreatorAI/1.0 (+https://tryscriptai.com)" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
