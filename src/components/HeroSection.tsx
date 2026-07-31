'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import AnimatedBackground from '@/components/AnimatedBackground';

/* ── Count-up hook ─────────────────────────────────────────────── */
function useCountUp(target: number, durationMs = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) { setValue(0); return; }
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

/* ── Live platform metrics ─────────────────────────────────────── */
type Stats = {
  groups: number; members: number; businesses: number;
  trainings: number; volumeTzs: number; heldTzs: number; live: boolean;
};

function usePlatformStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/public/stats')
      .then((r) => r.json())
      .then((d) => { if (alive) setStats(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return stats;
}

/** Compact money: 12_400_000 → "12.4M" */
function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

/* ── Illustrated member avatar ─────────────────────────────────── */
type Persona = {
  skin: string; cloth: string; hair: string;
  style: 'afro' | 'bun' | 'wrap' | 'fade';
  badge: 'save' | 'learn' | 'invest' | 'join';
};

const PERSONAS: Persona[] = [
  { skin: '#8d5524', cloth: '#d1622b', hair: '#2b1d14', style: 'afro',  badge: 'save' },
  { skin: '#c68642', cloth: '#0f9d76', hair: '#1c1410', style: 'bun',   badge: 'learn' },
  { skin: '#6b4423', cloth: '#3b82f6', hair: '#e4a233', style: 'wrap',  badge: 'invest' },
  { skin: '#a8683a', cloth: '#8b5cf6', hair: '#241812', style: 'fade',  badge: 'join' },
];

const BADGE: Record<Persona['badge'], { bg: string; path: string }> = {
  save:   { bg: '#e4a233', path: 'M8 3.2c2.6 0 4.8.9 4.8 2s-2.2 2-4.8 2-4.8-.9-4.8-2 2.2-2 4.8-2zM3.2 5.2v5.6c0 1.1 2.2 2 4.8 2s4.8-.9 4.8-2V5.2' },
  learn:  { bg: '#d1622b', path: 'M8 4.6C7 3.9 5.3 3.6 3 3.6v8.2c2.3 0 4 .3 5 1 1-.7 2.7-1 5-1V3.6c-2.3 0-4 .3-5 1z' },
  invest: { bg: '#16a34a', path: 'M2.8 12.4h10.4M5.2 10.4V6.6M8 10.4V3.6M10.8 10.4V7.8' },
  join:   { bg: '#3b82f6', path: 'M8 8.4a2.4 2.4 0 100-4.8 2.4 2.4 0 000 4.8zM3.4 13a4.6 4.6 0 019.2 0' },
};

function AvatarArt({ p }: { p: Persona }) {
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`bg-${p.style}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor={p.cloth} stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" fill={`url(#bg-${p.style})`} />

      {/* hair behind the head */}
      {p.style === 'afro' && <circle cx="20" cy="15" r="11" fill={p.hair} />}
      {p.style === 'bun' && <circle cx="20" cy="6.5" r="4" fill={p.hair} />}
      {p.style === 'wrap' && <path d="M9 15a11 11 0 0122 0c0 2-3 3-11 3S9 17 9 15z" fill={p.hair} />}

      {/* shoulders */}
      <path d="M4 40c0-8 7.2-12 16-12s16 4 16 12z" fill={p.cloth} />
      {/* collar */}
      <path d="M16 28.5c1.2 2 6.8 2 8 0l-4 3.5z" fill="#ffffff" fillOpacity="0.35" />
      {/* neck */}
      <rect x="16.6" y="21" width="6.8" height="8" rx="3.4" fill={p.skin} />
      {/* head */}
      <circle cx="20" cy="16" r="8.2" fill={p.skin} />

      {/* hair in front */}
      {p.style === 'fade' && <path d="M11.9 14.4a8.2 8.2 0 0116.2 0c-2.4-2.2-13.8-2.2-16.2 0z" fill={p.hair} />}
      {p.style === 'bun' && <path d="M11.9 14.9a8.2 8.2 0 0116.2 0c-2-3.4-14.2-3.4-16.2 0z" fill={p.hair} />}
      {p.style === 'afro' && <path d="M12 14.6a8.2 8.2 0 0116 0c-2.2-2.6-13.8-2.6-16 0z" fill={p.hair} fillOpacity="0.85" />}

      {/* face */}
      <circle cx="17.1" cy="16.2" r="0.95" fill="#1f1b16" />
      <circle cx="22.9" cy="16.2" r="0.95" fill="#1f1b16" />
      <path d="M17.4 19.4c1.4 1.3 3.8 1.3 5.2 0" stroke="#1f1b16" strokeOpacity="0.75" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function MemberBubble({ x, y, delay, seed }: { x: string; y: string; delay: number; seed: number }) {
  const p = PERSONAS[seed % PERSONAS.length];
  const b = BADGE[p.badge];
  return (
    <div className="absolute" style={{ left: x, top: y, animation: `wd-bob 5.5s ease-in-out ${delay}s infinite` }}>
      <div className="relative">
        <div
          className="h-10 w-10 sm:h-[52px] sm:w-[52px] rounded-full p-[2px] shadow-xl"
          style={{ background: `linear-gradient(135deg, ${p.cloth}, #e4a233)` }}
        >
          <div className="h-full w-full overflow-hidden rounded-full bg-card ring-1 ring-black/5">
            <AvatarArt p={p} />
          </div>
        </div>
        <span
          className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-card shadow"
          style={{ background: b.bg }}
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={b.path} />
          </svg>
        </span>
      </div>
    </div>
  );
}

/* ── Live activity ticker ──────────────────────────────────────── */
function ActivityTicker() {
  const { t } = useLanguage();
  const lines = [t('hero.ticker.1'), t('hero.ticker.2'), t('hero.ticker.3'), t('hero.ticker.4')];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % lines.length), 2800);
    return () => clearInterval(id);
  }, [lines.length]);
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card/95 backdrop-blur-md px-3.5 py-2.5 shadow-xl">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 shrink-0">{t('hero.live')}</span>
      <span key={i} className="wd-ticker-in text-xs text-foreground/80 truncate min-w-0">{lines[i]}</span>
    </div>
  );
}

