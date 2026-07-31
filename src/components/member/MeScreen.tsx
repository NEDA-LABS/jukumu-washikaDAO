'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * "Mimi", per the prototype.
 *
 * Everything that is about the person rather than the group, as a plain list
 * of hairline-separated rows. The sections that used to be peers in the
 * sidebar — wallet, investments, training, notifications, settings — live
 * here because none of them is a daily act.
 */

export interface MeLink {
  id: string;
  label: string;
  meta?: string;
}

export default function MeScreen({
  name, username, avatarUrl, balanceTzs, groupCount,
  links, onLink, onLogout,
}: {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  balanceTzs: number;
  groupCount: number;
  links: MeLink[];
  onLink: (id: string) => void;
  onLogout: () => void;
}) {
  const { t } = useLanguage();
  const initials = (name || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className="animate-[wdIn_.22s_ease_both]">
      <section className="border-b border-border px-5 pb-5 pt-5">
        <div className="flex items-center gap-3.5">
          <div className="h-14 w-14 flex-none overflow-hidden border border-border bg-muted">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-xl font-bold text-muted-foreground">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-[19px] font-bold leading-tight">{name}</p>
            {username && <p className="mt-0.5 font-mono text-[10px] text-ink-3">@{username}</p>}
          </div>
        </div>

        <div className="mt-4 flex border border-border">
          <div className="flex-1 border-r border-border px-2.5 py-2.5">
            <span className="wd-kicker">{t('home.myAkiba')}</span>
            <p className="mt-1 wd-figure text-[18px]">{Math.round(balanceTzs).toLocaleString('en-US')}</p>
          </div>
          <div className="flex-1 px-2.5 py-2.5">
            <span className="wd-kicker">{t('tab.group')}</span>
            <p className="mt-1 wd-figure text-[18px]">{groupCount}</p>
          </div>
        </div>
      </section>

      <section className="px-5">
        {links.map((l) => (
          <button
            key={l.id}
            onClick={() => onLink(l.id)}
            className="flex w-full items-center justify-between border-b border-border py-3.5 text-left"
          >
            <span className="text-xs font-semibold">{l.label}</span>
            <span className="flex items-center gap-2">
              {l.meta && <span className="font-mono text-[10px] text-ink-3">{l.meta}</span>}
              <span className="font-mono text-[11px] font-medium text-ink-3">→</span>
            </span>
          </button>
        ))}
      </section>

      <section className="px-5 pb-8 pt-4.5">
        <button
          onClick={onLogout}
          className="wd-press w-full border-2 border-foreground py-3.5 text-xs font-semibold"
        >
          {t('me.logout')}
        </button>
        <p className="mt-3.5 font-mono text-[9px] leading-[1.6] text-ink-3">
          nTZS · BOT sandbox
          <br />© {new Date().getFullYear()} Washika DAU Fund
        </p>
      </section>
    </div>
  );
}
