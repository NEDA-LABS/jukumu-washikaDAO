'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * The WashikaDAU landing page, built to the imported design.
 *
 * Every section is the same editorial grammar as the app: a mono kicker, a
 * display-serif headline, hairlines doing the dividing, and gold used once per
 * screen for the thing you should press. The two interactive pieces — laying a
 * brick and casting a vote — exist because the product is hard to explain and
 * trivial to demonstrate.
 *
 * The prototype was authored at desktop width with fixed two-column grids. Every
 * one of them collapses to a single column below `lg` here; a landing page that
 * only works on a laptop is no use to a market trader in Dar.
 */

/* ── Scroll reveal ─────────────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-r]'));

    // No IntersectionObserver, or reduced motion: show everything immediately
    // rather than leaving the page permanently blank.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('wl-in'));
      return;
    }

    root.classList.add('wl-anim');

    const show = (n: Element) => { n.classList.add('wl-in'); io.unobserve(n); };
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) show(e.target); }),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );

    const sweep = () => {
      let remaining = 0;
      nodes.forEach((n) => {
        if (n.classList.contains('wl-in')) return;
        if (n.getBoundingClientRect().top < window.innerHeight * 0.92) show(n);
        else remaining += 1;
      });
      return remaining;
    };

    nodes.forEach((n, i) => {
      n.style.transitionDelay = `${Math.min(i % 5, 4) * 60}ms`;
      io.observe(n);
    });
    sweep();

    // IntersectionObserver does not deliver callbacks while the document is
    // hidden, and a page restored from bfcache can miss them entirely. Because
    // these elements start at opacity:0, a missed callback does not degrade the
    // animation — it leaves the section permanently invisible. So visibility
    // never rests on the observer alone: a passive scroll listener catches
    // anything it missed, and a final timer reveals whatever is left no matter
    // what. Worst case the reveal is skipped; the content always arrives.
    window.addEventListener('scroll', sweep, { passive: true });
    window.addEventListener('resize', sweep, { passive: true });
    document.addEventListener('visibilitychange', sweep);
    const failsafe = window.setTimeout(() => nodes.forEach(show), 4000);

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', sweep);
      window.removeEventListener('resize', sweep);
      document.removeEventListener('visibilitychange', sweep);
      clearTimeout(failsafe);
    };
  }, []);
  return ref;
}

const fmt = (n: number) => Number(n || 0).toLocaleString('en-US');

/** Compact money for headline figures: 4_238_538 → "4.2M". */
function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1)}B`;
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1)}K`;
  return String(Math.round(n));
}

interface PlatformStats {
  groups: number; members: number; businesses: number;
  trainings: number; volumeTzs: number; heldTzs: number; live: boolean;
}

/**
 * Live platform figures.
 *
 * Returns null until the request lands, and stays null if it fails. Callers
 * render nothing rather than a placeholder: a made-up number on a savings
 * product is worse than a blank, because a visitor cannot tell the difference.
 */
function usePlatformStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/public/stats')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: PlatformStats) => { if (alive && d?.live) setStats(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return stats;
}

/* ── Shared bits ───────────────────────────────────────────────── */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-mono text-[11px] font-medium uppercase leading-none tracking-[0.16em] text-gold-deep">
      {children}
    </span>
  );
}

function SectionHead({ kicker, title, blurb, className = '' }: {
  kicker: string; title: string; blurb?: string; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div data-r>
        <Kicker>{kicker}</Kicker>
        <h2 className="mt-4 max-w-[18ch] font-display text-[clamp(30px,3.7vw,50px)] font-bold leading-[1.08] tracking-[-0.022em]">
          {title}
        </h2>
      </div>
      {blurb && (
        <p data-r className="max-w-[54ch] text-[clamp(14px,1.28vw,16.5px)] leading-[1.7] text-muted-foreground">
          {blurb}
        </p>
      )}
    </div>
  );
}

