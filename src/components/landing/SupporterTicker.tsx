'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * The gifts as they land — a course of the wall, laying itself.
 *
 * A scrolling marquee was the obvious move and the wrong one: with three
 * supporters it loops visibly and reads as decoration rather than record. So
 * this spotlights one gift at a time and steps along a row of bricks beneath,
 * which works the same at three names or thirty, and says the thing the whole
 * section is about — the wall goes up one brick at a time.
 *
 * Everything here is real. If nobody has given yet the component renders
 * nothing at all, because an empty ticker dressed with placeholder names would
 * be inventing other people's generosity.
 */

type Supporter = {
  name: string;
  amountTzs: number;
  token: string | null;
  tokenAmount: number | null;
  method: string;
  at: string;
};

const ROTATE_MS = 4500;
const POLL_MS = 45_000;

/** Initials for the brick face. Two letters at most, so it stays a mark. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ago(iso: string, sw: boolean): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 90) return sw ? 'sasa hivi' : 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return sw ? `dakika ${mins} zilizopita` : `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return sw ? `saa ${hrs} zilizopita` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return sw ? `siku ${days} zilizopita` : `${days}d ago`;
  const months = Math.round(days / 30);
  return sw ? `miezi ${months} iliyopita` : `${months}mo ago`;
}

export default function SupporterTicker() {
  const { language } = useLanguage();
  const sw = language === 'sw';

  const [rows, setRows] = useState<Supporter[]>([]);
  const [i, setI] = useState(0);
  // Set when a poll turns up a gift that was not there before, so an arrival
  // announces itself instead of quietly taking its turn.
  const [arrived, setArrived] = useState(false);
  const newestRef = useRef<string | null>(null);

  const reduced = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/public/supporters');
        if (!res.ok) return;
        const d = await res.json();
        if (!alive || !Array.isArray(d.supporters)) return;
        const list = d.supporters as Supporter[];
        const newest = list[0] ? `${list[0].name}|${list[0].at}` : null;
        if (newestRef.current && newest && newest !== newestRef.current) {
          setArrived(true);
          setI(0); // show the gift that just landed, not whatever was next
          setTimeout(() => setArrived(false), 2600);
        }
        newestRef.current = newest;
        setRows(list);
      } catch {
        // A ticker that cannot reach the server simply keeps the last names.
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Advance the spotlight. Paused when there is nothing to advance to, and
  // never started for a visitor who asked for less motion.
  useEffect(() => {
    if (reduced || rows.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % rows.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [reduced, rows.length]);

  if (rows.length === 0) return null;

  const active = rows[Math.min(i, rows.length - 1)];
  const isToken = !!active.token && active.tokenAmount != null && active.tokenAmount > 0;

  return (
    <div className="mt-4 border-2 border-rule">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping bg-gold opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 bg-gold-deep" />
          </span>
          <span className="wd-kicker">{sw ? 'Ukuta unapanda' : 'The wall is rising'}</span>
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">
          {rows.length === 1
            ? (sw ? 'Tofali 1' : '1 brick')
            : (sw ? `Tofali ${rows.length}` : `${rows.length} bricks`)}
        </span>
      </div>

      {/* The spotlight. Keyed on the index so React remounts it each turn and
          the entry animation actually replays. */}
      <div className="px-5 py-5">
        <div
          key={i}
          className={`flex items-center gap-3.5 ${reduced ? '' : 'wd-brick-in'} ${
            arrived ? 'wd-brick-arrive' : ''
          }`}
        >
          <span
            className="flex h-11 w-11 flex-none items-center justify-center border border-gold-deep bg-gold/15 font-mono text-[12px] font-bold text-gold-deep"
            aria-hidden
          >
            {initials(active.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[19px] font-bold leading-tight">
              {active.name}
            </span>
            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
              {ago(active.at, sw)}
              {arrived && (
                <span className="ml-2 text-gold-deep">{sw ? '· imeingia' : '· just landed'}</span>
              )}
            </span>
          </span>
          <span className="flex-none text-right">
            <span className="block wd-figure text-[19px] leading-none text-gold-deep">
              {isToken
                ? `${Number(active.tokenAmount).toLocaleString()}`
                : Math.round(active.amountTzs).toLocaleString('en-US')}
            </span>
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">
              {isToken ? String(active.token).toUpperCase() : 'TZS'}
            </span>
          </span>
        </div>
      </div>

      {/* The course beneath: one brick per recent gift, the current one filled.
          It doubles as the position indicator, so the rotation never feels
          like it is happening to you without your knowing where it is. */}
      {rows.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-5 py-3.5">
          {rows.map((s, n) => (
            <button
              key={`${s.name}-${s.at}-${n}`}
              onClick={() => setI(n)}
              aria-label={s.name}
              className={`h-2.5 w-7 border transition-colors ${
                n === i
                  ? 'border-gold-deep bg-gold'
                  : 'border-rule bg-transparent hover:border-gold-deep'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
