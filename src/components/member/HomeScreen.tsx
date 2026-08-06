'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { UkutaWallView, PeriodToggle, type WallData, type WallPeriod } from '@/components/UkutaWall';

/**
 * Home, per the prototype.
 *
 * The screen answers three questions in order, and nothing else: what do I
 * have, has my group built its wall this month, and what needs me. Sections
 * are separated by hairlines rather than boxed into cards — the page is one
 * continuous document, not a grid of tiles.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export interface HomeGroup {
  id: number;
  name: string;
  code?: string | null;
}

export interface HomeProposal {
  id: number;
  groupId: number;
  title: string;
  amountTzs: number;
  closesInDays: number | null;
  yes: number;
  no: number;
  pending: number;
}

export interface HomeActivity {
  id: string;
  glyph: string;
  text: string;
  time: string;
  href?: string;
}

export default function HomeScreen({
  firstName, balanceTzs, streakMonths, sinceLabel,
  paidThisMonth = false, dueTzs = 0,
  group, wall, wallPeriod, onWallPeriod, collectedTzs, targetTzs,
  proposal, activity,
  onContribute, onDeposit, onTransfer, onWithdraw, onWallet,
  onWhoPaid, onGovernance, onProposal, onActivity,
}: {
  firstName: string;
  balanceTzs: number;
  streakMonths: number;
  sinceLabel: string | null;
  /** Has this member contributed in the current month? */
  paidThisMonth?: boolean;
  /** What they still owe this month, 0 when settled or no dues are set. */
  dueTzs?: number;
  group: HomeGroup | null;
  wall: WallData | null;
  wallPeriod?: WallPeriod;
  onWallPeriod?: (p: WallPeriod) => void;
  collectedTzs: number;
  targetTzs: number;
  proposal: HomeProposal | null;
  activity: HomeActivity[];
  onContribute: () => void;
  onDeposit: () => void;
  onTransfer: () => void;
  onWithdraw: () => void;
  onWallet: () => void;
  onWhoPaid: () => void;
  onGovernance: () => void;
  onProposal: (p: HomeProposal) => void;
  onActivity: (a: HomeActivity) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="animate-[wdIn_.22s_ease_both]">
      {/* ── Balance + actions ── */}
      <section className="border-b border-border px-5 pb-[18px] pt-5">
        {/* The greeting leads the screen. It was 11px grey above the balance,
            which read as a caption on the number rather than the app saying
            hello to the person holding the phone. */}
        <h1 className="font-display text-[26px] font-bold leading-tight">
          {t('home.greet')}, {firstName}
        </h1>

        <p className="mt-4 text-[11px] leading-none text-muted-foreground">
          {t('home.myAkiba')}{sinceLabel ? ` · ${t('home.since')} ${sinceLabel}` : ''}
        </p>

        <div className="mt-1.5 flex items-end gap-2">
          <span className="wd-figure text-[44px]">{fmt(balanceTzs)}</span>
          <span className="pb-1.5 font-mono text-[10px] font-medium leading-none text-gold-deep">TZS</span>
        </div>

        {/* Was "streak / yield". Yield was permanently +0 — there is no yield
            product — and a zero interest figure on a savings screen is worse
            than none, because it reads as a promise that is failing. Both
            tiles now answer questions a member actually has: have I paid this
            month, and what do I owe. */}
        <div className="mt-4 flex border border-border">
          <div className="flex-1 border-r border-border px-2.5 py-2.5">
            <span className="wd-kicker">{t('home.thisMonth')}</span>
            <p className={`mt-1 text-[15px] font-semibold leading-tight ${paidThisMonth ? 'text-success' : 'text-destructive'}`}>
              {paidThisMonth ? t('home.paidUp') : t('home.notPaid')}
            </p>
          </div>
          <div className="flex-1 px-2.5 py-2.5">
            <span className="wd-kicker">{dueTzs > 0 ? t('home.due') : t('home.streak')}</span>
            <p className="mt-1 text-[15px] font-semibold leading-tight">
              {dueTzs > 0
                ? fmt(dueTzs)
                : <>{streakMonths} <span className="text-[9px] font-normal text-muted-foreground">{t('home.months')}</span></>}
            </p>
          </div>
        </div>

        <button
          onClick={onContribute}
          className="wd-press mt-3.5 flex w-full items-center justify-between bg-gold px-3.5 py-3.5 text-[#1a1714]"
        >
          <span className="text-xs font-semibold leading-none">{t('home.contribute')}</span>
          <span className="font-mono text-xs font-medium leading-none">→</span>
        </button>

        {/* Four equal actions, icon over a one-word label, in one bordered box
            split by hairlines — the same shape as the status box above it.
            These were previously flex buttons carrying full sentences, so
            "Hamisha kwa kikundi" stretched to fill the row while "Pochi" sat
            tiny beside it. Equal cells and short labels is what makes a wallet
            row scannable; the long phrasing moves to the aria-label so screen
            readers still get "Hamisha kwa kikundi" rather than one word. */}
        <div className="mt-2 grid grid-cols-4 border border-border">
          {([
            // Deposit first: money has to arrive before any of the others can
            // happen. Its arrow points down, mirroring withdraw's, so the pair
            // reads as in/out without needing the labels.
            { id: 'deposit', label: t('home.act.deposit'), full: t('wal.deposit'), onClick: onDeposit,
              icon: <path d="M12 4v15m0 0 5.5-5.5M12 19l-5.5-5.5" /> },
            { id: 'transfer', label: t('home.act.transfer'), full: t('home.transferToGroup'), onClick: onTransfer,
              icon: <path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5" /> },
            { id: 'withdraw', label: t('home.act.withdraw'), full: t('home.withdraw'), onClick: onWithdraw,
              icon: <path d="M12 20V5m0 0-5.5 5.5M12 5l5.5 5.5" /> },
            { id: 'wallet', label: t('home.act.wallet'), full: t('home.wallet'), onClick: onWallet,
              icon: <><path d="M3 7.5h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 7.5 15 4v3.5" /><circle cx="16.5" cy="13" r="1.1" /></> },
          ]).map((a, i) => (
            <button
              key={a.id}
              onClick={a.onClick}
              aria-label={a.full}
              className={`wd-press flex flex-col items-center gap-2 py-3.5 ${i > 0 ? 'border-l border-border' : ''}`}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {a.icon}
              </svg>
              <span className="text-[10.5px] font-semibold leading-none">{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Ukuta ── */}
      {group && (
        <section className="border-b border-border px-5 pb-5 pt-[18px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold leading-tight">{t('wall.title')}</h2>
            {wallPeriod && onWallPeriod
              ? <PeriodToggle value={wallPeriod} onChange={onWallPeriod} />
              : group.code && <span className="font-mono text-[9px] font-medium text-ink-3">{group.code}</span>}
          </div>
          <p className="mt-1.5 max-w-[280px] text-[10px] leading-[1.4] text-muted-foreground">
            {t('home.wallSub')}
          </p>

          {wall ? (
            <UkutaWallView data={wall} className="mt-3.5" />
          ) : (
            <div className="mt-3.5 flex flex-col gap-[5px]">
              {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[9px] animate-pulse bg-muted" />)}
            </div>
          )}

          <div className="mt-3.5 flex items-end justify-between border-t border-border pt-3">
            <div>
              <span className="wd-kicker">{t('home.thisMonth')}</span>
              <p className="mt-1.5 wd-figure text-[22px]">
                {fmt(collectedTzs)}
                {targetTzs > 0 && (
                  <span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground">/ {fmt(targetTzs)}</span>
                )}
              </p>
            </div>
            <button onClick={onWhoPaid} className="wd-press border-b border-gold pb-0.5 text-[10px] font-semibold text-gold-deep">
              {t('home.whoPaid')} →
            </button>
          </div>
        </section>
      )}

      {/* ── Needs your vote ── */}
      {proposal && (
        <section className="border-b border-border px-5 py-[18px]">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-bold leading-tight">{t('home.needsVote')}</h2>
            <button onClick={onGovernance} className="text-[10px] font-semibold text-muted-foreground">{t('home.viewAll')}</button>
          </div>

          <button onClick={() => onProposal(proposal)} className="wd-press block w-full border-2 border-foreground p-3.5 text-left">
            <span className="wd-kicker wd-kicker-gold">
              {t('home.proposal')}
              {proposal.closesInDays !== null && ` · ${proposal.closesInDays} ${t('home.days')}`}
            </span>
            <p className="mt-[7px] text-[13px] font-semibold leading-[1.35]">{proposal.title}</p>
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">TZS {fmt(proposal.amountTzs)}</p>

            {/* One square per member — the same grammar as the wall, so a vote
                reads as the same kind of collective act as a contribution. */}
            <div
              className="mt-3 grid gap-[2px]"
              style={{ gridTemplateColumns: `repeat(${Math.max(proposal.yes + proposal.no + proposal.pending, 1)}, minmax(0,1fr))` }}
            >
              {Array.from({ length: proposal.yes }).map((_, i) => <div key={`y${i}`} className="wd-vote h-3" data-vote="yes" />)}
              {Array.from({ length: proposal.no }).map((_, i) => <div key={`n${i}`} className="wd-vote h-3" data-vote="no" />)}
              {Array.from({ length: proposal.pending }).map((_, i) => <div key={`p${i}`} className="wd-vote h-3" />)}
            </div>

            <div className="mt-[7px] flex justify-between font-mono text-[9px] font-medium text-muted-foreground">
              <span>{t('home.yes')} {proposal.yes}</span>
              <span>{t('home.no')} {proposal.no}</span>
              <span>{proposal.pending} {t('home.pending')}</span>
            </div>
          </button>
        </section>
      )}

      {/* ── Activity ── */}
      <section className="px-5 pb-8 pt-[18px]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-[15px] font-bold leading-tight">{t('home.activity')}</h2>
        </div>
        {activity.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">{t('home.noActivity')}</p>
        ) : (
          <div className="flex flex-col">
            {activity.map((a) => (
              <button
                key={a.id}
                onClick={() => onActivity(a)}
                className="flex gap-3 border-b border-border py-2.5 text-left"
              >
                <span className="flex h-[26px] w-[26px] flex-none items-center justify-center border border-border text-[10px] font-semibold text-muted-foreground">
                  {a.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] leading-[1.4]">{a.text}</span>
                  <span className="mt-1 block font-mono text-[8.5px] font-medium text-ink-3">{a.time}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
