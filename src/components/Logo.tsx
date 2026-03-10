'use client';

import React from 'react';

interface LogoProps {
  className?: string;
}

/**
 * Inline SVG logo — responds to the document's `.dark` CSS class via internal
 * <style>, so it works with the JS-toggled theme without any React state or
 * hydration flash.
 *
 * Light mode:  "Washika" in dark navy (#1a1a2e), hexagon + "DAU" in amber (#f0a500)
 * Dark mode:   "Washika" in white (#ffffff), hexagon + "DAU" in amber (#f0a500)
 */
export default function Logo({ className = '' }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 220 56"
      fill="none"
      className={className}
      aria-label="Washika DAU"
      role="img"
    >
      <style>{`
        .logo-text   { fill: #1a1a2e; }
        .logo-hand   { fill: #1a1a2e; }
        .logo-accent { fill: #f0a500; stroke: #f0a500; }
        .logo-hex    { stroke: #f0a500; }
        :root.dark .logo-text  { fill: #ffffff; }
        :root.dark .logo-hand  { fill: #ffffff; }
      `}</style>

      {/* Hexagon frame — always amber */}
      <polygon
        points="28,6 48,6 58,22 48,38 28,38 18,22"
        className="logo-hex"
        strokeWidth="2.5"
        fill="none"
        strokeLinejoin="round"
      />

      {/* Amber hand (front) */}
      <path
        d="M25,29 C25,20 32,15 38,19 C44,23 44,30 38,32 C32,34 25,29 25,29Z"
        className="logo-accent"
        stroke="none"
        opacity="0.9"
      />

      {/* Theme-adaptive hand (back) */}
      <path
        d="M50,17 C50,26 43,31 37,27 C31,23 31,16 37,14 C43,12 50,17 50,17Z"
        className="logo-hand"
        stroke="none"
        opacity="0.85"
      />

      {/* "Washika" — dark in light mode, white in dark mode */}
      <text
        x="70"
        y="25"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
        fontWeight="700"
        fontSize="16"
        className="logo-text"
        letterSpacing="0.3"
      >
        Washika
      </text>

      {/* "DAU" — always amber */}
      <text
        x="70"
        y="43"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
        fontWeight="700"
        fontSize="14"
        className="logo-accent"
        stroke="none"
        letterSpacing="2.5"
      >
        DAU
      </text>
    </svg>
  );
}
