/**
 * One small animated scene per homepage step.
 *
 * Deliberately a different format from the /how-it-works node graph: these are
 * miniature scenes of the thing happening (a model training, a draft writing
 * itself, a channel growing) rather than boxes joined by wires. Same palette
 * and same beam technique, so the two pages still read as one system.
 *
 * An inline <style> inside an SVG is not scoped to that SVG, so every class and
 * keyframe here is prefixed per scene to avoid colliding with the others or
 * with HannahLogo.
 *
 * Pure SVG plus CSS, no JavaScript, and each scene stops under reduced motion.
 */

/** All three scenes share one palette but need their OWN gradient ids: an id is
 *  document-global, so reusing one across three inline SVGs would emit three
 *  duplicate ids and every reference would resolve to whichever rendered first. */
function SceneDefs({ ns }: { ns: string }) {
  return (
    <>
      <linearGradient id={`${ns}-core`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#8b5cf6" />
        <stop offset="0.55" stopColor="#6366f1" />
        <stop offset="1" stopColor="#0891b2" />
      </linearGradient>
      <linearGradient id={`${ns}-beam`} x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#a855f7" />
        <stop offset="0.5" stopColor="#6366f1" />
        <stop offset="1" stopColor="#06b6d4" />
      </linearGradient>
    </>
  )
}

/** Step 1: the channel connects, then the model trains to completion. */
function ConnectScene({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Animation: a YouTube channel connects to a model, which builds its AI memory"
    >
      <defs>
        <SceneDefs ns="s1" />
      </defs>
      <style>{`
        .s1-beam {
          stroke-dasharray: 20 80;
          stroke-dashoffset: 100;
          animation: s1-run 4s cubic-bezier(0.4, 0, 0.5, 1) infinite;
        }
        .s1-train {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          transform: rotate(-90deg);
          transform-origin: 158px 70px;
          animation: s1-fill 4s ease-in-out infinite;
        }
        .s1-bar { animation: s1-speak 0.9s ease-in-out infinite alternate; }
        .s1-b2 { animation-duration: 1.3s; }
        .s1-b3 { animation-duration: 0.7s; }
        .s1-tick { animation: s1-pop 4s ease-out infinite; }
        @keyframes s1-run {
          0%       { stroke-dashoffset: 100; opacity: 0; }
          6%       { opacity: 1; }
          34%      { stroke-dashoffset: 0; opacity: 1; }
          42%,100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes s1-fill {
          0%, 30%   { stroke-dashoffset: 100; }
          78%, 100% { stroke-dashoffset: 0; }
        }
        @keyframes s1-speak { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }
        @keyframes s1-pop {
          0%, 74%   { opacity: 0; transform: scale(0.5); }
          84%, 96%  { opacity: 1; transform: scale(1); }
          100%      { opacity: 0; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .s1-beam, .s1-train, .s1-bar, .s1-tick { animation: none; }
          .s1-beam { stroke-dasharray: none; stroke-dashoffset: 0; opacity: 0.55; }
          .s1-train { stroke-dashoffset: 0; }
          .s1-tick { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* channel */}
      <rect x="14" y="48" width="64" height="44" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="30" y="60" width="32" height="20" rx="6" fill="#f1f5f9" />
      <path d="M42 65 l9 5 -9 5 z" fill="#ef4444" />

      {/* wire */}
      <path d="M78 70 H118" pathLength="100" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M78 70 H118"
        pathLength="100"
        stroke="url(#s1-beam)"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="s1-beam"
      />

      {/* model, with the training ring filling around it */}
      <circle
        className="s1-train"
        cx="158"
        cy="70"
        r="34"
        pathLength="100"
        fill="none"
        stroke="url(#s1-beam)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="158" cy="70" r="34" fill="none" stroke="#eef2ff" strokeWidth="3" />
      <rect x="134" y="46" width="48" height="48" rx="14" fill="url(#s1-core)" />
      <g fill="#ffffff">
        <rect className="s1-bar" x="146" y="63" width="4" height="14" rx="2" style={{ transformOrigin: "148px 70px" }} />
        <rect className="s1-bar s1-b2" x="155" y="58" width="4" height="24" rx="2" style={{ transformOrigin: "157px 70px" }} />
        <rect className="s1-bar s1-b3" x="164" y="65" width="4" height="10" rx="2" style={{ transformOrigin: "166px 70px" }} />
      </g>

      {/* trained */}
      <g className="s1-tick" style={{ transformOrigin: "188px 42px" }}>
        <circle cx="188" cy="42" r="11" fill="#059669" />
        <path d="M183 42 l3.5 3.5 6.5 -7" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  )
}

/** Step 2: a draft writes itself, line by line, and a thumbnail lands beside it. */
function CreateScene({ className = "" }: { className?: string }) {
  const lines = [
    { y: 46, w: 58, d: "0s" },
    { y: 58, w: 74, d: "0.45s" },
    { y: 70, w: 48, d: "0.9s" },
    { y: 82, w: 68, d: "1.35s" },
    { y: 94, w: 38, d: "1.8s" },
  ]

  return (
    <svg
      viewBox="0 0 220 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Animation: a script writes itself line by line while a thumbnail is generated alongside"
    >
      <defs>
        <SceneDefs ns="s2" />
      </defs>
      <style>{`
        .s2-line {
          transform-origin: left center;
          animation: s2-type 4s ease-out infinite;
        }
        .s2-caret { animation: s2-blink 0.9s steps(1) infinite; }
        .s2-thumb { animation: s2-land 4s ease-out infinite; }
        .s2-shine { animation: s2-sweep 4s ease-in-out infinite; }
        @keyframes s2-type {
          0%, 4%    { transform: scaleX(0); }
          16%, 88%  { transform: scaleX(1); }
          96%, 100% { transform: scaleX(0); }
        }
        @keyframes s2-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        @keyframes s2-land {
          0%, 44%   { opacity: 0; transform: translateY(8px) scale(0.92); }
          58%, 90%  { opacity: 1; transform: translateY(0) scale(1); }
          100%      { opacity: 0; transform: translateY(8px) scale(0.92); }
        }
        @keyframes s2-sweep {
          0%, 50%   { transform: translateX(-30px); opacity: 0; }
          62%       { opacity: 0.7; }
          76%, 100% { transform: translateX(34px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .s2-line, .s2-caret, .s2-thumb, .s2-shine { animation: none; }
          .s2-line { transform: scaleX(1); }
          .s2-thumb { opacity: 1; transform: none; }
          .s2-shine { opacity: 0; }
        }
      `}</style>

      {/* the draft */}
      <rect x="16" y="22" width="102" height="96" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="28" y="32" width="30" height="5" rx="2.5" fill="url(#s2-beam)" />
      {lines.map((l) => (
        <rect
          key={l.y}
          className="s2-line"
          x="28"
          y={l.y}
          width={l.w}
          height="5"
          rx="2.5"
          fill="#e2e8f0"
          style={{ animationDelay: l.d }}
        />
      ))}
      <rect className="s2-caret" x="68" y="104" width="2" height="9" rx="1" fill="#6366f1" />

      {/* the thumbnail */}
      <g className="s2-thumb" style={{ transformOrigin: "166px 62px" }}>
        <rect x="130" y="38" width="72" height="48" rx="10" fill="url(#s2-core)" />
        <rect x="130" y="38" width="72" height="48" rx="10" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.5" />
        <path d="M158 54 l12 8 -12 8 z" fill="#ffffff" fillOpacity="0.95" />
        <g clipPath="url(#s2-clip)">
          <rect className="s2-shine" x="150" y="38" width="14" height="48" fill="#ffffff" fillOpacity="0.5" />
        </g>
        <rect x="130" y="94" width="48" height="5" rx="2.5" fill="#e2e8f0" />
        <rect x="130" y="104" width="34" height="5" rx="2.5" fill="#eef2ff" />
      </g>

      <defs>
        <clipPath id="s2-clip">
          <rect x="130" y="38" width="72" height="48" rx="10" />
        </clipPath>
      </defs>
    </svg>
  )
}

/** Step 3: the channel grows, bars rising under a trend line that draws itself. */
function GrowScene({ className = "" }: { className?: string }) {
  const bars = [
    { x: 30, h: 22, d: "0s" },
    { x: 58, h: 36, d: "0.2s" },
    { x: 86, h: 30, d: "0.4s" },
    { x: 114, h: 52, d: "0.6s" },
    { x: 142, h: 68, d: "0.8s" },
  ]

  return (
    <svg
      viewBox="0 0 220 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Animation: channel performance bars rising under an upward trend line"
    >
      <defs>
        <SceneDefs ns="s3" />
      </defs>
      <style>{`
        .s3-bar {
          transform-origin: bottom;
          animation: s3-rise 4s cubic-bezier(0.34, 1.3, 0.64, 1) infinite;
        }
        .s3-trend {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: s3-draw 4s ease-in-out infinite;
        }
        .s3-tip { animation: s3-tip 4s ease-out infinite; }
        .s3-badge { animation: s3-badge 4s ease-out infinite; }
        @keyframes s3-rise {
          0%, 6%    { transform: scaleY(0); }
          30%, 86%  { transform: scaleY(1); }
          96%, 100% { transform: scaleY(0); }
        }
        @keyframes s3-draw {
          0%, 24%   { stroke-dashoffset: 100; }
          56%, 88%  { stroke-dashoffset: 0; }
          98%, 100% { stroke-dashoffset: 100; }
        }
        @keyframes s3-tip {
          0%, 52%   { opacity: 0; transform: scale(0.4); }
          62%, 88%  { opacity: 1; transform: scale(1); }
          100%      { opacity: 0; transform: scale(0.4); }
        }
        @keyframes s3-badge {
          0%, 60%   { opacity: 0; transform: translateY(6px); }
          72%, 90%  { opacity: 1; transform: translateY(0); }
          100%      { opacity: 0; transform: translateY(6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .s3-bar, .s3-trend, .s3-tip, .s3-badge { animation: none; }
          .s3-bar { transform: scaleY(1); }
          .s3-trend { stroke-dashoffset: 0; }
          .s3-tip, .s3-badge { opacity: 1; transform: none; }
        }
      `}</style>

      <line x1="20" y1="112" x2="200" y2="112" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />

      {bars.map((b) => (
        <rect
          key={b.x}
          className="s3-bar"
          x={b.x}
          y={112 - b.h}
          width="16"
          height={b.h}
          rx="5"
          fill="#e9d5ff"
          style={{ transformOrigin: `${b.x + 8}px 112px`, animationDelay: b.d }}
        />
      ))}

      <path
        className="s3-trend"
        d="M38 96 L66 82 L94 88 L122 66 L150 48"
        pathLength="100"
        fill="none"
        stroke="url(#s3-beam)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <g className="s3-tip" style={{ transformOrigin: "150px 48px" }}>
        <circle cx="150" cy="48" r="7" fill="#ffffff" stroke="#6366f1" strokeWidth="3" />
      </g>

      <g className="s3-badge">
        <rect x="150" y="18" width="54" height="22" rx="11" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5" />
        <path d="M161 32 l5 -7 5 7 z" fill="#059669" />
        <text x="185" y="33" textAnchor="middle" fontSize="10" fontWeight="700" fill="#047857">
          Views
        </text>
      </g>
    </svg>
  )
}

export const STEP_SCENES = [ConnectScene, CreateScene, GrowScene] as const
