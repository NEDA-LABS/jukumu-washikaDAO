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

export interface WallRow {
  month: string;
  label: string;
  bricks: WallBrick[];
  count: number;
}

export interface WallData {
  members: { id: number; name: string; isMe: boolean }[];
  total: number;
  rows: WallRow[];
  myMemberId: number;
}

function Bricks({ row, total }: { row: WallRow; total: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 flex-none font-mono text-[8px] font-medium leading-none tracking-[0.06em] text-ink-3">
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
          />
        ))}
      </div>
      <div className="w-9 flex-none text-right font-mono text-[8px] font-medium leading-none text-ink-3">
        {row.count}/{total}
      </div>
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

  useEffect(() => {
    let alive = true;
    fetch(`/api/member/groups/${groupId}/wall`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [groupId]);

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
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-[15px] font-bold leading-tight">{t('wall.title')}</h3>
        <span className="font-mono text-[9px] font-medium text-ink-3">
          {thisMonth?.count ?? 0}/{data.total}
        </span>
      </div>
      <p className="mt-1.5 max-w-[280px] text-[10px] leading-relaxed text-muted-foreground">
        {t('wall.sub')}
      </p>
      <UkutaWallView data={data} className="mt-3.5" />
      <div className="mt-3.5 flex items-center gap-4 border-t border-border pt-3">
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
      </div>
    </div>
  );
}
