'use client';

import React from 'react';

interface LogoProps {
  className?: string;
  /** Render only the hexagon mark, without the wordmark. */
  markOnly?: boolean;
}

/**
 * WashikaDAO logo — inline SVG so it inherits the page font and adapts to the
 * `.dark` theme class without any React state or hydration flash.
 *
 *   • Hexagon + interlocking "unity hands" swirl (always gold/cream)
 *   • Wordmark: "Washika" in the foreground colour, "DAU" in brand gold
 */
export default function Logo({ className = '', markOnly = false }: LogoProps) {
  const viewBox = markOnly ? '0 0 100 100' : '0 0 372 104';
  const uid = React.useId().replace(/:/g, '');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="none"
      className={className}
      aria-label="Washika DAU"
      role="img"
    >
      <defs>
        <linearGradient id={`gold-${uid}`} x1="18" y1="8" x2="82" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F6C048" />
          <stop offset="0.55" stopColor="#E4A233" />
          <stop offset="1" stopColor="#C97E22" />
        </linearGradient>
        <linearGradient id={`light-${uid}`} x1="30" y1="40" x2="72" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E9E2D4" />
        </linearGradient>
      </defs>

      <style>{`
        .wd-word { fill: #1a1712; }
        :root.dark .wd-word { fill: #f7f4ee; }
      `}</style>

      {/* ── Mark ── */}
      <g>
        <path
          d="M31 8 H69 L92 50 L69 92 H31 L8 50 Z"
          stroke={`url(#gold-${uid})`}
          strokeWidth="6.5"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M47 53 C42.5 44.5 47 33.5 58 31.5 C69 29.5 77.5 38.5 76 49
             C74.8 57.5 67 62 58.5 60.5 C64 57.5 65.5 50 60 46.5
             C53.5 42.5 46.5 47 47 53 Z"
          fill={`url(#gold-${uid})`}
        />
        <path
          d="M47 53 C42.5 44.5 47 33.5 58 31.5 C69 29.5 77.5 38.5 76 49
             C74.8 57.5 67 62 58.5 60.5 C64 57.5 65.5 50 60 46.5
             C53.5 42.5 46.5 47 47 53 Z"
          transform="rotate(180 50 50)"
          fill={`url(#light-${uid})`}
        />
      </g>

      {/* ── Wordmark ── */}
      {!markOnly && (
        <text
          x="112"
          y="64"
          fontFamily="var(--font-sans), ui-sans-serif, system-ui, sans-serif"
          fontWeight="700"
          fontSize="42"
          letterSpacing="-0.5"
        >
          <tspan className="wd-word">Washika</tspan>
          <tspan fill={`url(#gold-${uid})`}>DAU</tspan>
        </text>
      )}
    </svg>
  );
}
