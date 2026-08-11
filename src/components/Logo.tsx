'use client';

import React from 'react';
import {
  LOGO_HEX_PATH, LOGO_SWIRL_PATH, LOGO_SWIRL_ROTATE, LOGO_HEX_STROKE,
} from '@/lib/logo-paths';

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
          d={LOGO_HEX_PATH}
          stroke={`url(#gold-${uid})`}
          strokeWidth={LOGO_HEX_STROKE}
          strokeLinejoin="round"
          fill="none"
        />
        <path d={LOGO_SWIRL_PATH} fill={`url(#gold-${uid})`} />
        <path d={LOGO_SWIRL_PATH} transform={LOGO_SWIRL_ROTATE} fill={`url(#light-${uid})`} />
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
