'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/** Every pooled collection on the platform, and where its money goes. */

type Row = {
  id: number; code: string; title: string; kind: string; beneficiary: string | null;
  target_tzs: string | null; deadline: string | null; status: string; created_at: string;
  organiser_name: string | null; group_name: string | null;
  raised_tzs: string; pending_tzs: string; contributors: number;
};

const tsh = (n: number | string) => `TSh ${Math.round(Number(n)).toLocaleString('en-US')}`;

export default function HarambeesSection() {
  const { language } = useLanguage();
  const sw = language === 'sw';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [totals, setTotals] = useState<{ pools: number; openPools: number; raisedTzs: number; contributions: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/harambees');
      if (!res.ok) { setRows([]); return; }
      const d = await res.json();
      setRows(d.harambees ?? []); setTotals(d.totals ?? null);
    } catch { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{sw ? 'Michango ya pamoja' : 'Pooled collections'}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {sw ? 'Harusi, misiba, matibabu na dharura — na pesa zinapokwenda.' : 'Weddings, funerals, medical and emergencies — and where the money goes.'}
        </p>
      </div>

      {totals && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [sw ? 'Michango' : 'Collections', String(totals.pools)],
            [sw ? 'Iliyo wazi' : 'Open', String(totals.openPools)],
            [sw ? 'Imekusanywa' : 'Raised', tsh(totals.raisedTzs)],
            [sw ? 'Michango iliyofika' : 'Contributions', String(totals.contributions)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-foreground">{v}</p>
            </div>
          ))}
        </div>
      )}

      {rows === null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{sw ? 'Inapakia…' : 'Loading…'}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {sw ? 'Bado hakuna mchango wowote.' : 'No collections yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">{sw ? 'Mchango' : 'Collection'}</th>
                <th className="px-4 py-3 font-medium">{sw ? 'Pesa ziende' : 'Money to'}</th>
                <th className="px-4 py-3 text-right font-medium">{sw ? 'Imekusanywa' : 'Raised'}</th>
                <th className="px-4 py-3 text-right font-medium">{sw ? 'Inasubiri' : 'In flight'}</th>
                <th className="px-4 py-3 font-medium">{sw ? 'Hali' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3">
                    <a href={`/harambee/${h.code}`} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4">
                      {h.title}
                    </a>
                    <p className="font-mono text-[10px] text-muted-foreground">{h.code} · {h.kind}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {h.group_name || h.organiser_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                    {tsh(h.raised_tzs)}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">×{h.contributors}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {Number(h.pending_tzs) > 0 ? tsh(h.pending_tzs) : '—'}
                  </td>
                  <td className={`px-4 py-3 font-medium ${h.status === 'open' ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                    {h.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
