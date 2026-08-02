'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * "Kikundi", per the prototype.
 *
 * The roster is the screen. Treasury and the paid count sit in one bordered
 * box up top, then every member as a row ending in a brick — the same brick
 * from the wall, so who has paid is legible at a glance without reading a
 * single number.
 */

export interface GroupMemberRow {
  id: number;
  name: string;
  role: string;
  isLeader: boolean;
  isMe: boolean;
  paid: boolean;
  streak: number;
}

export interface GroupScreenData {
  group: { id: number; name: string; code: string | null; monthlyContribution: number };
  isLeader: boolean;
  treasuryTzs: number;
  paidThisMonth: number;
  total: number;
  members: GroupMemberRow[];
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const PAGE = 10;

export default function GroupScreen({
  data, onInvite, onRemind, onMember,
}: {
  data: GroupScreenData;
  onInvite: () => void;
  onRemind: () => void;
  onMember: (m: GroupMemberRow) => void;
}) {
  const { t } = useLanguage();
  const [shown, setShown] = useState(PAGE);
  const visible = data.members.slice(0, shown);
  const rest = data.members.length - visible.length;

  return (
    <div className="animate-[wdIn_.22s_ease_both]">
      <section className="border-b border-border px-5 py-[18px]">
        <div className="flex border border-border">
          <div className="flex-1 border-r border-border px-3 py-2.5">
            <span className="wd-kicker">{t('grp.treasury')}</span>
            <p className="mt-1.5 wd-figure text-[20px]">{fmt(data.treasuryTzs)}</p>
            <p className="mt-1.5 font-mono text-[8px] font-medium text-gold-deep">nTZS</p>
          </div>
          <div className="w-28 flex-none px-3 py-2.5">
            <span className="wd-kicker">{t('grp.havePaid')}</span>
            <p className="mt-1.5 wd-figure text-[20px]">
              {data.paidThisMonth}
              <span className="font-sans text-[11px] font-normal text-muted-foreground">/{data.total}</span>
            </p>
            <p className="mt-1.5 font-mono text-[8px] font-medium text-ink-3">{t('home.thisMonth')}</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={onInvite} className="wd-press flex-1 border-2 border-foreground px-3 py-[11px] text-left text-[11px] font-semibold leading-none">
            {t('grp.invite')}
          </button>
          {/* Nudging everyone is a leader's act — members do not get a button
              that messages the whole group. */}
          {data.isLeader && (
            <button onClick={onRemind} className="wd-press flex-1 bg-foreground px-3 py-[11px] text-[11px] font-semibold leading-none text-background">
              {t('grp.remind')}
            </button>
          )}
        </div>
      </section>

      <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
        <h2 className="font-display text-[15px] font-bold leading-tight">{t('grp.members')}</h2>
        <span className="font-mono text-[9px] font-medium text-ink-3">
          {data.total}{data.group.code ? ` · ${data.group.code}` : ''}
        </span>
      </div>

      <section className="px-5 pb-8">
        {visible.map((m) => (
          <button
            key={m.id}
            onClick={() => onMember(m)}
            className="flex w-full items-center gap-3 border-b border-border py-[11px] text-left"
          >
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center border border-border text-[10px] font-semibold text-muted-foreground">
              {m.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold leading-tight">
                {m.name}{m.isMe && <span className="ml-1.5 font-mono text-[9px] font-normal text-gold-deep">({t('wall.you')})</span>}
              </span>
              <span className="mt-1 block text-[9.5px] leading-none text-ink-3">
                {m.isLeader ? t('grp.role.leader') : t('grp.role.member')} · {m.streak} {t('home.months')}
              </span>
            </span>
            <span className="flex flex-none items-center gap-2">
              <span className="font-mono text-[9px] font-medium text-muted-foreground">
                {m.paid ? t('grp.paid') : t('grp.unpaid')}
              </span>
              <span className="wd-brick h-4 w-4" data-paid={m.paid ? (m.isMe ? 'me' : '1') : '0'} />
            </span>
          </button>
        ))}

        {rest > 0 && (
          <button onClick={() => setShown((n) => n + PAGE)} className="py-3.5 text-[10px] font-semibold text-gold-deep">
            + {rest} {t('grp.members')}
          </button>
        )}
      </section>
    </div>
  );
}
