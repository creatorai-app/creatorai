/**
 * The hero diagram: your channel feeds a trained model, which fans out into
 * every output.
 *
 * Beam technique borrowed from MagicUI's AnimatedBeam: each wire is two stacked
 * paths on the same `d`, a faint static base plus a bright gradient overlay, so
 * the light reads as a pulse travelling the wire rather than marching ants.
 * Every path carries `pathLength="100"`, which normalises dash units so one
 * dasharray drives wires of different real lengths and the stagger stays even.
 *
 * Palette is the site's CTA gradient (purple, indigo, cyan) rather than the
 * purple/pink pair, which skewed the whole diagram pink.
 *
 * Pure SVG plus CSS keyframes, same approach as HannahLogo: no JavaScript, no
 * SMIL, so the reduced-motion guard at the bottom actually stops everything.
 */

const OUTPUTS = [
  { y: 70, label: "Scripts", delay: "0s", wire: "M370 190 C424 190 420 70 470 70" },
  { y: 150, label: "Thumbnails", delay: "0.35s", wire: "M370 190 C424 190 420 150 470 150" },
  { y: 230, label: "Subtitles", delay: "0.7s", wire: "M370 190 C424 190 420 230 470 230" },
  { y: 310, label: "Dubs", delay: "1.05s", wire: "M370 190 C424 190 420 310 470 310" },
]

/** Voice signature bars. Heights and rates differ so it reads as live speech
 *  rather than a loading bar. */
const BARS = [
  { x: 288, h: 14, dur: "1.1s" },
  { x: 297, h: 26, dur: "0.8s" },
  { x: 306, h: 36, dur: "1.4s" },
  { x: 315, h: 22, dur: "0.95s" },
  { x: 324, h: 30, dur: "1.25s" },
]

export default function PipelineSVG({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 620 380"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Diagram: your YouTube channel builds a personal AI memory, which generates scripts, thumbnails, subtitles and dubs"
    >
      <defs>
        <linearGradient id="pl-core" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#6366f1" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="pl-beam" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#a855f7" />
          <stop offset="0.5" stopColor="#6366f1" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <radialGradient id="pl-halo" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#6366f1" stopOpacity="0.22" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
        <filter id="pl-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <style>{`
        .pl-beam {
          stroke-dasharray: 14 86;
          stroke-dashoffset: 100;
          animation: pl-travel 2.8s cubic-bezier(0.4, 0, 0.5, 1) infinite;
        }
        .pl-in { animation-duration: 2.8s; }
        .pl-ring {
          transform-origin: 310px 190px;
          animation: pl-spin 14s linear infinite;
        }
        .pl-ring-2 { animation-duration: 20s; animation-direction: reverse; }
        .pl-pulse {
          transform-origin: 310px 190px;
          animation: pl-expand 3.4s ease-out infinite;
        }
        .pl-bar { animation: pl-speak 1s ease-in-out infinite alternate; }
        .pl-node { animation: pl-arrive 2.8s ease-out infinite; }
        .pl-dot { animation: pl-blip 2.8s ease-out infinite; }

        @keyframes pl-travel {
          0%   { stroke-dashoffset: 100; opacity: 0; }
          8%   { opacity: 1; }
          70%  { opacity: 1; }
          80%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes pl-spin { to { transform: rotate(360deg); } }
        @keyframes pl-expand {
          0%   { transform: scale(0.72); opacity: 0.5; }
          100% { transform: scale(1.45); opacity: 0; }
        }
        @keyframes pl-speak { from { transform: scaleY(0.35); } to { transform: scaleY(1); } }
        @keyframes pl-arrive {
          0%, 62%  { stroke: #e2e8f0; }
          74%      { stroke: #818cf8; }
          92%, 100% { stroke: #e2e8f0; }
        }
        @keyframes pl-blip {
          0%, 62%   { fill: #c4b5fd; transform: scale(1); }
          74%       { fill: #4f46e5; transform: scale(1.5); }
          92%, 100% { fill: #c4b5fd; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pl-beam, .pl-ring, .pl-pulse, .pl-bar, .pl-node, .pl-dot { animation: none; }
          .pl-beam { stroke-dasharray: none; stroke-dashoffset: 0; opacity: 0.55; }
          .pl-pulse { opacity: 0.18; }
        }
      `}</style>

      <ellipse cx="310" cy="190" rx="190" ry="140" fill="url(#pl-halo)" />

      {/* input wire */}
      <path d="M150 190 H250" pathLength="100" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M150 190 H250"
        pathLength="100"
        stroke="url(#pl-beam)"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="pl-beam pl-in"
      />

      {/* output wires: faint base, then the travelling beam */}
      {OUTPUTS.map((out) => (
        <path key={out.label} d={out.wire} pathLength="100" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
      ))}
      {OUTPUTS.map((out) => (
        <path
          key={`beam-${out.label}`}
          d={out.wire}
          pathLength="100"
          stroke="url(#pl-beam)"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="pl-beam"
          style={{ animationDelay: out.delay }}
        />
      ))}

      {/* your channel */}
      <g>
        <rect x="40" y="155" width="110" height="70" rx="16" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
        <rect x="62" y="176" width="42" height="28" rx="8" fill="#f1f5f9" />
        <path d="M78 183 l12 7 -12 7 z" fill="#ef4444" />
        <text x="95" y="215" textAnchor="middle" fontSize="11" fontWeight="600" fill="#64748b">
          Your channel
        </text>
      </g>

      {/* the trained voice model */}
      <g>
        <circle className="pl-pulse" cx="310" cy="190" r="62" fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
        <circle
          className="pl-ring"
          cx="310"
          cy="190"
          r="74"
          fill="none"
          stroke="#c7d2fe"
          strokeWidth="1.5"
          strokeDasharray="3 9"
          strokeLinecap="round"
        />
        <circle
          className="pl-ring pl-ring-2"
          cx="310"
          cy="190"
          r="84"
          fill="none"
          stroke="#a5f3fc"
          strokeWidth="1.5"
          strokeDasharray="2 14"
          strokeLinecap="round"
        />

        <rect x="250" y="130" width="120" height="120" rx="30" fill="url(#pl-core)" />
        <rect
          x="250"
          y="130"
          width="120"
          height="120"
          rx="30"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.28"
          strokeWidth="1.5"
        />

        {/* voice signature, not a generic sparkle */}
        <g filter="url(#pl-glow)">
          {BARS.map((bar) => (
            <rect
              key={bar.x}
              className="pl-bar"
              x={bar.x}
              y={178 - bar.h / 2}
              width="5"
              height={bar.h}
              rx="2.5"
              fill="#ffffff"
              style={{ transformOrigin: `${bar.x + 2.5}px 178px`, animationDuration: bar.dur }}
            />
          ))}
        </g>

        <text x="310" y="226" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#ffffff" letterSpacing="1.2">
          YOUR VOICE
        </text>
      </g>

      {/* outputs */}
      {OUTPUTS.map((out) => (
        <g key={out.label}>
          <rect
            className="pl-node"
            x="470"
            y={out.y - 24}
            width="118"
            height="48"
            rx="14"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="2"
            style={{ animationDelay: out.delay }}
          />
          <circle cx="496" cy={out.y} r="9" fill="#eef2ff" />
          <circle
            className="pl-dot"
            cx="496"
            cy={out.y}
            r="3.5"
            fill="#c4b5fd"
            style={{ transformOrigin: `496px ${out.y}px`, animationDelay: out.delay }}
          />
          <text x="514" y={out.y + 4} fontSize="12" fontWeight="600" fill="#475569">
            {out.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
