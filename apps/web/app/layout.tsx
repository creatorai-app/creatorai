import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@repo/ui/sonner"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { SupabaseProvider } from "@/components/supabase-provider"
import { Analytics } from "@vercel/analytics/next"
import { siteConfig, createMetadata } from "@/lib/seo"
import JsonLd from "@/components/JsonLd"
import Script from "next/script"
import PublicHannah from "@/components/hannah/PublicHannah"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
})

export const metadata: Metadata = createMetadata({
  title: {
    default: `${siteConfig.name} | AI Assistant for YouTube Creators`,
    template: `%s | ${siteConfig.name}`,
  },
})

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  sameAs: [`https://twitter.com/${siteConfig.twitterHandle.replace("@", "")}`],
}

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  applicationCategory: "Multimedia",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <JsonLd data={organizationJsonLd} />
        <JsonLd data={webAppJsonLd} />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SupabaseProvider>
            <main>{children}</main>
            <PublicHannah />
            <Toaster closeButton={true} richColors />
          </SupabaseProvider>
        </ThemeProvider>
        {process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_SLUG && (
          <>
            <Script id="ls-affiliate-config" strategy="afterInteractive">
              {`window.lemonSqueezyAffiliateConfig = { store: "${process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_SLUG}" }`}
            </Script>
            <Script src="https://lmsqueezy.com/affiliate.js" strategy="afterInteractive" />
          </>
        )}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-RVSYKESCPC"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-RVSYKESCPC');
          `}
        </Script>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
