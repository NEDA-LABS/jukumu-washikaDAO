'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * "Utawala", per the prototype.
 *
 * Open proposals are heavy 2px cards carrying a vote strip — one square per
 * member, gold for yes, ink for no, hollow for not-yet. Closed ones collapse
 * to a single hairline row with a status chip, because a decided question
 * should stop competing for attention with a live one.
 */

export interface ProposalRow {
  id: number;
  title: string;
  kind: string;
  amountTzs: number;
  by: string | null;
  yes: number;
  no: number;
  pending: number;
  myVote: string | null;
  status: string;
  funded: boolean;
  at: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function VoteStrip({ p }: { p: ProposalRow }) {
  const total = Math.max(p.yes + p.no + p.pending, 1);
  return (
    <div className="mt-3 grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${total}, minmax(0,1fr))` }}>
      {Array.from({ length: p.yes }).map((_, i) => <div key={`y${i}`} className="wd-vote h-2.5" data-vote="yes" />)}
      {Array.from({ length: p.no }).map((_, i) => <div key={`n${i}`} className="wd-vote h-2.5" data-vote="no" />)}
      {Array.from({ length: p.pending }).map((_, i) => <div key={`p${i}`} className="wd-vote h-2.5" />)}
    </div>
  );
}

export default function GovernanceScreen({
  open, closed, canPropose, onNewProposal, onProposal,
}: {
  open: ProposalRow[];
  closed: ProposalRow[];
  canPropose: boolean;
  onNewProposal: () => void;
  onProposal: (p: ProposalRow) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="animate-[wdIn_.22s_ease_both]">
      {canPropose && (
        <section className="flex items-center gap-2 border-b border-border px-5 py-[18px]">
          <button onClick={onNewProposal} className="wd-press flex-1 bg-gold px-3 py-3 text-[11px] font-semibold leading-none text-[#1a1714]">
            {t('gov.newProposal')}
          </button>
        </section>
      )}

      <div className="flex items-baseline justify-between px-5 pb-1.5 pt-4">
        <h2 className="font-display text-[15px] font-bold leading-tight">{t('gov.open')}</h2>
        <span className="font-mono text-[9px] font-medium text-ink-3">{t('gov.majority')}</span>
      </div>

      <section className="px-5 pt-2">
        {open.length === 0 ? (
          <p className="pb-2 text-[11px] text-muted-foreground">{t('grp.noProposals')}</p>
        ) : (
          open.map((p) => (
            <button
              key={p.id}
              onClick={() => onProposal(p)}
              className="wd-press mb-2.5 block w-full border-2 border-foreground p-3.5 text-left"
            >
              <span className="flex justify-between font-mono text-[8px] font-medium uppercase leading-none tracking-[0.1em] text-gold-deep">
                <span>{p.kind}</span>
                {/* Whether this member has voted is the one thing that tells
                    them if the card is asking anything of them. */}
                <span>{p.myVote ? t('gov.voted') : t('gov.needsYou')}</span>
              </span>
              <p className="mt-2 text-[13px] font-semibold leading-[1.35]">{p.title}</p>
              <p className="mt-1.5 font-mono text-[10.5px] leading-none text-muted-foreground">
                TZS {fmt(p.amountTzs)}{p.by ? ` · ${p.by}` : ''}
              </p>
              <VoteStrip p={p} />
              <span className="mt-[7px] flex justify-between font-mono text-[9px] font-medium text-muted-foreground">
                <span>{t('home.yes')} {p.yes}</span>
                <span>{t('home.no')} {p.no}</span>
                <span>{p.pending} {t('home.pending')}</span>
              </span>
            </button>
          ))
        )}
      </section>

      {closed.length > 0 && (
        <>
          <h2 className="px-5 pb-1.5 pt-3.5 font-display text-[15px] font-bold leading-tight">{t('gov.closed')}</h2>
          <section className="px-5 pb-8">
            {closed.map((p) => (
              <button
                key={p.id}
                onClick={() => onProposal(p)}
                className="flex w-full items-center gap-3 border-b border-border py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold leading-[1.25]">{p.title}</span>
                  <span className="mt-1.5 block font-mono text-[9.5px] leading-none text-ink-3">
                    {p.yes} {t('home.yes')} · {p.no} {t('home.no')} ·{' '}
                    {new Date(p.at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                </span>
                <span
                  className={`flex-none border border-border px-[7px] py-[5px] font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.08em] ${
                    p.funded ? 'text-success' : p.status === 'rejected' ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {p.funded ? t('gov.funded') : p.status}
                </span>
              </button>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
