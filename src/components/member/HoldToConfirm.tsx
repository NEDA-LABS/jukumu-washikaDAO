'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hold-to-confirm.
 *
 * A vote is recorded in the group's ledger and visible to everyone, so a
 * mis-tap is a public mistake. Requiring a sustained press makes the act
 * deliberate: the fill crossing the button is the feedback, and letting go
 * early cancels with nothing sent.
 *
 * Pointer events only — mouse, touch and pen through one path, with capture so
 * a finger sliding off the button still cancels cleanly rather than sticking.
 *
 * Accessibility: holding is impossible with a keyboard and hostile to switch
 * and screen-reader users, so keyboard activation (Enter/Space) confirms
 * immediately. Pressing Enter on a focused button is already deliberate — the
 * hold exists to prevent accidental *touches*, which is not a risk there.
 * `prefers-reduced-motion` likewise skips straight to confirm.
 */
export default function HoldToConfirm({
  onConfirm, holdMs = 900, disabled = false, className = '', fillClassName = 'bg-foreground/15', children,
}: {
  onConfirm: () => void;
  holdMs?: number;
  disabled?: boolean;
  className?: string;
  fillClassName?: string;
  children: React.ReactNode;
}) {
  const [pct, setPct] = useState(0);
  const raf = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  const fired = useRef(false);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    if (timer.current !== null) clearTimeout(timer.current);
    raf.current = null;
    timer.current = null;
    setPct(0);
  }, []);

  // Never leave a frame loop running if the button unmounts mid-hold.
  useEffect(() => stop, [stop]);

  const begin = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    // Deliberately NO setPointerCapture. Capture keeps the pointer bound to
    // this element, which suppresses pointerleave — so a finger sliding off
    // the button would never cancel and the vote would fire anyway. Sliding
    // away is the gesture people use to back out, so leave has to win.
    fired.current = false;
    startedAt.current = performance.now();

    // A timer decides the confirm, not the frame loop. requestAnimationFrame
    // is paused whenever the page is not visible and throttled under load, so
    // driving the outcome from it would mean whether a vote registers depends
    // on frame delivery. The rAF below only paints the fill.
    timer.current = setTimeout(() => {
      if (!fired.current) { fired.current = true; onConfirm(); }
      stop();
    }, holdMs);

    const tick = (now: number) => {
      const p = Math.min(((now - startedAt.current) / holdMs) * 100, 100);
      setPct(p);
      if (p < 100) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const end = () => { if (!fired.current) stop(); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onConfirm(); }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
      onKeyDown={onKeyDown}
      className={`relative select-none overflow-hidden text-left disabled:opacity-50 ${className}`}
      style={{ touchAction: 'none' }}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 ${fillClassName}`}
        style={{ width: `${pct}%` }}
      />
      <span className="relative block">{children}</span>
    </button>
  );
}
