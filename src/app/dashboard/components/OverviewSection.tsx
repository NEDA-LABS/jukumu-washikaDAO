'use client';

import { useEffect, useState } from 'react';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import GrowthChart from '@/components/GrowthChart';

interface WalletTotals {
  totalMembersBalance: number;
  totalGroupsBalance: number;
  totalWalletBalance: number;
  membersWithWallet: number;
  groupsWithWallet: number;
  failedFetches: number;
}

function fmtTzs(n: number) {
  if (n >= 1_000_000) return `TSH ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `TSH ${(n / 1_000).toFixed(1)}K`;
  return `TSH ${n.toLocaleString()}`;
}

export default function OverviewSection({ adminStats, recentActivities }: { adminStats: any; recentActivities: any[] }) {
  const [walletTotals, setWalletTotals] = useState<WalletTotals | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [reconcile, setReconcile] = useState<any>(null);
  const [reconcileLoading, setReconcileLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadWalletTotals = () => {
    fetch('/api/admin/wallet-totals')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setWalletTotals(d); })
      .finally(() => setWalletLoading(false));
  };

  const loadReconcile = () => {
    setReconcileLoading(true);
    fetch('/api/admin/treasury/reconcile')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setReconcile(d); })
      .finally(() => setReconcileLoading(false));
  };

  useEffect(() => { loadWalletTotals(); loadReconcile(); }, []);

  const handleSweep = async () => {
    if (!window.confirm('Hamisha fedha zote za pochi za zamani kwenda Hazina Kuu? Hii inawezesha kutoa pesa (withdrawals).')) return;
    setSweeping(true);
    setSweepMsg(null);
    try {
      const r = await fetch('/api/admin/treasury/sweep', { method: 'POST' });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.success) {
        setSweepMsg({
          type: 'success',
          text: `Imekamilika: pochi ${d.swept} zimehamishwa (TSH ${Number(d.totalReceivedTzs || 0).toLocaleString()} kwa hazina kuu)${d.failed ? `, ${d.failed} zimeshindwa` : ''}.`,
        });
        loadReconcile();
        loadWalletTotals();
      } else {
        setSweepMsg({ type: 'error', text: d?.error || d?.details || 'Imeshindikana kuhamisha fedha' });
      }
    } catch {
      setSweepMsg({ type: 'error', text: 'Hitilafu ya mtandao' });
    } finally {
      setSweeping(false);
    }
  };

  const stats = [
    { name: 'Wanachama', value: adminStats?.totalMembers?.toLocaleString() || '0', change: adminStats?.newMembersThisMonth ? `+${adminStats.newMembersThisMonth} mwezi huu` : '—', accent: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { name: 'Makundi Hai', value: adminStats?.totalGroups?.toLocaleString() || '0', change: adminStats?.newGroupsThisMonth ? `+${adminStats.newGroupsThisMonth} mwezi huu` : '—', accent: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { name: 'Uwekezaji', value: adminStats?.totalInvestment ? `TSH ${(adminStats.totalInvestment/1000000).toFixed(1)}M` : 'TSH 0', change: `${adminStats?.returnRate || 0}% mapato`, accent: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    { name: 'Mapato', value: adminStats?.totalReturns ? `TSH ${(adminStats.totalReturns/1000000).toFixed(1)}M` : 'TSH 0', change: `${adminStats?.returnRate || 0}% kiwango`, accent: 'text-purple-600', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  ];

  const walletStats = [
    {
      name: 'Salio Wanachama',
      value: walletLoading ? '…' : fmtTzs(walletTotals?.totalMembersBalance ?? 0),
      change: walletLoading ? '' : `${walletTotals?.membersWithWallet ?? 0} pochi zilizounganishwa`,
      accent: 'text-teal-600', bg: 'bg-teal-500/10', border: 'border-teal-500/20',
    },
    {
      name: 'Salio Makundi',
      value: walletLoading ? '…' : fmtTzs(walletTotals?.totalGroupsBalance ?? 0),
      change: walletLoading ? '' : `${walletTotals?.groupsWithWallet ?? 0} pochi zilizounganishwa`,
      accent: 'text-rose-600', bg: 'bg-rose-500/10', border: 'border-rose-500/20',
    },
    {
      name: 'Jumla ya Salio',
      value: walletLoading ? '…' : fmtTzs(walletTotals?.totalWalletBalance ?? 0),
      change: walletLoading ? '' : walletTotals && walletTotals.failedFetches > 0
        ? `⚠ ${walletTotals.failedFetches} pochi zilishindwa`
        : 'pochi zote zimepitiwa',
      accent: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
    },
  ];

  const displayActivities = (recentActivities || []).slice(0, 6).map((a: any) => ({
    action: a.action, user: a.user_name,
    time: new Date(a.activity_date).toLocaleDateString('sw-TZ')
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className={`rounded-xl ${s.bg} border ${s.border} p-4`}>
            <p className="text-xs text-muted-foreground mb-1">{s.name}</p>
            <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
            <p className="text-xs text-foreground/25 mt-1">{s.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {walletStats.map((s, i) => (
          <div key={i} className={`rounded-xl ${s.bg} border ${s.border} p-4 flex items-center gap-4`}>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-1">{s.name}</p>
              <p className={`text-xl font-bold ${s.accent} ${walletLoading ? 'animate-pulse' : ''}`}>{s.value}</p>
              <p className="text-xs text-foreground/25 mt-1">{s.change}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Master treasury — reconcile readout + on-chain sweep */}
      <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-foreground">Hazina Kuu (Master Treasury)</h3>
          {reconcile && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${(reconcile.driftTzs ?? 0) < 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-600'}`}>
              {(reconcile.driftTzs ?? 0) < 0 ? 'Inahitaji kufadhiliwa' : 'Imefadhiliwa'}
            </span>
          )}
        </div>
        {reconcileLoading ? (
          <p className="text-xs text-muted-foreground">Inapakia…</p>
        ) : reconcile ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Salio la mnyororo (on-chain)</p>
                <p className="text-base font-bold text-foreground">{fmtTzs(reconcile.masterOnChainTzs ?? 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Madeni (salio za watumiaji)</p>
                <p className="text-base font-bold text-foreground">{fmtTzs(reconcile.ledgerLiabilitiesTzs ?? 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Tofauti</p>
                <p className={`text-base font-bold ${(reconcile.driftTzs ?? 0) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmtTzs(reconcile.driftTzs ?? 0)}</p>
              </div>
            </div>
            {(reconcile.driftTzs ?? 0) < 0 && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                Hazina kuu ina pungufu — fedha bado ziko kwenye pochi za zamani. Bonyeza kuzihamisha ili kutoa pesa (withdrawals) kufanye kazi.
              </p>
            )}
            {sweepMsg && (
              <p className={`text-xs ${sweepMsg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{sweepMsg.text}</p>
            )}
            <button
              type="button"
              onClick={handleSweep}
              disabled={sweeping}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {sweeping ? 'Inahamisha…' : 'Hamisha fedha kwa Hazina Kuu'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Imeshindwa kupakia taarifa za hazina.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">Ukuaji wa Wanachama</h3>
          <GrowthChart memberCount={adminStats?.totalMembers || 0} groupCount={adminStats?.totalGroups || 0} />
        </div>

        <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">Shughuli za Hivi Karibuni</h3>
          {displayActivities.length > 0 ? (
            <div className="space-y-3">
              {displayActivities.map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground/70 leading-snug">{a.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.user} · {a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <ChartBarIcon className="h-8 w-8 mx-auto text-foreground/10 mb-3" />
              <p className="text-sm text-muted-foreground">Hakuna shughuli za hivi karibuni</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