/* ── Circular-economy orbit visual ─────────────────────────────── */
function OrbitNode({ angle, icon, label, accent }: { angle: number; icon: React.ReactNode; label: string; accent: string }) {
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{ transform: `translate(-50%, -50%) translate(calc(cos(${angle}deg) * var(--r)), calc(sin(${angle}deg) * var(--r)))` }}
    >
      {/* counter-rotate so the chip stays upright while the ring spins */}
      <div style={{ animation: 'wd-spin-rev 32s linear infinite' }}>
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-lg"
            style={{ color: accent }}
          >
            {icon}
          </div>
          <span className="rounded-full bg-card/90 px-2 sm:px-2.5 py-0.5 text-[9px] sm:text-[11px] font-semibold text-foreground shadow-sm border border-border whitespace-nowrap">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

function CircularEconomyViz() {
  const { t } = useLanguage();
  const iconCls = 'h-6 w-6';
  return (
    <div className="mx-auto w-full max-w-[248px] sm:max-w-[360px] lg:max-w-[440px]">
    <div className="relative aspect-square w-full">
      {/* Softened well below the old value: a diffuse glow reads as gloss, and
          this system gets its depth from rules and flat fills instead. */}
      <div aria-hidden className="absolute inset-[12%] rounded-full bg-gold/[0.07] blur-3xl wd-round" />

      <div className="absolute inset-0" style={{ animation: 'wd-spin 32s linear infinite' }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <circle
            cx="50" cy="50" r="38" fill="none"
            stroke="var(--ds-gold)" strokeOpacity="0.5" strokeWidth="0.6" strokeDasharray="4 4"
            style={{ animation: 'wd-dash 40s linear infinite' }}
          />
        </svg>
        <div className="absolute inset-0 [--r:82px] sm:[--r:138px] lg:[--r:168px]">
          <OrbitNode angle={-90} icon={<CoinsIcon className={iconCls} />} label={t('hero.node.save')} accent="#e4a233" />
          <OrbitNode angle={30} icon={<BookIcon className={iconCls} />} label={t('hero.node.learn')} accent="#d1622b" />
          <OrbitNode angle={150} icon={<ChartIcon className={iconCls} />} label={t('hero.node.invest')} accent="#16a34a" />
        </div>
      </div>

      <div aria-hidden className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e4a233]/40" style={{ animation: 'wd-pulse-ring 3s ease-out infinite' }} />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e4a233]/40" style={{ animation: 'wd-pulse-ring 3s ease-out 1.5s infinite' }} />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center bg-gold"
          style={{ clipPath: HEX_CLIP }}
        >
          <div className="flex flex-col items-center text-white">
            <HexMark className="h-9 w-9 sm:h-10 sm:w-10" />
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider opacity-90">{t('hero.node.center')}</span>
          </div>
        </div>
      </div>

      {/* Corner-anchored, outside the label span, so the rotating orbit chips
          never collide with them (the section clips any slight overhang). */}
      <MemberBubble x="-10%" y="4%" delay={0} seed={0} />
      <MemberBubble x="88%" y="0%" delay={0.8} seed={1} />
      <MemberBubble x="92%" y="68%" delay={1.6} seed={2} />
        <MemberBubble x="-12%" y="64%" delay={2.2} seed={3} />
      </div>

      {/* Sits under the square so the rotating labels never collide with it */}
      <div className="mx-auto -mt-1 w-[96%] max-w-xs">
        <ActivityTicker />
      </div>
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────────── */
function CoinsIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3" /><path strokeLinecap="round" d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6" /><path strokeLinecap="round" d="M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" /></svg>);
}
function BookIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 5.5 8 5 4 5v13c4 0 6.5.5 8 1.5 1.5-1 4-1.5 8-1.5V5c-4 0-6.5.5-8 1.5z" /><path strokeLinecap="round" d="M12 6.5V19" /></svg>);
}
function ChartIcon({ className }: { className?: string }) {
  return (<svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 16V9m5 7V5m5 11v-4" /></svg>);
}
function HexMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2.5l8 4.5v9l-8 4.5-8-4.5v-9l8-4.5z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" opacity="0.9" />
      <path d="M8.5 13.5c1.2 1.6 5.8 1.6 7 0" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1.1" fill="white" />
      <circle cx="15" cy="10" r="1.1" fill="white" />
    </svg>
  );
}

