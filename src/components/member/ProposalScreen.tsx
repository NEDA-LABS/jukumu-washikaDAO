'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import HoldToConfirm from './HoldToConfirm';

/**
 * The vote screen, per the prototype.
 *
 * The tally is the body of the page, not a footnote: two large figures and a
 * grid where every square is one member. Voting is open — the point is that
 * you can see who is still missing, which is what makes a chama's decision
 * social rather than administrative.
 */

export interface ProposalDetail {
  id: number;
  groupId: number;
  title: string;
  body: string | null;
  kind: string;
  amountTzs: number;
  by: string | null;
  yes: number;
  no: number;
  pending: number;
  myVote: string | null;
  requiredYes: number;
  status: string;
  isLeader: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export default function ProposalScreen({
  p, submitting, onVote, onClose,
}: {
  p: ProposalDetail;
  submitting: boolean;
  onVote: (v: 'yes' | 'no') => void;
  onClose?: () => void;
}) {
  const { t } = useLanguage();
  const total = p.yes + p.no + p.pending;
  const cast = p.yes + p.no;
  const canVote = p.status === 'open' && !p.myVote;

  return (
    <div className="animate-[wdIn_.22s_ease_both]">
      <section className="border-b border-border px-5 pb-[18px] pt-5">
        <span className="wd-kicker wd-kicker-gold">{p.kind}</span>
        <h1 className="mt-2.5 font-display text-[22px] font-bold leading-[1.2]">{p.title}</h1>
        {p.body && <p className="mt-2.5 text-[11.5px] leading-[1.6] text-muted-foreground">{p.body}</p>}

        <div className="mt-4 flex border border-border">
          <div className="flex-1 border-r border-border p-2.5">
            <span className="wd-kicker">{t('prop.amountLabel')}</span>
            <p className="mt-1.5 wd-figure text-[18px]">{fmt(p.amountTzs)}</p>
          </div>
          <div className="flex-1 p-2.5">
            <span className="wd-kicker">{t('prop.proposedBy')}</span>
            <p className="mt-1.5 text-xs font-semibold leading-[1.3]">{p.by || '—'}</p>
          </div>
        </div>
      </section>

      <section className="border-b border-border px-5 py-[18px]">
        <h2 className="font-display text-[15px] font-bold leading-tight">{t('prop.tally')}</h2>
        <p className="mt-1.5 text-[10px] leading-[1.5] text-muted-foreground">{t('prop.tallySub')}</p>

        <div className="mt-4 flex items-end gap-3.5">
          <div className="flex-1">
            <p className="font-display text-[30px] leading-none text-gold-deep">{p.yes}</p>
            <p className="mt-1.5 font-mono text-[9px] font-medium uppercase leading-none tracking-[0.1em] text-muted-foreground">
              {t('home.yes')}
            </p>
          </div>
          <div className="flex-1 text-right">
            <p className="font-display text-[30px] leading-none">{p.no}</p>
            <p className="mt-1.5 font-mono text-[9px] font-medium uppercase leading-none tracking-[0.1em] text-muted-foreground">
              {t('home.no')}
            </p>
          </div>
        </div>

        {/* Ten per row rather than one row of thirty: at this size a square has
            to stay tappable-sized to read as a person. */}
        <div className="mt-4 grid grid-cols-10 gap-1">
          {Array.from({ length: p.yes }).map((_, i) => <div key={`y${i}`} className="wd-vote h-5" data-vote="yes" />)}
          {Array.from({ length: p.no }).map((_, i) => <div key={`n${i}`} className="wd-vote h-5" data-vote="no" />)}
          {Array.from({ length: p.pending }).map((_, i) => <div key={`p${i}`} className="wd-vote h-5" />)}
        </div>

        <div className="mt-2.5 flex justify-between font-mono text-[9px] font-medium text-ink-3">
          <span>{t('prop.cast')}: {cast}/{total}</span>
          <span>{t('prop.quorumNeed')} {p.requiredYes}</span>
        </div>
      </section>

      {canVote && (
        <section className="px-5 pb-8 pt-[18px]">
          <span className="wd-kicker">{t('prop.yourVote')}</span>
          <div className="mt-3 flex flex-col gap-2">
            <HoldToConfirm
              onConfirm={() => onVote('yes')}
              disabled={submitting}
              className="bg-gold text-[#1a1714]"
              fillClassName="bg-foreground/20"
            >
              <span className="block p-4 text-[13px] font-semibold leading-none">
                {t('home.yes')} — {t('prop.hold')}
              </span>
            </HoldToConfirm>

            <HoldToConfirm
              onConfirm={() => onVote('no')}
              disabled={submitting}
              className="border-2 border-foreground"
              fillClassName="bg-foreground/12"
            >
              <span className="block p-3.5 text-[13px] font-semibold leading-none">
                {t('home.no')} — {t('prop.hold')}
              </span>
            </HoldToConfirm>
          </div>
          <p className="mt-2.5 text-[9.5px] leading-[1.5] text-ink-3">{t('prop.holdHint')}</p>
        </section>
      )}

      {p.myVote && (
        <section className="px-5 pb-8 pt-[18px]">
          <div className="border-2 border-gold p-4">
            <p className="text-xs font-semibold leading-[1.4]">
              {t('prop.youVoted')} {p.myVote === 'yes' ? t('home.yes') : p.myVote === 'no' ? t('home.no') : p.myVote}
            </p>
            <p className="mt-1.5 text-[10px] leading-[1.5] text-muted-foreground">{t('prop.recorded')}</p>
          </div>
          {p.isLeader && p.status === 'open' && onClose && (
            <button
              onClick={onClose}
              className="wd-press mt-2.5 w-full bg-foreground p-3.5 text-xs font-semibold text-background"
            >
              {t('prop.closeVote')}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
