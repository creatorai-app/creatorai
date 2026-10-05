"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import BrandLogo from "@/components/BrandLogo"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"

/**
 * "Studio Floor" auth frame, from the design handoff.
 *
 * Background advertises the product pipeline behind the form: pulsing
 * broadcast rings, two drifting blobs, a self-drawing channel sparkline, a
 * typed feature column and a couple of data readouts, all under a radial scrim
 * that is what keeps the form legible. Everything decorative is
 * pointer-events:none and gated behind prefers-reduced-motion.
 *
 * Deviations from the mock, all of them "fit the existing app" adjustments:
 *  - the real BrandLogo replaces the gradient-square placeholder
 *  - the site navbar and footer stay, so the decoration is positioned inside
 *    this region rather than the raw viewport
 *  - Inter already ships from next/font; JetBrains Mono was added alongside it
 */

const GROUND = "#F7F8FC"
const INK = "#12151A"

const FEATURES = [
  { k: "IDEATION", t: "opportunity score ······ 91", c: "#2563eb" },
  { k: "SCRIPT", t: "hook rewritten in your voice", c: "#ec4899" },
  { k: "SUBTITLES", t: "12 languages · burned in", c: "#0891b2" },
  { k: "DUBBING", t: "your cloned voice · 90+ langs", c: "#a855f7" },
  { k: "THUMBNAILS", t: "3 variants · A/B ready", c: "#6366f1" },
]

const PILLS = [
  { label: "IDEAS", bg: "rgba(37,99,235,.12)", fg: "#1d4ed8" },
  { label: "SCRIPTS", bg: "rgba(236,72,153,.14)", fg: "#be185d" },
  { label: "SUBTITLES", bg: "rgba(8,145,178,.14)", fg: "#0e7490" },
  { label: "DUBS", bg: "rgba(168,85,247,.15)", fg: "#7e22ce" },
  { label: "THUMBNAILS", bg: "rgba(99,102,241,.13)", fg: "#4338ca" },
]

const RINGS = [
  { color: "rgba(236,72,153,.4)", delay: "0s" },
  { color: "rgba(37,99,235,.38)", delay: "-2.2s" },
  { color: "rgba(168,85,247,.42)", delay: "-4.4s" },
]

