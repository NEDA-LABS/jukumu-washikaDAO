'use client';

import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const [walletTotals, setWalletTotals] = useState<WalletTotals | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [reconcile, setReconcile] = useState<any>(null);
  const [reconcileLoading, setReconcileLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recPhone, setRecPhone] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recRef, setRecRef] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [recMsg, setRecMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fundAmount, setFundAmount] = useState('6000');
  const [fundPhone, setFundPhone] = useState('');
  const [funding, setFunding] = useState(false);
  const [fundMsg, setFundMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllMsg, setSyncAllMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    // The sweep runs in budgeted passes (so it can't time out); loop until done.
    let totalSwept = 0, totalReceived = 0, lastFailed = 0;
    try {
      for (let pass = 0; pass < 15; pass++) {
        const r = await fetch('/api/admin/treasury/sweep', { method: 'POST' });
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.success) {
          setSweepMsg({ type: 'error', text: d?.error || d?.details || 'Imeshindikana kuhamisha fedha' });
          break;
        }
        totalSwept += Number(d.swept || 0);
        totalReceived += Number(d.totalReceivedTzs || 0);
        lastFailed = Number(d.failed || 0);
        loadReconcile();
        loadWalletTotals();
        if (d.done) {
          setSweepMsg({
            type: lastFailed > 0 ? 'error' : 'success',
            text: `Imekamilika: pochi ${totalSwept} zimehamishwa (TSH ${totalReceived.toLocaleString()} kwa hazina kuu)${lastFailed ? `, ${lastFailed} zimeshindwa` : ''}.`,
          });
          break;
        }
        // Budget hit mid-way — show progress and continue with the next pass.
        setSweepMsg({ type: 'success', text: `Inahamisha… pochi ${totalSwept} (TSH ${totalReceived.toLocaleString()}), ${d.remaining} zinaendelea…` });
        if (Number(d.swept || 0) === 0) {
          // No progress this pass — stop rather than loop forever.
          setSweepMsg({ type: 'error', text: `Imesimama baada ya pochi ${totalSwept}. ${d.remaining} hazijahamishwa — jaribu tena.` });
          break;
        }
      }
    } catch {
      setSweepMsg({ type: 'error', text: t('adm.c.networkErr') });
    } finally {
      setSweeping(false);
    }
  };

  const handleReconcile = async () => {
    const amount = Math.round(Number(recAmount));
    if (!recPhone.trim() || !Number.isFinite(amount) || amount <= 0) {
      setRecMsg({ type: 'error', text: 'Weka namba ya simu na kiasi sahihi.' });
      return;
    }
    if (!window.confirm(`Punguza TSH ${amount.toLocaleString()} kwenye salio la mwanachama (${recPhone})? Tumia tu kwa malipo yaliyokwisha tolewa nje (nTZS).`)) return;
    setReconciling(true);
    setRecMsg(null);
    try {
      const r = await fetch('/api/admin/treasury/record-external-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberPhone: recPhone.trim(), amountTzs: amount, reference: recRef.trim() || undefined }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.success) {
        setRecMsg({ type: 'success', text: `Imerekebishwa: ${d.memberName || 'mwanachama'} salio ${Number(d.balanceBeforeTzs).toLocaleString()} → ${Number(d.balanceAfterTzs).toLocaleString()} TSH.` });
        setRecAmount(''); setRecRef('');
        loadReconcile();
        loadWalletTotals();
      } else {
        setRecMsg({ type: 'error', text: d?.error || d?.details || 'Imeshindikana kurekebisha' });
      }
    } catch {
      setRecMsg({ type: 'error', text: t('adm.c.networkErr') });
    } finally {
      setReconciling(false);
    }
  };

  const handleFund = async () => {
    const amt = Number(fundAmount);
    if (!amt || amt < 100 || !fundPhone.trim()) {
      setFundMsg({ type: 'error', text: 'Weka kiasi (≥100) na namba ya simu.' });
      return;
    }
    if (!window.confirm(`Tuma STK push ya TSH ${amt.toLocaleString()} kwa ${fundPhone} kuongeza fedha kwenye hazina kuu?`)) return;
    setFunding(true);
    setFundMsg(null);
    try {
      const r = await fetch('/api/admin/treasury/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTzs: amt, phone: fundPhone.trim() }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.success) {
        setFundMsg({
          type: 'success',
          text: `STK push imetumwa (TSH ${amt.toLocaleString()} → ${d.phone}). Ithibitishe kwenye simu; ikishakamilika (minted), hazina itaongezeka kiotomatiki.`,
        });
        setTimeout(() => loadReconcile(), 3000);
      } else {
        setFundMsg({ type: 'error', text: d?.error || 'Imeshindikana kutuma STK push' });
      }
    } catch {
      setFundMsg({ type: 'error', text: t('adm.c.networkErr') });
    } finally {
      setFunding(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setSyncAllMsg(null);
    try {
      const r = await fetch('/api/cron/settle-deposits', { method: 'POST', headers: { 'content-type': 'application/json' } });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) {
        setSyncAllMsg({ type: 'error', text: d?.error || 'Imeshindikana kusawazisha' });
        return;
      }
      const n = d.ntzs || {};
      const s = d.snippe || {};
      const errParts = [
        ...(Array.isArray(d.errors) ? d.errors : []),
        ...(n.apiError ? [`nTZS: ${n.apiError}`] : []),
        ...(s.apiError ? [`Snippe: ${s.apiError}`] : []),
      ];
      const errNote = errParts.length ? ` | Hitilafu: ${errParts.join(' | ')}` : '';
      const creditedTotal = (n.credited || 0) + (s.credited || 0);
      const creditedTzs = (n.creditedTzs || 0) + (s.creditedTzs || 0);
      if (creditedTotal > 0) {
        setSyncAllMsg({ type: 'success', text: `Imekamilika: amana ${creditedTotal} zimewekwa kwenye salio (${fmtTzs(creditedTzs)}).${errNote}` });
      } else {
        // Nothing new to credit. That's healthy unless an error was reported —
        // show what nTZS returned either way so there's never a mystery.
        const counts = n.liveStatusCounts ? Object.entries(n.liveStatusCounts).map(([k, v]) => `${k}:${v}`).join(', ') : 'hakuna';
        setSyncAllMsg({
          type: errParts.length ? 'error' : 'success',
          text: `Hakuna amana mpya ya kuweka. Zimechunguzwa ${n.checked || 0} (hali: ${counts}).${errNote}`,
        });
      }
      loadReconcile();
      loadWalletTotals();
    } catch {
      setSyncAllMsg({ type: 'error', text: t('adm.c.networkErr') });
    } finally {
      setSyncingAll(false);
    }
  };

  const stats = [
    { name: t('adm.stat.members'), value: adminStats?.totalMembers?.toLocaleString() || '0', change: adminStats?.newMembersThisMonth ? `+${adminStats.newMembersThisMonth} ${t('adm.thisMonth')}` : '—', accent: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { name: t('adm.stat.activeGroups'), value: adminStats?.totalGroups?.toLocaleString() || '0', change: adminStats?.newGroupsThisMonth ? `+${adminStats.newGroupsThisMonth} ${t('adm.thisMonth')}` : '—', accent: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { name: 'Uwekezaji', value: adminStats?.totalInvestment ? `TSH ${(adminStats.totalInvestment/1000000).toFixed(1)}M` : 'TSH 0', change: `${adminStats?.returnRate || 0}% mapato`, accent: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    { name: 'Mapato', value: adminStats?.totalReturns ? `TSH ${(adminStats.totalReturns/1000000).toFixed(1)}M` : 'TSH 0', change: `${adminStats?.returnRate || 0}% kiwango`, accent: 'text-purple-600', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  ];

  const walletStats = [
    {
      name: t('adm.stat.memberBalance'),
      value: walletLoading ? '…' : fmtTzs(walletTotals?.totalMembersBalance ?? 0),
      change: walletLoading ? '' : `${walletTotals?.membersWithWallet ?? 0} ${t('adm.walletsLinked')}`,
      accent: 'text-teal-600', bg: 'bg-teal-500/10', border: 'border-teal-500/20',
    },
    {
      name: t('adm.stat.groupBalance'),
      value: walletLoading ? '…' : fmtTzs(walletTotals?.totalGroupsBalance ?? 0),
      change: walletLoading ? '' : `${walletTotals?.groupsWithWallet ?? 0} ${t('adm.walletsLinked')}`,
      accent: 'text-rose-600', bg: 'bg-rose-500/10', border: 'border-rose-500/20',
    },
    {
      name: t('adm.stat.totalBalance'),
      value: walletLoading ? '…' : fmtTzs(walletTotals?.totalWalletBalance ?? 0),
      change: walletLoading ? '' : walletTotals && walletTotals.failedFetches > 0
        ? `⚠ ${walletTotals.failedFetches} ${t('adm.walletsFailed')}`
        : t('adm.walletsChecked'),
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
          <h3 className="text-sm font-semibold text-foreground">{t('adm.treasury.title')}</h3>
          {reconcile && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${(reconcile.driftTzs ?? 0) < 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-600'}`}>
              {(reconcile.driftTzs ?? 0) < 0 ? t('adm.treasury.needsFunding') : t('adm.treasury.funded')}
            </span>
          )}
        </div>
        {reconcileLoading ? (
          <p className="text-xs text-muted-foreground">Inapakia…</p>
        ) : reconcile ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">{t('adm.treasury.onChain')}</p>
                <p className="text-base font-bold text-foreground">{fmtTzs(reconcile.masterOnChainTzs ?? 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">{t('adm.treasury.liabilities')}</p>
                <p className="text-base font-bold text-foreground">{fmtTzs(reconcile.ledgerLiabilitiesTzs ?? 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">{t('adm.treasury.drift')}</p>
                <p className={`text-base font-bold ${(reconcile.driftTzs ?? 0) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{fmtTzs(reconcile.driftTzs ?? 0)}</p>
              </div>
            </div>
            {(reconcile.driftTzs ?? 0) < 0 && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                {t('adm.treasury.shortfall')}
              </p>
            )}
            {/* Primary: pull every minted deposit from nTZS onto balances now */}
            <div className="space-y-1 pb-1">
              <p className="text-[10px] text-muted-foreground leading-snug">
                {t('adm.treasury.syncHelp')}
              </p>
              {syncAllMsg && (
                <p className={`text-xs ${syncAllMsg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{syncAllMsg.text}</p>
              )}
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={syncingAll}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {syncingAll ? t('adm.treasury.syncing') : t('adm.treasury.syncNow')}
              </button>
            </div>

            {sweepMsg && (
              <p className={`text-xs ${sweepMsg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{sweepMsg.text}</p>
            )}
            <button
              type="button"
              onClick={handleSweep}
              disabled={sweeping}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {sweeping ? t('adm.treasury.sweeping') : t('adm.treasury.sweep')}
            </button>

            {/* Fund the master treasury (STK push mints straight into the master,
                no member credited) — covers the sweep-fee shortfall */}
            <div className="space-y-1 pt-1">
              <p className="text-[10px] text-muted-foreground leading-snug">
                Ongeza fedha kwenye hazina kuu (STK push huingiza moja kwa moja kwenye hazina, hakuna mwanachama anayelipwa). Tumia kufidia upungufu wa ada za usafirishaji.
              </p>
              {fundMsg && (
                <p className={`text-xs ${fundMsg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{fundMsg.text}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="Kiasi (TZS)"
                  className="rounded-lg bg-background border border-border px-3 py-2 text-sm"
                />
                <input
                  type="tel"
                  value={fundPhone}
                  onChange={(e) => setFundPhone(e.target.value)}
                  placeholder="Namba ya simu (07XX...)"
                  className="rounded-lg bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleFund}
                disabled={funding}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-blue-500/40 text-blue-600 hover:bg-blue-500/10 disabled:opacity-50"
              >
                {funding ? 'Inatuma STK…' : 'Ongeza fedha kwenye hazina (STK)'}
              </button>
            </div>

            {/* Reconcile a withdrawal that left on nTZS but didn't debit the member */}
            <div className="mt-2 pt-3 border-t border-border space-y-2">
              <p className="text-[11px] font-semibold text-foreground">Rekebisha malipo yaliyotoka nje</p>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Tumia tu kama pesa zilitoka (nTZS) lakini salio la mwanachama halikupungua. Punguza salio lake kwa kiasi kilichotoka tayari.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="tel"
                  value={recPhone}
                  onChange={(e) => setRecPhone(e.target.value)}
                  placeholder="Simu ya mwanachama"
                  className="rounded-lg bg-background border border-border px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={recAmount}
                  onChange={(e) => setRecAmount(e.target.value)}
                  placeholder="Kiasi kilichotoka (TZS)"
                  className="rounded-lg bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <input
                type="text"
                value={recRef}
                onChange={(e) => setRecRef(e.target.value)}
                placeholder="Kumbukumbu ya nTZS / withdrawal id (hiari)"
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm"
              />
              {recMsg && (
                <p className={`text-xs ${recMsg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{recMsg.text}</p>
              )}
              <button
                type="button"
                onClick={handleReconcile}
                disabled={reconciling}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-foreground hover:bg-foreground/5 disabled:opacity-50"
              >
                {reconciling ? 'Inarekebisha…' : 'Rekebisha salio'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('adm.o.treasuryLoadErr')}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t('adm.memberGrowth')}</h3>
          <GrowthChart memberCount={adminStats?.totalMembers || 0} groupCount={adminStats?.totalGroups || 0} />
        </div>

        <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t('adm.o.recentActivity')}</h3>
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
              <p className="text-sm text-muted-foreground">{t('adm.o.noActivity')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
