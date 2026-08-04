'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Ukuta — the group wall.
 *
 * One brick per member per month: gold when their contribution landed, hollow
 * when it did not, ink-outlined for you. Six months of rows read bottom-up,
 * so a group that keeps paying is literally building something.
 *
 * It is deliberately not a chart. A percentage tells you 60%; the wall tells
 * you *which* six of ten people, and that you are one of them.
 */

export interface WallBrick {
  memberId: number;
  paid: boolean;
  isMe: boolean;
}

export type WallPeriod = 'week' | 'month' | 'year';

export interface WallRow {
  month: string;
  label: string;
  bricks: WallBrick[];
  count: number;
  /** True when nobody contributed in this period. */
  empty?: boolean;
}

export interface WallData {
  members: { id: number; name: string; isMe: boolean }[];
  total: number;
  rows: WallRow[];
  myMemberId: number;
  period?: WallPeriod;
}

function Bricks({ row, total }: { row: WallRow; total: number }) {
  // A period with nothing in it is the signal that matters, so it is coloured
  // rather than merely left blank. Only the label and tally turn red — tinting
  // thirty empty bricks would drown the gold ones that are the point.
  const empty = row.empty ?? row.count === 0;
  return (
    <div className="flex items-center gap-2">
      <div className={`w-9 flex-none font-mono text-[8px] font-medium leading-none tracking-[0.06em] ${
        empty ? 'text-destructive' : 'text-ink-3'
      }`}>
        {row.label}
      </div>
      <div
        className="grid flex-1 gap-[2px]"
        // The roster sets the column count, so a 30-person group and a
        // 4-person group both fill the same width.
        style={{ gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))` }}
      >
        {row.bricks.map((b) => (
          <div
            key={b.memberId}
            className="wd-brick h-[9px]"
            data-paid={b.paid ? (b.isMe ? 'me' : '1') : '0'}
            data-empty-row={empty ? '1' : undefined}
          />
        ))}
      </div>
      <div className={`w-9 flex-none text-right font-mono text-[8px] font-medium leading-none ${
        empty ? 'text-destructive' : 'text-ink-3'
      }`}>
        {row.count}/{total}
      </div>
    </div>
  );
}

const PERIODS: WallPeriod[] = ['week', 'month', 'year'];

export function PeriodToggle({ value, onChange }: { value: WallPeriod; onChange: (p: WallPeriod) => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex border border-border">
      {PERIODS.map((p, i) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-current={p === value ? 'true' : undefined}
          className={`px-2 py-1 font-mono text-[8px] font-medium uppercase leading-none tracking-[0.1em] ${
            i > 0 ? 'border-l border-border' : ''
          } ${p === value ? 'bg-foreground text-background' : 'text-ink-3'}`}
        >
          {t(`wall.period.${p}`)}
        </button>
      ))}
    </div>
  );
}

export function UkutaWallView({ data, className = '' }: { data: WallData; className?: string }) {
  const { t } = useLanguage();
  if (data.total === 0) {
    return (
      <p className={`text-xs text-muted-foreground ${className}`}>{t('wall.empty')}</p>
    );
  }
  return (
    <div className={`flex flex-col gap-[5px] ${className}`}>
      {data.rows.map((r) => (
        <Bricks key={r.month} row={r} total={data.total} />
      ))}
    </div>
  );
}

/** Self-loading variant for the group page. */
export default function UkutaWall({ groupId, className = '' }: { groupId: number; className?: string }) {
  const { t } = useLanguage();
  const [data, setData] = useState<WallData | null>(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<WallPeriod>('month');

  useEffect(() => {
    let alive = true;
    fetch(`/api/member/groups/${groupId}/wall?period=${period}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [groupId, period]);

  if (failed) return null;
  if (!data) {
    return (
      <div className={`flex flex-col gap-[5px] ${className}`}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[9px] animate-pulse bg-muted" />
        ))}
      </div>
    );
  }

  const thisMonth = data.rows[data.rows.length - 1];

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[15px] font-bold leading-tight">{t('wall.title')}</h3>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>
      <p className="mt-1.5 max-w-[280px] text-[10px] leading-relaxed text-muted-foreground">
        {t('wall.sub')}
      </p>
      <UkutaWallView data={data} className="mt-3.5" />
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
        <span className="flex items-center gap-1.5">
          <span className="wd-brick h-[9px] w-[14px]" data-paid="1" />
          <span className="wd-kicker">{t('wall.paid')}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="wd-brick h-[9px] w-[14px]" data-paid="0" />
          <span className="wd-kicker">{t('wall.unpaid')}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="wd-brick h-[9px] w-[14px]" data-paid="me" />
          <span className="wd-kicker">{t('wall.you')}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="block h-[9px] w-[14px] border border-destructive/60 bg-destructive/15" />
          <span className="wd-kicker text-destructive">{t('wall.none')}</span>
        </span>
      </div>
      <p className="mt-2 font-mono text-[9px] leading-none text-ink-3">
        {t('wall.thisPeriod')} {thisMonth?.count ?? 0}/{data.total}
      </p>
    </div>
  );
}
