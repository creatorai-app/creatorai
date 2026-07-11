"use client"

/**
 * Hannah's animated avatar — a friendly gradient orb with blinking eyes, a smile,
 * and orbiting sparkles. Pure SVG + CSS keyframes (no JS), so it animates the same
 * whether it's the launcher button, the header, or a message avatar.
 */
export default function HannahLogo({
  size = 40,
  className = "",
  animated = true,
}: {
  size?: number
  className?: string
  animated?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Hannah, the Creator AI guide"
    >
      <defs>
        <linearGradient id="hannah-face" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a855f7" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <radialGradient id="hannah-glow" cx="0.5" cy="0.4" r="0.6">
          <stop stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <style>{`
        .hn-float { transform-origin: 32px 32px; animation: hn-float 4s ease-in-out infinite; }
        .hn-eye { transform-origin: center; animation: hn-blink 4.5s ease-in-out infinite; }
        .hn-spark { transform-origin: 32px 32px; animation: hn-orbit 7s linear infinite; }
        .hn-spark-2 { animation-duration: 9s; animation-direction: reverse; }
        @keyframes hn-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes hn-blink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
        @keyframes hn-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .hn-float, .hn-eye, .hn-spark { animation: none; }
        }
      `}</style>

      <g className={animated ? "hn-float" : ""}>
        {/* head */}
        <circle cx="32" cy="32" r="20" fill="url(#hannah-face)" />
        <circle cx="32" cy="32" r="20" fill="url(#hannah-glow)" />
        {/* little antenna */}
        <line x1="32" y1="12" x2="32" y2="7" stroke="url(#hannah-face)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="6" r="2.5" fill="#f472b6" />
        {/* eyes */}
        <g fill="#ffffff">
          <ellipse className={animated ? "hn-eye" : ""} cx="25" cy="30" rx="2.6" ry="3.4" />
          <ellipse className={animated ? "hn-eye" : ""} cx="39" cy="30" rx="2.6" ry="3.4" />
        </g>
        {/* smile */}
        <path d="M25 38 Q32 44 39 38" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        {/* cheeks */}
        <circle cx="21" cy="36" r="2" fill="#ffffff" opacity="0.3" />
        <circle cx="43" cy="36" r="2" fill="#ffffff" opacity="0.3" />
      </g>

      {/* orbiting sparkles */}
      <g className={animated ? "hn-spark" : ""}>
        <path d="M54 20 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 z" fill="#c084fc" />
      </g>
      <g className={animated ? "hn-spark hn-spark-2" : ""}>
        <path d="M10 44 l0.9 2.2 2.2 0.9 -2.2 0.9 -0.9 2.2 -0.9 -2.2 -2.2 -0.9 2.2 -0.9 z" fill="#f9a8d4" />
      </g>
    </svg>
  )
}
