"use client";

import { motion } from "motion/react";

/**
 * Animated voice/mic hero — the dubbing analogue of AI Studio's animated bot.
 * A floating microphone with pulsing sound rings and a live equalizer.
 */
export function DubbingVoiceAnimation() {
  const bars = [
    { x: 44, base: 82, h: 14, d: 0.4 },
    { x: 54, base: 74, h: 30, d: 0.15 },
    { x: 64, base: 80, h: 18, d: 0 },
    { x: 132, base: 80, h: 18, d: 0 },
    { x: 142, base: 72, h: 32, d: 0.2 },
    { x: 152, base: 82, h: 14, d: 0.45 },
  ];

  return (
    <div className="flex justify-center">
      <motion.svg
        width="176"
        height="176"
        viewBox="0 0 200 200"
        fill="none"
        role="img"
        aria-label="Animated microphone"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <linearGradient id="dubMicGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>

        {/* Pulsing sound rings */}
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx="100"
            cy="82"
            r="42"
            stroke="#a855f7"
            strokeWidth="2"
            fill="none"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
          />
        ))}

        {/* Soft glow */}
        <circle cx="100" cy="82" r="38" fill="url(#dubMicGrad)" opacity="0.12" />

        {/* Mic capsule + grille */}
        <rect x="86" y="46" width="28" height="56" rx="14" fill="url(#dubMicGrad)" />
        <line x1="92" y1="60" x2="108" y2="60" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" />
        <line x1="92" y1="70" x2="108" y2="70" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" />
        <line x1="92" y1="80" x2="108" y2="80" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" />

        {/* Holder + stand */}
        <path d="M74 84 a26 26 0 0 0 52 0" stroke="url(#dubMicGrad)" strokeWidth="5" fill="none" strokeLinecap="round" />
        <line x1="100" y1="110" x2="100" y2="132" stroke="url(#dubMicGrad)" strokeWidth="5" strokeLinecap="round" />
        <line x1="84" y1="132" x2="116" y2="132" stroke="url(#dubMicGrad)" strokeWidth="5" strokeLinecap="round" />

        {/* Live equalizer bars flanking the mic */}
        {bars.map((b, i) => (
          <motion.rect
            key={i}
            x={b.x}
            width="5"
            rx="2.5"
            fill="url(#dubMicGrad)"
            initial={{ height: 8, y: b.base }}
            animate={{ height: [8, b.h, 8], y: [b.base, b.base - (b.h - 8), b.base] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: b.d, ease: "easeInOut" }}
          />
        ))}
      </motion.svg>
    </div>
  );
}
