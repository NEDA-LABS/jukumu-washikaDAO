'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import AnimatedBackground from '@/components/AnimatedBackground';

/* ── Count-up hook ─────────────────────────────────────────────── */
function useCountUp(target: number, durationMs = 1400, start = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / durationMs, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, start]);
  return value;
}

/* ── Small hexagon wrapper (clip-path) ─────────────────────────── */
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

/* ── Floating member avatar ────────────────────────────────────── */
function FloatBubble({
  x, y, delay, seed,
}: { x: string; y: string; delay: number; seed: number }) {
  const grads = [
    'from-[#d1622b] to-[#e4a233]',
    'from-emerald-400 to-teal-500',
    'from-sky-400 to-blue-600',
    'from-fuchsia-400 to-purple-600',
  ];
  const letters = ['A', 'J', 'M', 'F', 'N', 'S'];
  return (
    <div
      className="absolute"
      style={{ left: x, top: y, animation: `wd-bob 5s ease-in-out ${delay}s infinite` }}
    >
      <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${grads[seed % grads.length]} ring-2 ring-card shadow-lg flex items-center justify-center text-white text-xs font-bold`}>
        {letters[seed % letters.length]}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

/* ── The circular-economy orbit visual ─────────────────────────── */
function CircularEconomyViz() {
  const { t } = useLanguage();
  const iconCls = 'h-6 w-6';
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px] sm:max-w-[380px] lg:max-w-[440px]">
      {/* glow */}
      <div aria-hidden className="absolute inset-[12%] rounded-full bg-gradient-to-br from-[#e4a233]/25 to-[#d1622b]/20 blur-3xl" />

      {/* rotating ring + connecting circle */}
      <div className="absolute inset-0" style={{ animation: 'wd-spin 32s linear infinite' }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <circle
            cx="50" cy="50" r="38"
            fill="none"
            stroke="var(--ds-gold)"
            strokeOpacity="0.5"
            strokeWidth="0.6"
            strokeDasharray="4 4"
            style={{ animation: 'wd-dash 40s linear infinite' }}
          />
        </svg>
        {/* orbit nodes positioned on the ring (radius ~ 38% of 440 ≈ 150px, tuned per breakpoint via % transform) */}
        <div className="absolute inset-0 [--r:120px] sm:[--r:150px] lg:[--r:170px]">
          <OrbitNodeResponsive angle={-90} icon={<CoinsIcon className={iconCls} />} label={t('hero.node.save')} accent="#e4a233" />
          <OrbitNodeResponsive angle={30} icon={<BookIcon className={iconCls} />} label={t('hero.node.learn')} accent="#d1622b" />
          <OrbitNodeResponsive angle={150} icon={<ChartIcon className={iconCls} />} label={t('hero.node.invest')} accent="#16a34a" />
        </div>
      </div>

      {/* pulse rings behind center */}
      <div aria-hidden className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e4a233]/40" style={{ animation: 'wd-pulse-ring 3s ease-out infinite' }} />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e4a233]/40" style={{ animation: 'wd-pulse-ring 3s ease-out 1.5s infinite' }} />

      {/* center hexagon */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center bg-gradient-to-br from-[#d1622b] to-[#e4a233] shadow-2xl shadow-[#d1622b]/40"
          style={{ clipPath: HEX_CLIP }}
        >
          <div className="flex flex-col items-center text-white">
            <HexMark className="h-9 w-9 sm:h-10 sm:w-10" />
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider opacity-90">{t('hero.node.center')}</span>
          </div>
        </div>
      </div>

      {/* floating members */}
      <FloatBubble x="6%" y="18%" delay={0} seed={0} />
      <FloatBubble x="86%" y="12%" delay={0.8} seed={1} />
      <FloatBubble x="90%" y="72%" delay={1.6} seed={2} />
      <FloatBubble x="2%" y="66%" delay={2.2} seed={3} />

      {/* live ticker */}
      <div className="absolute -bottom-3 left-1/2 w-[92%] max-w-xs -translate-x-1/2">
        <ActivityTicker />
      </div>
    </div>
  );
}

/* Wrapper that reads the responsive --r orbit radius from CSS var. */
function OrbitNodeResponsive({ angle, icon, label, accent }: { angle: number; icon: React.ReactNode; label: string; accent: string }) {
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{
        transform: `translate(-50%, -50%) translate(calc(cos(${angle}deg) * var(--r)), calc(sin(${angle}deg) * var(--r)))`,
      }}
    >
      <div style={{ animation: 'wd-spin-rev 32s linear infinite' }}>
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-border bg-card/90 backdrop-blur-md shadow-lg"
            style={{ color: accent }}
          >
            {icon}
          </div>
          <span className="rounded-full bg-card/90 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-foreground shadow-sm border border-border whitespace-nowrap">
            {label}
          </span>
        </div>
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

/* ── Hero content ──────────────────────────────────────────────── */
function HeroContent() {
  const { t } = useLanguage();
  const groups = useCountUp(120);
  const biz = useCountUp(200);
  const trainers = useCountUp(42);

  const stats = [
    { value: `${groups}+`, label: t('hero.stat.groups') },
    { value: `${biz}+`, label: t('hero.stat.businesses') },
    { value: `${trainers}+`, label: t('hero.stat.trainers') },
  ];

  return (
    <div className="wd-container grid lg:grid-cols-2 items-center gap-10 lg:gap-8 py-24 sm:py-28 lg:py-24">
      {/* Left: copy */}
      <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
        <div className="wd-rise inline-flex items-center gap-2 px-4 py-2 mb-7 rounded-full border border-border bg-card/70 backdrop-blur-sm shadow-sm" style={{ animationDelay: '0ms' }}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          <span className="text-foreground/70 text-xs sm:text-sm font-medium tracking-wide">{t('tagline')}</span>
        </div>

        <h1 className="wd-rise text-[3rem] leading-[0.98] sm:text-7xl lg:text-[5.5rem] text-foreground" style={{ animationDelay: '90ms' }}>
          Washika<span className="text-gold"> DAU</span>
        </h1>
        <p className="wd-rise mt-4 font-display text-2xl sm:text-3xl text-foreground/55 italic" style={{ animationDelay: '150ms' }}>
          {t('hero.motto')}
        </p>
        <p className="wd-rise mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-md" style={{ animationDelay: '220ms' }}>
          {t('hero.subtitle')}
        </p>

        <div className="wd-rise mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto" style={{ animationDelay: '300ms' }}>
          <Link href="/register" className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground text-sm font-semibold rounded-full transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0">
            {t('hero.cta.join')}
            <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
          <Link href="/learn" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-card/70 backdrop-blur-sm text-foreground text-sm font-semibold rounded-full border border-border hover:bg-card hover:-translate-y-0.5 transition-all duration-200">
            {t('hero.learn_more')}
          </Link>
        </div>

        <div className="wd-rise mt-12 grid grid-cols-3 gap-3 sm:gap-5 w-full max-w-md" style={{ animationDelay: '380ms' }}>
          {stats.map((s) => (
            <div key={s.label} className="group rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-3 py-4 transition-all duration-300 hover:-translate-y-1 hover:border-gold/50 hover:shadow-md">
              <div className="font-display text-2xl sm:text-3xl text-foreground group-hover:text-gold transition-colors tabular-nums">{s.value}</div>
              <div className="mt-1 text-xs sm:text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: interactive visual */}
      <div className="wd-rise order-first lg:order-last mb-6 lg:mb-0" style={{ animationDelay: '260ms' }}>
        <CircularEconomyViz />
      </div>
    </div>
  );
}

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);

  // Scroll fade + subtle mouse parallax on the visual layer.
  useEffect(() => {
    const onScroll = () => {
      requestAnimationFrame(() => {
        const y = window.pageYOffset;
        const max = 500;
        const opacity = 1 - Math.min(y / max, 1) * 0.85;
        const translate = Math.min(y / max, 1) * 40;
        if (contentRef.current) {
          contentRef.current.style.opacity = opacity.toString();
          contentRef.current.style.transform = `translateY(${translate}px)`;
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const onMove = (e: MouseEvent) => {
      if (reduce || !parallaxRef.current || !sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const dx = (e.clientX - rect.left) / rect.width - 0.5;
      const dy = (e.clientY - rect.top) / rect.height - 0.5;
      parallaxRef.current.style.transform = `translate3d(${dx * 22}px, ${dy * 22}px, 0)`;
    };
    const host = sectionRef.current;
    host?.addEventListener('mousemove', onMove);

    return () => {
      window.removeEventListener('scroll', onScroll);
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

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce hidden sm:block">
        <div className="w-6 h-10 border-2 border-foreground/25 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-foreground/40 rounded-full mt-2 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