/* ── Stat tiles ────────────────────────────────────────────────── */
function StatTile({ value, label, loading }: { value: string; label: string; loading: boolean }) {
  return (
    <div className="group rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-3 py-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-gold/50 hover:shadow-md">
      {loading ? (
        <div className="h-7 w-14 rounded-md bg-muted animate-pulse" />
      ) : (
        <div className="font-display text-2xl sm:text-3xl text-foreground group-hover:text-gold transition-colors tabular-nums">{value}</div>
      )}
      <div className="mt-1 text-xs sm:text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function MoneyTile({ value, label, accent, loading }: { value: string; label: string; accent: string; loading: boolean }) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-card/70 backdrop-blur-sm px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:border-gold/50 hover:shadow-md">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      {loading ? (
        <div className="mt-1.5 h-6 w-24 rounded-md bg-muted animate-pulse" />
      ) : (
        <div className="mt-0.5 font-display text-xl sm:text-2xl text-foreground tabular-nums">
          <span className="text-sm text-muted-foreground mr-1">TSh</span>{value}
        </div>
      )}
    </div>
  );
}

/* ── Hero content ──────────────────────────────────────────────── */
function HeroContent() {
  const { t } = useLanguage();
  const stats = usePlatformStats();
  const loading = stats === null;

  const groups = useCountUp(stats?.groups ?? 0);
  const biz = useCountUp(stats?.businesses ?? 0);
  const trainings = useCountUp(stats?.trainings ?? 0);
  const volume = useCountUp(stats?.volumeTzs ?? 0);
  const held = useCountUp(stats?.heldTzs ?? 0);

  return (
    <div className="wd-container grid gap-5 sm:gap-7 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-0 lg:items-center pt-[7.5rem] pb-14 sm:pt-32 sm:pb-16 lg:py-20">

      {/* A — brand block (first on mobile, top-left on desktop) */}
      <div className="flex flex-col items-center text-center lg:col-start-1 lg:row-start-1 lg:items-start lg:text-left lg:self-end lg:pb-5">
        <div className="wd-rise inline-flex items-center gap-2 px-4 py-2 mb-5 rounded-full border border-border bg-card/70 backdrop-blur-sm shadow-sm" style={{ animationDelay: '0ms' }}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          <span className="text-foreground/70 text-xs sm:text-sm font-medium tracking-wide">{t('tagline')}</span>
        </div>

        <h1 className="wd-rise text-[3rem] leading-[0.98] sm:text-7xl lg:text-[5.25rem] text-foreground" style={{ animationDelay: '80ms' }}>
          Washika<span className="text-gold"> DAU</span>
        </h1>
        <p className="wd-rise mt-3 font-display text-2xl sm:text-3xl text-foreground/55 italic" style={{ animationDelay: '140ms' }}>
          {t('hero.motto')}
        </p>
      </div>

      {/* B — visual (second on mobile, full right column on desktop) */}
      <div
        className="wd-rise lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center"
        style={{ animationDelay: '220ms' }}
      >
        <CircularEconomyViz />
      </div>

      {/* C — pitch, CTAs, live metrics (last on mobile, bottom-left on desktop) */}
      <div className="flex flex-col items-center text-center lg:col-start-1 lg:row-start-2 lg:items-start lg:text-left lg:self-start">
        <p className="wd-rise mt-2 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-md" style={{ animationDelay: '260ms' }}>
          {t('hero.subtitle')}
        </p>

        <div className="wd-rise mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto" style={{ animationDelay: '320ms' }}>
          <Link href="/register" className="wd-press group inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground text-sm font-semibold transition-colors duration-200 hover:bg-gold-deep hover:text-background">
            {t('hero.cta.join')}
            <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
          <Link href="/learn" className="wd-press inline-flex items-center justify-center gap-2 px-8 py-3.5 text-foreground text-sm font-semibold border-2 border-foreground hover:bg-foreground hover:text-background transition-colors duration-200">
            {t('hero.learn_more')}
          </Link>
        </div>

        {/* Live metrics */}
        <div className="wd-rise mt-9 w-full max-w-md space-y-2.5" style={{ animationDelay: '380ms' }}>
          <div className="grid grid-cols-3 gap-2.5">
            <StatTile value={String(groups)} label={t('hero.stat.groups')} loading={loading} />
            <StatTile value={String(biz)} label={t('hero.stat.businesses')} loading={loading} />
            <StatTile value={String(trainings)} label={t('hero.stat.trainings')} loading={loading} />
          </div>
          <div className="flex gap-2.5">
            <MoneyTile value={compact(volume)} label={t('hero.stat.volume')} accent="#16a34a" loading={loading} />
            <MoneyTile value={compact(held)} label={t('hero.stat.held')} accent="#e4a233" loading={loading} />
          </div>
          <p className="flex items-center justify-center lg:justify-start gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {t('hero.stat.liveNote')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The hero is taller than a phone viewport, so its lower half (CTAs +
    // live metrics) is reached by scrolling. Fading on scroll would dim the
    // very content the user is scrolling toward — so only fade on desktop,
    // where the whole hero fits above the fold.
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onScroll = () => {
      requestAnimationFrame(() => {
        if (!contentRef.current) return;
        if (!desktop.matches) {
          contentRef.current.style.opacity = '1';
          contentRef.current.style.transform = 'none';
          return;
        }
        const y = window.pageYOffset;
        const max = 500;
        const opacity = 1 - Math.min(y / max, 1) * 0.85;
        const translate = Math.min(y / max, 1) * 40;
        contentRef.current.style.opacity = opacity.toString();
        contentRef.current.style.transform = `translateY(${translate}px)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    desktop.addEventListener('change', onScroll);
    onScroll();

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const onMove = (e: MouseEvent) => {
      if (reduce || !parallaxRef.current || !sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const dx = (e.clientX - rect.left) / rect.width - 0.5;
      const dy = (e.clientY - rect.top) / rect.height - 0.5;
      parallaxRef.current.style.transform = `translate3d(${dx * 20}px, ${dy * 20}px, 0)`;
    };
    const host = sectionRef.current;
    host?.addEventListener('mousemove', onMove);

    return () => {
      window.removeEventListener('scroll', onScroll);
      desktop.removeEventListener('change', onScroll);
      host?.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <section ref={sectionRef} id="home" className="relative min-h-screen overflow-hidden bg-background">
      <AnimatedBackground />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/80 to-transparent z-10" />

      <div ref={contentRef} className="relative z-20 flex min-h-screen items-center will-change-transform">
        <div ref={parallaxRef} className="w-full transition-transform duration-300 ease-out will-change-transform">
          <HeroContent />
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce hidden lg:block">
        <div className="w-6 h-10 border-2 border-foreground/25 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-foreground/40 rounded-full mt-2 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