export default function AuthLayout({
  tag,
  title,
  subhead,
  children,
}: {
  tag: string
  title: string
  subhead: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col" style={{ background: GROUND }}>
      {/* navbar sits above the decoration: both are positioned siblings, so
          without this the region would paint over it */}
      <div className="relative z-20">
        <LandingPageNavbar />
      </div>

      <main
        className="relative flex min-h-[calc(100dvh-5rem)] flex-1 items-center justify-center overflow-hidden px-6 py-20"
        style={{ background: GROUND }}
      >
        <style>{`
          .au-mono { font-family: var(--font-mono), ui-monospace, Menlo, monospace; }
          @keyframes au-ring { 0%{transform:scale(.35);opacity:.55} 80%{opacity:0} 100%{transform:scale(1.9);opacity:0} }
          @keyframes au-drift { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(80px,-56px) scale(1.16)} 66%{transform:translate(-56px,44px) scale(.9)} }
          @keyframes au-dash { 0%{stroke-dasharray:0 1200} 55%{stroke-dasharray:1200 1200} 100%{stroke-dasharray:1200 1200} }
          @keyframes au-typein { 0%{width:0} 16%{width:100%} 100%{width:100%} }
          @keyframes au-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
          @keyframes au-caret { 0%,49%{opacity:1} 50%,100%{opacity:0} }
          .au-ring { animation: au-ring 6.5s ease-out infinite; }
          .au-blob { animation: au-drift 26s ease-in-out infinite; }
          .au-blob-2 { animation: au-drift 32s ease-in-out infinite reverse; }
          .au-dash { animation: au-dash 10s ease-in-out infinite; }
          .au-type { overflow:hidden; white-space:nowrap; width:0; animation: au-typein 16s steps(28) infinite; }
          .au-float { animation: au-float 10s ease-in-out infinite; }
          .au-caret { animation: au-caret 1.1s step-end infinite; }
          @media (max-width: 520px) { .au-headline { font-size: 30px !important; } }
          @media (prefers-reduced-motion: reduce) {
            .au-ring, .au-blob, .au-blob-2, .au-dash, .au-type, .au-float, .au-caret { animation: none !important; }
            .au-ring { transform: scale(1.1); opacity: .28; }
            .au-dash { stroke-dasharray: 1200 1200; }
            .au-type { width: 100%; }
          }
        `}</style>

        {/* decoration */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {RINGS.map((r) => (
            <div
              key={r.color}
              className="au-ring absolute left-1/2 top-1/2 h-[620px] w-[620px] rounded-full"
              style={{
                margin: "-310px 0 0 -310px",
                border: `1.5px solid ${r.color}`,
                animationDelay: r.delay,
              }}
            />
          ))}

          <div
            className="au-blob absolute h-[540px] w-[540px] rounded-full"
            style={{
              top: -150,
              left: -110,
              background: "radial-gradient(circle,rgba(99,102,241,.26),transparent 66%)",
            }}
          />
          <div
            className="au-blob-2 absolute h-[580px] w-[580px] rounded-full"
            style={{
              bottom: -180,
              right: -110,
              background: "radial-gradient(circle,rgba(217,70,239,.22),transparent 66%)",
            }}
          />

          <svg
            viewBox="0 0 1000 720"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            style={{ opacity: 0.4 }}
          >
            <polyline
              className="au-dash"
              points="0,556 90,540 170,574 250,502 330,524 410,436 500,468 590,380 670,408 760,314 840,346 930,240 1000,264"
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
            />
            <polyline
              className="au-dash"
              points="0,634 90,626 170,642 250,604 330,616 410,566 500,586 590,536 670,554 760,496 840,516 930,450 1000,466"
              fill="none"
              stroke="#ec4899"
              strokeWidth="1.5"
              style={{ animationDelay: "-2.4s" }}
            />
          </svg>

          {/* scrim: this is what keeps the form readable over the decoration */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(52% 50% at 50% 50%,rgba(247,248,252,.97) 0%,rgba(247,248,252,.72) 58%,rgba(247,248,252,.1) 82%)",
            }}
          />

          {/* side content: hidden below ~900px per the handoff */}
          <div className="absolute left-[46px] top-[112px] hidden w-[290px] flex-col gap-[18px] min-[900px]:flex">
            {FEATURES.map((f, i) => (
              <div key={f.k} className="flex flex-col gap-1">
                <span
                  className="au-mono au-type block font-bold"
                  style={{
                    fontSize: "9.5px",
                    letterSpacing: ".2em",
                    color: f.c,
                    animationDelay: `${i * 1.1}s`,
                  }}
                >
                  {f.k}
                </span>
                <span
                  className="au-mono au-type block"
                  style={{
                    fontSize: "12.5px",
                    color: "rgba(18,21,26,.4)",
                    animationDelay: `${i * 1.1}s`,
                  }}
                >
                  {f.t}
                </span>
              </div>
            ))}
          </div>

          <div className="au-float absolute right-[46px] top-[112px] hidden text-right min-[900px]:block">
            <div
              className="au-mono font-bold"
              style={{ fontSize: "9.5px", letterSpacing: ".2em", color: "rgba(18,21,26,.38)" }}
            >
              WATCH TIME · 30D
            </div>
            <div
              className="mt-1 font-extrabold"
              style={{ fontSize: "28px", letterSpacing: "-.035em", color: "#a855f7" }}
            >
              +318%
            </div>
          </div>

          <div
            className="au-mono absolute bottom-[46px] right-[46px] hidden text-right min-[900px]:block"
            style={{ fontSize: "12px", lineHeight: 1.9, color: "rgba(99,102,241,.6)" }}
          >
            <div>style match ······· 94%</div>
            <div>languages live ····· 90+</div>
          </div>
        </div>

        {/* form column */}
        <div className="relative z-10 w-full max-w-[404px]">

          <h1
            className="au-headline my-3 mb-3 font-extrabold"
            style={{
              fontSize: "37px",
              lineHeight: 1.04,
              letterSpacing: "-.035em",
              color: INK,
              textWrap: "pretty" as never,
            }}
          >
            {title}
            <span className="au-caret" style={{ color: "#ec4899" }}>
              .
            </span>
          </h1>

          <div className="mb-8 flex flex-wrap gap-[6px]">
            {PILLS.map((p) => (
              <span
                key={p.label}
                className="au-mono font-semibold"
                style={{
                  fontSize: "10.5px",
                  letterSpacing: ".1em",
                  padding: "5px 9px",
                  borderRadius: 999,
                  background: p.bg,
                  color: p.fg,
                }}
              >
                {p.label}
              </span>
            ))}
          </div>

          {children}
        </div>
      </main>

      <Footer />
    </div>
  )
}
