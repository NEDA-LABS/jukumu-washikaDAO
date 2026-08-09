'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GroupSummary } from '@/components/member/GroupScreen';

/**
 * The Kikundi index: every group the member belongs to, and nothing else.
 *
 * Tapping one opens its detail. This exists because the tab used to drop
 * straight into a single group's roster with the others tucked behind a
 * horizontal switcher — so a member in several chamas saw one group's private
 * detail before they had chosen which group they meant to look at. A list
 * first, detail on tap, is the expected shape and keeps each group's numbers
 * behind a deliberate tap.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export default function GroupList({
  groups, onOpen,
}: {
  groups: GroupSummary[];
  onOpen: (id: number) => void;
}) {
  const { t } = useLanguage();

  if (groups.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-xs text-muted-foreground">{t('home.noGroup')}</p>
      </div>
    );
  }

  return (
    <div className="animate-[wdIn_.22s_ease_both]">
      <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
        <h2 className="font-display text-[15px] font-bold leading-tight">{t('grp.myGroups')}</h2>
        <span className="font-mono text-[9px] font-medium text-ink-3">{groups.length}</span>
      </div>

      <section className="px-5 pb-8">
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => onOpen(g.id)}
            className="flex w-full items-center gap-3 border-b border-border py-3.5 text-left"
          >
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center border border-border font-display text-sm font-bold text-muted-foreground">
              {g.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-tight">{g.name}</span>
              <span className="mt-1 block font-mono text-[9px] leading-none text-ink-3">
                {g.memberCount} {t('grp.members')}
                {g.code ? ` · ${g.code}` : ''}
              </span>
            </span>
            <span className="flex flex-none flex-col items-end">
              <span className="wd-figure text-[15px] leading-none">{fmt(g.treasuryTzs)}</span>
              <span className="mt-1 font-mono text-[8px] font-medium leading-none text-gold-deep">TZS</span>
            </span>
            <span className="flex-none font-mono text-[11px] font-medium text-ink-3">→</span>
          </button>
        ))}
      </section>
    </div>
  );
}