/* ── Brick wall ────────────────────────────────────────────────── */
function WallRow({ label, paid, total, newIdx, count, height, cols }: {
  label: string; paid: number; total: number; newIdx: number;
  count?: string; height: string; cols: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-8 flex-none font-mono text-[9px] font-medium tracking-[0.06em] text-ink-3">{label}</span>
      <div className="grid flex-1 gap-[2.5px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="wd-brick transition-colors duration-500"
            style={{ height }}
            data-paid={i === newIdx ? '1' : i < paid ? '1' : '0'}
            data-new={i === newIdx ? '1' : undefined}
          />
        ))}
      </div>
      {count && (
        <span className="w-9 flex-none text-right font-mono text-[9px] font-medium text-ink-3">{count}</span>
      )}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { t, language } = useLanguage();
  const sw = language === 'sw';
  const ref = useReveal();

  // The demo state: a wall you can add to, and a vote you can cast.
  const [paid, setPaid] = useState(23);
  const [newIdx, setNewIdx] = useState(-1);
  const [treasury, setTreasury] = useState(8_420_000);
  const [vote, setVote] = useState<{ y: number; n: number; me: 'y' | 'n' | null }>({ y: 18, n: 4, me: null });

  const layBrick = useCallback(() => {
    setPaid((p) => {
      if (p >= 30) { setNewIdx(-1); setTreasury(8_420_000); return 23; }
      setNewIdx(p);
      setTreasury((v) => v + 50_000);
      return p + 1;
    });
  }, []);

  const cast = (yes: boolean) => () => setVote((v) => {
    const next = { ...v };
    if (v.me === 'y') next.y -= 1;
    if (v.me === 'n') next.n -= 1;
    if (yes) next.y += 1; else next.n += 1;
    next.me = yes ? 'y' : 'n';
    return next;
  });

  const MONTHS = sw ? ['FEB', 'MAC', 'APR', 'MEI', 'JUN', 'JUL'] : ['FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL'];
  const counts = [30, 30, 28, 30, 29, paid];
  const pending = 30 - vote.y - vote.n;

  const stats = usePlatformStats();

  // Only claims the database can substantiate. The design's marquee also
  // carried "412 loans repaid in full", which nothing here counts — an
  // unverifiable number on a savings product is not a rounding issue, so it
  // is gone rather than approximated. The peg and the yield stay: they are
  // terms of the product, not counts of activity.
  const marquee = stats
    ? (sw
      ? [
          `Vikundi ${fmt(stats.groups)} vinatumia Washika`,
          `TZS ${compact(stats.volumeTzs)} zimepita jukwaani`,
          `Wanachama ${fmt(stats.members)}`,
          `TZS ${compact(stats.heldTzs)} kwenye hazina za vikundi`,
          'nTZS 1:1 na shilingi',
          'Riba 10% kwa mwaka',
        ]
      : [
          `${fmt(stats.groups)} groups on Washika`,
          `TZS ${compact(stats.volumeTzs)} processed`,
          `${fmt(stats.members)} members`,
          `TZS ${compact(stats.heldTzs)} held in group treasuries`,
          'nTZS pegged 1:1',
          '10% annual yield',
        ])
    : ['nTZS 1:1', '10% p.a.', 'Bank of Tanzania sandbox'];

  const pains = [1, 2, 3, 4].map((i) => ({ n: `0${i}`, h: t(`wl.p${i}h`), b: t(`wl.p${i}b`) }));
  const steps = [1, 2, 3, 4, 5].map((i) => ({ n: `0${i}`, h: t(`wl.s${i}h`), b: t(`wl.s${i}b`) }));
  const ladder = [1, 2, 3, 4].map((i) => ({
    p: i < 4 ? '1' : '0', stage: t(`wl.l${i}s`), h: t(`wl.l${i}h`), b: t(`wl.l${i}b`), amt: t(`wl.l${i}a`),
  }));

  return (
    <div ref={ref} className="bg-background text-foreground">

      {/* ── Hero ── */}
      <section
        id="top"
        className="mx-auto grid max-w-[1240px] items-center gap-[clamp(30px,5vw,72px)] px-[clamp(20px,4vw,44px)] pt-[clamp(40px,6vw,84px)] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]"
      >
        <div>
          <div data-r className="flex items-center gap-2.5">
            <span className="block h-[9px] w-[9px] bg-gold" />
            <Kicker>{t('wl.eyebrow')}</Kicker>
          </div>

          <h1 data-r className="mt-5 font-display text-[clamp(40px,6.6vw,92px)] font-bold leading-[1.07] tracking-[-0.03em]">
            <span className="block">{t('wl.h1a')}</span>
            <span className="block italic text-gold">{t('wl.h1b')}</span>
            <span className="block">{t('wl.h1c')}</span>
          </h1>

          <p data-r className="mt-6 max-w-[46ch] text-[clamp(14px,1.35vw,17px)] leading-[1.65] text-muted-foreground">
            {t('wl.heroSub')}
          </p>

          <div data-r className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="wl-cta bg-gold px-[22px] py-4 text-[13px] font-semibold text-[#1a1714]">
              {t('wl.ctaPrimary')}
            </Link>
            <a href="#jinsi" className="wl-cta wl-cta-ghost border-2 border-foreground px-[22px] py-[15px] text-[13px] font-semibold">
              {t('wl.ctaSecondary')}
            </a>
          </div>

          {/* Real counts, or nothing. While the request is in flight the row
              reserves its height so the hero does not jolt when it lands. */}
          <div data-r className="mt-8 min-h-[58px] border-t border-border pt-6">
            {stats && (
              <div className="flex flex-wrap gap-x-7 gap-y-4">
                {[
                  { n: fmt(stats.groups), l: sw ? 'vikundi' : 'groups' },
                  { n: fmt(stats.members), l: sw ? 'wanachama' : 'members' },
                  { n: `TSh ${compact(stats.volumeTzs)}`, l: sw ? 'zimepita jukwaani' : 'processed' },
                ].map((x) => (
                  <div key={x.l}>
                    <div className="font-display text-[22px] leading-none tabular-nums">{x.n}</div>
                    <div className="mt-2 font-mono text-[9px] font-medium uppercase leading-[1.4] tracking-[0.11em] text-ink-3">{x.l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Phone */}
        <div data-r className="relative flex justify-center">
          <div aria-hidden className="absolute inset-x-0 bottom-[6%] top-auto h-[62%] bg-muted" />
          <div className="wl-float relative flex w-[min(300px,86%)] flex-col overflow-hidden border-2 border-rule bg-card shadow-[14px_14px_0_var(--ds-gold)]"
               style={{ aspectRatio: '9 / 19.3' }}>
            <div className="flex flex-none items-baseline justify-between border-b-2 border-rule px-4 pb-2.5 pt-4">
              <span className="font-display text-[13px] font-bold">Washika<span className="text-gold"> DAU</span></span>
              <span className="font-mono text-[7.5px] font-medium tracking-[0.1em] text-ink-3">WD-5TANO</span>
            </div>

            <div className="border-b border-border px-4 pb-3 pt-3.5">
              <p className="text-[9px] text-muted-foreground">{t('wl.phoneGreet')}</p>
              <div className="mt-[7px] flex items-end gap-1.5">
                <span className="wd-figure text-[33px]">{fmt(612_000 + (paid - 23) * 50_000)}</span>
                <span className="pb-1 font-mono text-[8px] font-medium leading-none text-gold-deep">nTZS</span>
              </div>
              <p className="mt-[7px] text-[8.5px] text-ink-3">{t('wl.phoneMine')} · +42,180 {t('wl.phoneYield')}</p>
            </div>

            <div className="flex-1 border-b border-border px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[10.5px] font-bold">{t('wl.phoneWall')}</span>
                <span className="font-mono text-[7.5px] font-medium text-ink-3">{paid}/30</span>
              </div>
              <div className="mt-3 flex flex-col gap-[3px]">
                {MONTHS.map((label, r) => (
                  <WallRow key={label} label={label} paid={counts[r]} total={30} cols={15}
                           newIdx={r === 5 ? newIdx : -1} height="6px" />
                ))}
              </div>
              <p className="mt-3 border-t border-border pt-3 text-[8px] leading-[1.5] text-muted-foreground">
                {t('wl.phoneWallNote')}
              </p>
            </div>

            <div className="flex flex-none items-center justify-between bg-gold px-4 py-3 text-[#1a1714]">
              <span className="text-[10px] font-semibold">{t('wl.phoneCta')}</span>
              <span className="font-mono text-[10px] font-medium">50,000 →</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="mt-[clamp(44px,6vw,84px)] overflow-hidden border-y-2 border-rule bg-gold text-[#1a1714]">
        <div className="wl-marquee flex w-max">
          {[...marquee, ...marquee].map((m, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <span className="whitespace-nowrap text-[12px] font-semibold tracking-[0.02em]">{m}</span>
              <span className="mx-4 block h-1.5 w-1.5 flex-none bg-[#1a1714]" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Problem ── */}
      <section id="shida" className="mx-auto max-w-[1240px] px-[clamp(20px,4vw,44px)] py-[clamp(50px,7vw,104px)]">
        <SectionHead kicker={t('wl.k1')} title={t('wl.shidaH')} blurb={t('wl.shidaB')} />
        <div className="mt-[clamp(30px,4vw,54px)] grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {pains.map((p) => (
            <div key={p.n} data-r className="wl-lift bg-background px-[22px] pb-[30px] pt-[26px]">
              <div className="font-display text-[30px] leading-none text-gold">{p.n}</div>
              <div className="mt-4 text-[14.5px] font-semibold leading-[1.3]">{p.h}</div>
              <div className="mt-2.5 text-[12.5px] leading-[1.65] text-muted-foreground">{p.b}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Steps ── */}
      <section id="jinsi" className="border-t-2 border-rule bg-card">
        <div className="mx-auto max-w-[1240px] px-[clamp(20px,4vw,44px)] py-[clamp(50px,7vw,104px)]">
          <SectionHead kicker={t('wl.k2')} title={t('wl.jinsiH')} blurb={t('wl.jinsiB')} />
          <div className="mt-[clamp(26px,4vw,50px)] border-t-2 border-rule">
            {steps.map((s) => (
              <div key={s.n} data-r
                   className="wl-row grid items-baseline gap-x-[clamp(16px,3vw,44px)] gap-y-2 border-b border-border py-[26px] lg:grid-cols-[64px_minmax(0,300px)_minmax(0,1fr)_40px]">
                <div className="font-mono text-[12px] font-medium tracking-[0.08em] text-gold-deep">{s.n}</div>
                <div className="font-display text-[clamp(18px,1.8vw,25px)] font-bold leading-[1.2] tracking-[-0.01em]">{s.h}</div>
                <div className="max-w-[52ch] text-[13.5px] leading-[1.7] text-muted-foreground">{s.b}</div>
                <div className="wl-arrow hidden text-right font-mono text-[15px] font-medium lg:block">→</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The wall ── */}
      <section id="ukuta" className="border-t-2 border-rule">
        <div className="mx-auto grid max-w-[1240px] items-center gap-[clamp(30px,5vw,80px)] px-[clamp(20px,4vw,44px)] py-[clamp(50px,7vw,104px)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div data-r>
            <Kicker>{t('wl.k3')}</Kicker>
            <h2 className="mt-4 font-display text-[clamp(30px,3.7vw,50px)] font-bold leading-[1.08] tracking-[-0.022em]">{t('wl.ukutaH')}</h2>
            <p className="mt-5 max-w-[44ch] text-[14.5px] leading-[1.7] text-muted-foreground">{t('wl.ukutaB')}</p>
            <div className="mt-6 flex flex-wrap gap-5">
              <span className="flex items-center gap-2.5">
                <span className="wd-brick block h-3.5 w-3.5" data-paid="1" />
                <span className="text-[11px] font-medium text-muted-foreground">{t('wall.paid')}</span>
              </span>
              <span className="flex items-center gap-2.5">
                <span className="wd-brick block h-3.5 w-3.5" data-paid="0" />
                <span className="text-[11px] font-medium text-muted-foreground">{t('wall.unpaid')}</span>
              </span>
            </div>
            <button onClick={layBrick}
                    className="wl-cta mt-6 inline-flex items-center gap-3 bg-foreground px-5 py-[15px] text-[12px] font-semibold text-background">
              {t('wl.layBrick')}<span className="font-mono">+</span>
            </button>
          </div>

          <div data-r className="border-2 border-rule bg-card p-[clamp(18px,2.4vw,30px)]">
            <div className="flex items-baseline justify-between border-b-2 border-rule pb-3.5">
              <span className="font-display text-[15px] font-bold">Mtaa wa Tano Chama</span>
              <span className="font-mono text-[9.5px] font-medium text-ink-3">{t('wl.wallHeader')}</span>
            </div>
            <div className="mt-4 flex flex-col gap-[5px]">
              {[...(sw ? ['DES', 'JAN'] : ['DEC', 'JAN']), ...MONTHS].map((label, i) => {
                const isDemo = i >= 2;
                const n = isDemo ? counts[i - 2] : 30;
                return (
                  <WallRow key={label} label={label} paid={n} total={30} cols={30}
                           newIdx={isDemo && i - 2 === 5 ? newIdx : -1}
                           count={`${n}/30`} height="clamp(10px,1.1vw,15px)" />
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
              <div>
                <span className="wd-kicker">{t('grp.treasury')}</span>
                <div className="mt-2 font-display text-[clamp(24px,2.6vw,34px)] leading-none">
                  {fmt(treasury)} <span className="font-mono text-[10px] font-medium text-gold-deep">nTZS</span>
                </div>
              </div>
              <div className="text-right">
                <span className="wd-kicker">{t('wl.yieldLbl')}</span>
                <div className="mt-2 font-display text-[clamp(18px,2vw,24px)] leading-none text-success">+10.0%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Governance ── */}
      <section id="kura" className="border-t-2 border-rule bg-muted">
        <div className="mx-auto grid max-w-[1240px] items-center gap-[clamp(30px,5vw,76px)] px-[clamp(20px,4vw,44px)] py-[clamp(50px,7vw,104px)] lg:grid-cols-2">
          <div data-r className="border-2 border-rule bg-background p-[clamp(20px,2.6vw,32px)] lg:order-1">
            <Kicker>{t('wl.propKicker')}</Kicker>
            <div className="mt-3 font-display text-[clamp(19px,2.1vw,27px)] font-bold leading-[1.25]">{t('wl.propTitle')}</div>
            <p className="mt-3 text-[12.5px] leading-[1.65] text-muted-foreground">{t('wl.propBody')}</p>

            <div className="mt-6 grid grid-cols-10 gap-[5px]">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="wd-vote transition-colors duration-300"
                     style={{ height: 'clamp(18px,2vw,26px)' }}
                     data-vote={i < vote.y ? 'yes' : i < vote.y + vote.n ? 'no' : undefined} />
              ))}
            </div>

            <div className="mt-3.5 flex justify-between font-mono text-[10px] font-medium text-muted-foreground">
              <span>{t('home.yes')} {vote.y}</span>
              <span>{t('home.no')} {vote.n}</span>
              <span>{pending} {t('home.pending')}</span>
            </div>

            <div className="mt-5 flex gap-2.5">
              <button onClick={cast(true)} className="wl-cta flex-1 bg-gold p-[15px] text-left text-[12.5px] font-semibold text-[#1a1714]">
                {t('home.yes')}
              </button>
              <button onClick={cast(false)} className="wl-cta wl-cta-ghost flex-1 border-2 border-foreground p-3.5 text-left text-[12.5px] font-semibold">
                {t('home.no')}
              </button>
            </div>
            <p className="mt-3 text-[10.5px] leading-[1.6] text-ink-3" aria-live="polite">
              {vote.me ? (vote.me === 'y' ? t('wl.votedYes') : t('wl.votedNo')) : t('wl.voteIdle')}
            </p>
          </div>

          <div data-r className="lg:order-2">
            <Kicker>{t('wl.k4')}</Kicker>
            <h2 className="mt-4 font-display text-[clamp(30px,3.7vw,50px)] font-bold leading-[1.08] tracking-[-0.022em]">{t('wl.kuraH')}</h2>
            <p className="mt-5 max-w-[44ch] text-[14.5px] leading-[1.7] text-muted-foreground">{t('wl.kuraB')}</p>
            <div className="mt-6 flex flex-col gap-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 block h-2 w-2 flex-none bg-gold" />
                  <span className="text-[13px] leading-[1.6] text-muted-foreground">{t(`wl.kp${i}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── People / photos ── */}
      <section className="border-t-2 border-rule">
        <div className="mx-auto max-w-[1240px] px-[clamp(20px,4vw,44px)] py-[clamp(50px,7vw,96px)]">
          <div data-r className="grid items-center gap-[clamp(24px,4vw,64px)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="relative aspect-[4/3] w-full overflow-hidden border-2 border-rule">
              <Image
                src="/PXL_20250618_114941185.MP.jpg"
                alt={sw ? 'Wanachama wa kikundi cha akiba wamekutana' : 'Members of a savings group gathered together'}
                fill sizes="(max-width: 1024px) 100vw, 58vw"
                className="object-cover"
                priority
              />
            </div>
            <div>
              <Kicker>{t('wl.k5')}</Kicker>
              <h2 className="mt-4 font-display text-[clamp(26px,3.1vw,40px)] font-bold leading-[1.12] tracking-[-0.02em]">{t('wl.photoH')}</h2>
              <p className="mt-4 max-w-[42ch] text-[14px] leading-[1.7] text-muted-foreground">{t('wl.photoB')}</p>
              <div className="mt-6 grid grid-cols-2 gap-3.5">
                <div className="relative aspect-square w-full overflow-hidden border-2 border-rule">
                  <Image
                    src="/PXL_20250707_145652539.PORTRAIT.jpg"
                    alt={sw ? 'Mkutano wa kikundi mtaani Dar es Salaam' : 'A group meeting on a street in Dar es Salaam'}
                    fill sizes="(max-width: 1024px) 45vw, 21vw" className="object-cover"
                  />
                </div>
                <div className="relative aspect-square w-full overflow-hidden border-2 border-rule">
                  <Image
                    src="/PXL_20250716_160247799.jpg"
                    alt={sw ? 'Wanachama wakitumia app ya Washika kwenye simu' : 'Members using the Washika app on their phones'}
                    fill sizes="(max-width: 1024px) 45vw, 21vw" className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capital ladder ── */}
      <section id="mtaji" className="border-t-2 border-rule bg-card">
        <div className="mx-auto max-w-[1240px] px-[clamp(20px,4vw,44px)] py-[clamp(50px,7vw,104px)]">
          <SectionHead kicker={t('wl.k6')} title={t('wl.mtajiH')} blurb={t('wl.mtajiB')} />
          <div className="mt-[clamp(28px,4vw,52px)] grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {ladder.map((l) => (
              <div key={l.stage} data-r className="wl-lift bg-card px-5 pb-7 pt-6">
                <div className="flex items-center gap-2.5">
                  <span className="wd-brick block h-3 w-3" data-paid={l.p} />
                  <span className="wd-kicker">{l.stage}</span>
                </div>
                <div className="mt-4 font-display text-[16px] font-bold leading-[1.25]">{l.h}</div>
                <div className="mt-2.5 text-[12px] leading-[1.65] text-muted-foreground">{l.b}</div>
                <div className="mt-4 font-mono text-[11px] font-medium text-gold-deep">{l.amt}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quote ── */}
      <section className="border-t-2 border-rule">
        <div className="mx-auto grid max-w-[1240px] items-center gap-[clamp(24px,4vw,60px)] px-[clamp(20px,4vw,44px)] py-[clamp(50px,7vw,100px)] lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)]">
          <div data-r className="relative aspect-square w-[clamp(120px,14vw,190px)] flex-none overflow-hidden border-2 border-rule">
            <Image
              src="/PXL_20250531_114540969.PORTRAIT.jpg"
              alt={sw ? 'Mwenyekiti wa kikundi' : 'A group chairperson'}
              fill sizes="190px" className="object-cover"
            />
          </div>
          <div data-r>
            <blockquote className="max-w-[24ch] font-display text-[clamp(21px,2.7vw,36px)] font-bold leading-[1.28] tracking-[-0.018em]">
              &ldquo;{t('wl.quote')}&rdquo;
            </blockquote>
            <p className="mt-5 text-[12.5px] leading-[1.6] text-muted-foreground">{t('wl.quoteBy')}</p>
          </div>
        </div>
      </section>

      {/* ── Close ── */}
      <section id="pakua" className="border-t-2 border-rule bg-gold text-[#1a1714]">
        <div className="mx-auto max-w-[1240px] px-[clamp(20px,4vw,44px)] py-[clamp(50px,7vw,104px)]">
          <div data-r className="grid items-end gap-[clamp(28px,5vw,72px)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div>
              <h2 className="font-display text-[clamp(34px,5.4vw,74px)] font-bold leading-[1.02] tracking-[-0.03em]">
                <span className="block">{t('wl.closeA')}</span>
                <span className="block italic">{t('wl.closeB')}</span>
              </h2>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="wl-cta bg-[#1a1714] px-6 py-[17px] text-[13px] font-semibold text-gold">
                  {t('wl.closeCta1')}
                </Link>
                <a href="#top" className="border-2 border-[#1a1714] px-6 py-4 text-[13px] font-semibold">
                  {t('wl.closeCta2')}
                </a>
              </div>
            </div>
            <div>
              <div className="h-0.5 bg-[#1a1714]" />
              <div className="mt-0.5 flex flex-col">
                {[
                  { k: sw ? 'Lugha' : 'Language', v: 'Kiswahili · English' },
                  { k: sw ? 'Simu' : 'Phone', v: 'Android · USSD' },
                  { k: sw ? 'Ada ya kujiunga' : 'Joining fee', v: sw ? 'Bure' : 'Free' },
                  { k: sw ? 'Sarafu' : 'Currency', v: 'nTZS 1:1 TZS' },
                ].map((c) => (
                  <div key={c.k} className="flex justify-between gap-3.5 border-b border-[#1a1714]/25 py-3.5 text-[11.5px] font-medium leading-[1.4]">
                    <span className="opacity-70">{c.k}</span>
                    <span className="font-mono">{c.v}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[10.5px] leading-[1.6] opacity-75">{t('wl.closeNote')}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
