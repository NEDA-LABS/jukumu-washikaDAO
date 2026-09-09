'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Where the money is, and what it has been doing.
 *
 * Balances for every group and every member, the deposits and withdrawals
 * behind them, and how those attempts ended.
 *
 * Settled money and attempted money are never added together. A rail that
 * accepts requests and never settles them looks busy in a count of attempts
 * and empty in a sum of settlements, and only showing both side by side makes
 * that visible — which is the whole reason this screen is worth having.
 */

type Flow = {
  balance_tzs: string;
  deposited_tzs: string; deposit_count: number; deposit_failed: number; deposit_open: number;
  withdrawn_tzs: string; withdrawal_count: number; withdrawal_failed: number; withdrawal_open: number;
};
type GroupRow = Flow & { id: number; name: string; status: string; member_count: number };
type MemberRow = Flow & { id: number; name: string; phone: string | null; status: string };
type StatusRow = { type: string; status: string; n: number; total_tzs: string };
type RecentRow = {
  id: number; type: string; status: string; amount_tzs: string; phone: string | null;
  purpose: string | null; created_at: string; member_name: string | null; group_name: string | null;
};
type Totals = {
  memberBalances: number; groupBalances: number; platformBalances: number;
  heldTzs: number; depositedTzs: number; withdrawnTzs: number; openCount: number;
};

const tsh = (n: number | string) => `TSh ${Math.round(Number(n)).toLocaleString('en-US')}`;

const SETTLED = ['minted', 'burned', 'completed', 'confirmed', 'success', 'successful'];
const FAILED = ['failed', 'rejected', 'cancelled'];

function statusTone(status: string): string {
  if (SETTLED.includes(status)) return 'text-emerald-500';
  if (FAILED.includes(status)) return 'text-destructive';
  return 'text-gold-deep';
}

