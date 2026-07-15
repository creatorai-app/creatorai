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
