import React from 'react';

/**
 * Token marks, drawn inline.
 *
 * Vector rather than bitmaps so they stay crisp at the small sizes a payment
 * selector uses, and inline so a donation form does not wait on three image
 * requests before it can tell you what it accepts.
 *
 * USDC and USDT are other people's marks, reproduced here only to identify
 * which asset a button sends — the ordinary way a payment option is labelled.
 */

export type TokenId = 'ntzs' | 'usdc' | 'usdt';

export const TOKENS: { id: TokenId; label: string; note: string }[] = [
  { id: 'ntzs', label: 'nTZS', note: 'Tanzanian shilling' },
  { id: 'usdc', label: 'USDC', note: 'US dollar' },
  { id: 'usdt', label: 'USDT', note: 'US dollar' },
];

export default function TokenMark({ token, size = 24, className = '' }: {
  token: TokenId;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    className,
    'aria-hidden': true as const,
    focusable: 'false' as const,
  };

  if (token === 'usdc') {
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#2775CA" />
        {/* Broken ring, opening left and right, as on the USDC mark */}
        <path
          d="M10.6 6.2A11.2 11.2 0 0 0 10.6 25.8"
          fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"
        />
        <path
          d="M21.4 6.2A11.2 11.2 0 0 1 21.4 25.8"
          fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"
        />
        <path
          d="M16 7.4v17.2"
          stroke="#fff" strokeWidth="2" strokeLinecap="round"
        />
        <path
          d="M19.3 12.4c0-1.7-1.5-2.7-3.3-2.7s-3.3 1-3.3 2.6c0 1.5 1.2 2.2 3.3 2.7 2.1.5 3.4 1.2 3.4 2.8 0 1.7-1.5 2.7-3.4 2.7s-3.4-1-3.4-2.8"
          fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (token === 'usdt') {
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg">
        {/* The Tether mark sits on a hexagonal plate, not a circle */}
        <path
          d="M16 0.8 30.4 9.2v13.6L16 31.2 1.6 22.8V9.2z"
          fill="#26A17B"
        />
        <path
          d="M17.6 13.7v-2.2h5V8.2H9.4v3.3h5v2.2c-4.1.19-7.2 1-7.2 2s3.1 1.82 7.2 2v6.8h3.2v-6.8c4.1-.19 7.2-1 7.2-2s-3.1-1.82-7.2-2zm0 3.5v0c-.1 0-.63.04-1.79.04-.93 0-1.58-.03-1.81-.04v0c-3.6-.16-6.28-.79-6.28-1.54s2.68-1.38 6.28-1.54v2.45c.24.02.91.05 1.83.05 1.11 0 1.68-.04 1.77-.05v-2.45c3.59.16 6.27.79 6.27 1.54s-2.68 1.38-6.27 1.54z"
          fill="#fff"
        />
      </svg>
    );
  }

  // nTZS
  return (
    <svg {...common} xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#245A8D" />
      <path
        d="M9.2 6.6A11.2 11.2 0 0 0 9.2 25.4"
        fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"
      />
      <path
        d="M22.8 6.6A11.2 11.2 0 0 1 22.8 25.4"
        fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"
      />
      {/* The shilling stroke, cut by the diagonal */}
      <path d="M12.4 10.2v11.6M19.6 10.2v11.6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12.4 10.2 19.6 21.8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