export default function BalancesSection() {
  const { t } = useLanguage();
  const [data, setData] = useState<{
    totals: Totals; groups: GroupRow[]; members: MemberRow[];
    statuses: StatusRow[]; recent: RecentRow[];
  } | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'groups' | 'members' | 'activity'>('groups');
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    checked: number; corrected: number; refundedTzs: number; creditedTzs: number; receiptsSent: number;
  } | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/ledger');
      if (!res.ok) { setError(t('adm.bal.failed')); return; }
      setData(await res.json());
    } catch {
      setError(t('adm.bal.failed'));
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  /**
   * Ask nTZS about everything unfinished and apply the answers. The schedule
   * is supposed to make this unnecessary; until it does, this is how a stuck
   * balance gets unstuck without anyone opening a database.
   */
  const sync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/ledger/sync', { method: 'POST' });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setError(d?.error || t('adm.bal.syncFailed')); return; }
      setSyncResult(d);
      await load();
    } catch {
      setError(t('adm.bal.syncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  const groups = useMemo(
    () => (data?.groups ?? []).filter((g) => g.name?.toLowerCase().includes(q.toLowerCase())),
    [data, q]
  );
  const members = useMemo(
    () => (data?.members ?? []).filter((m) =>
      m.name?.toLowerCase().includes(q.toLowerCase()) || (m.phone ?? '').includes(q)),
    [data, q]
  );

  if (error) {
    return <div className="rounded-xl bg-card border border-border p-5 text-sm text-destructive">{error}</div>;
  }
  if (!data) {
    return <div className="rounded-xl bg-card border border-border p-5 text-sm text-muted-foreground">{t('adm.bal.loading')}</div>;
  }

  const { totals } = data;

  const cards: [string, string, string?][] = [
    [t('adm.bal.memberBalances'), tsh(totals.memberBalances)],
    [t('adm.bal.groupBalances'), tsh(totals.groupBalances)],
    [t('adm.bal.deposited'), tsh(totals.depositedTzs), t('adm.bal.settledOnly')],
    [t('adm.bal.withdrawn'), tsh(totals.withdrawnTzs), t('adm.bal.settledOnly')],
    [t('adm.bal.open'), String(totals.openCount), t('adm.bal.openDesc')],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('adm.bal.title')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('adm.bal.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setData(null); load(); }}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground"
          >
            {t('adm.bal.refresh')}
          </button>
          <button
            onClick={sync}
            disabled={syncing}
            title={t('adm.bal.syncDesc')}
            className="rounded-lg bg-foreground px-3.5 py-2 text-xs font-semibold text-background disabled:opacity-40"
          >
            {syncing ? t('adm.bal.syncing') : t('adm.bal.sync')}
          </button>
        </div>
      </div>

      {/* Refresh only re-reads what we already believe. This says what changed
          when we asked nTZS what is actually true. */}
      {syncResult && (
        <div className="rounded-xl border border-border bg-card p-4 text-xs">
          <p className="font-semibold text-foreground">
            {syncResult.corrected > 0 ? t('adm.bal.syncFixed') : t('adm.bal.syncClean')}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t('adm.bal.syncChecked')}: {syncResult.checked} · {t('adm.bal.syncCorrected')}: {syncResult.corrected}
            {syncResult.refundedTzs > 0 && <> · {t('adm.bal.syncRefunded')}: {tsh(syncResult.refundedTzs)}</>}
            {syncResult.creditedTzs > 0 && <> · {t('adm.bal.syncCredited')}: {tsh(syncResult.creditedTzs)}</>}
            {syncResult.receiptsSent > 0 && <> · {t('adm.bal.syncReceipts')}: {syncResult.receiptsSent}</>}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map(([label, value, note]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-lg font-bold text-foreground tabular-nums">{value}</p>
            {note && <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>}
          </div>
        ))}
      </div>

      {/* How attempts ended, by rail. The single most useful table here: a
          status with many attempts and no settlements is a broken rail, and
          it is invisible in any figure that mixes the two. */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold text-foreground">{t('adm.bal.statuses')}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[440px] text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 font-medium">{t('adm.bal.type')}</th>
                <th className="pb-2 font-medium">{t('adm.bal.status')}</th>
                <th className="pb-2 text-right font-medium">{t('adm.bal.count')}</th>
                <th className="pb-2 text-right font-medium">{t('adm.bal.value')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.statuses.map((s, i) => (
                <tr key={`${s.type}-${s.status}-${i}`}>
                  <td className="py-2 text-foreground">{s.type}</td>
                  <td className={`py-2 font-medium ${statusTone(s.status)}`}>{s.status}</td>
                  <td className="py-2 text-right tabular-nums text-foreground">{s.n}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{tsh(s.total_tzs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([['groups', t('adm.bal.tabGroups')], ['members', t('adm.bal.tabMembers')], ['activity', t('adm.bal.tabActivity')]] as const)
          .map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                tab === id ? 'bg-foreground text-background' : 'border border-border text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        {tab !== 'activity' && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('adm.bal.search')}
            className="ml-auto w-full max-w-[220px] rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-foreground"
          />
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {tab === 'groups' && (
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('adm.bal.group')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('adm.bal.balance')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('adm.bal.depositedShort')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('adm.bal.withdrawnShort')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('adm.bal.attempts')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{g.name}</p>
                    <p className="text-[10px] text-muted-foreground">{g.member_count} · {g.status}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{tsh(g.balance_tzs)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {tsh(g.deposited_tzs)}<span className="ml-1 text-[10px]">×{g.deposit_count}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {tsh(g.withdrawn_tzs)}<span className="ml-1 text-[10px]">×{g.withdrawal_count}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-[10px] tabular-nums">
                    {g.deposit_open + g.withdrawal_open > 0 && (
                      <span className="text-gold-deep">{g.deposit_open + g.withdrawal_open} {t('adm.bal.openShort')} </span>
                    )}
                    {g.deposit_failed + g.withdrawal_failed > 0 && (
                      <span className="text-destructive">{g.deposit_failed + g.withdrawal_failed} {t('adm.bal.failedShort')}</span>
                    )}
                    {g.deposit_open + g.withdrawal_open + g.deposit_failed + g.withdrawal_failed === 0 && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'members' && (
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('adm.bal.member')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('adm.bal.balance')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('adm.bal.depositedShort')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('adm.bal.withdrawnShort')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('adm.bal.attempts')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{m.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{m.phone || '—'} · {m.status}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{tsh(m.balance_tzs)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {tsh(m.deposited_tzs)}<span className="ml-1 text-[10px]">×{m.deposit_count}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {tsh(m.withdrawn_tzs)}<span className="ml-1 text-[10px]">×{m.withdrawal_count}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-[10px] tabular-nums">
                    {m.deposit_open + m.withdrawal_open > 0 && (
                      <span className="text-gold-deep">{m.deposit_open + m.withdrawal_open} {t('adm.bal.openShort')} </span>
                    )}
                    {m.deposit_failed + m.withdrawal_failed > 0 && (
                      <span className="text-destructive">{m.deposit_failed + m.withdrawal_failed} {t('adm.bal.failedShort')}</span>
                    )}
                    {m.deposit_open + m.withdrawal_open + m.deposit_failed + m.withdrawal_failed === 0 && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'activity' && (
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('adm.bal.when')}</th>
                <th className="px-4 py-3 font-medium">{t('adm.bal.who')}</th>
                <th className="px-4 py-3 font-medium">{t('adm.bal.type')}</th>
                <th className="px-4 py-3 font-medium">{t('adm.bal.status')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('adm.bal.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.recent.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {r.member_name || r.group_name || '—'}
                    {r.purpose && <span className="ml-1 text-[10px] text-muted-foreground">({r.purpose})</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.type}</td>
                  <td className={`px-4 py-3 font-medium ${statusTone(r.status)}`}>{r.status}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{tsh(r.amount_tzs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
