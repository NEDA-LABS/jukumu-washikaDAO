'use client';

import React, { useCallback, useEffect, useState } from 'react';

type Partner = {
  id: number;
  user_id: number;
  org_name: string;
  contact_email: string;
  website: string | null;
  use_case: string;
  status: string;
  write_enabled: boolean;
  write_requested: boolean;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
  active_keys: number;
  requests_7d: number;
};

type TreasuryRow = {
  partnerId: number | null;
  orgName: string;
  liabilitiesTzs: number;
  memberBalanceTzs: number;
  groupBalanceTzs: number;
  depositedInTzs: number;
  withdrawnOutTzs: number;
  netContributedTzs: number;
  attributedFloatTzs: number | null;
  shortfallTzs: number | null;
};

type Treasury = {
  masterOnChainTzs: number | null;
  totalLiabilitiesTzs: number;
  coverageRatio: number | null;
  fullyBacked: boolean | null;
  partners: TreasuryRow[];
  onChainError: string | null;
};

const tsh = (n: number | null | undefined) =>
  n == null ? '—' : `TSh ${Math.round(n).toLocaleString('en-US')}`;

export default function PartnersSection({ showToast }: { showToast?: (m: string, t?: 'success' | 'error') => void }) {
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/partners');
      if (!res.ok) { setPartners([]); return; }
      const d = await res.json();
      setPartners(d.partners ?? []);
    } catch { setPartners([]); }
  }, []);

  const loadTreasury = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/treasury/partners');
      if (!res.ok) return;
      setTreasury(await res.json());
    } catch { /* the panel simply stays hidden */ }
  }, []);

  useEffect(() => { load(); loadTreasury(); }, [load, loadTreasury]);

  const update = async (id: number, patch: Record<string, unknown>, note: string) => {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_id: id, ...patch }),
      });
      if (res.ok) { showToast?.(note, 'success'); load(); }
      else showToast?.('Could not update the partner.', 'error');
    } finally { setBusy(null); }
  };

  const pending = (partners ?? []).filter((p) => p.write_requested && !p.write_enabled);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">API partners</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organisations building on the API. Read access is self-serve; write access moves real
          money and is only enabled here.
        </p>
      </div>

      {treasury && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground">Treasury by tenant</h3>
            <span className={`text-xs font-semibold ${
              treasury.fullyBacked === false ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
            }`}>
              {treasury.coverageRatio === null
                ? treasury.onChainError ?? 'On-chain balance unavailable'
                : `Float ${tsh(treasury.masterOnChainTzs)} · covers ${(treasury.coverageRatio * 100).toFixed(1)}% of ${tsh(treasury.totalLiabilitiesTzs)}`}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            All tenants share one on-chain wallet. Liabilities are exact; attributed float is the
            pool&rsquo;s coverage applied pro-rata, not physically separated money.
          </p>

          <div className="mt-4 max-w-full overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">Tenant</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Owed to users</th>
                  <th className="pb-2 pr-3 text-right font-semibold">In</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Out</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Net float</th>
                  <th className="pb-2 text-right font-semibold">Shortfall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {treasury.partners.map((r) => (
                  <tr key={r.partnerId ?? 'first-party'}>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-foreground">{r.orgName}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {tsh(r.memberBalanceTzs)} members · {tsh(r.groupBalanceTzs)} groups
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">{tsh(r.liabilitiesTzs)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{tsh(r.depositedInTzs)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{tsh(r.withdrawnOutTzs)}</td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${
                      r.netContributedTzs < 0 ? 'text-red-500' : 'text-muted-foreground'
                    }`}>{tsh(r.netContributedTzs)}</td>
                    <td className={`py-2.5 text-right tabular-nums ${
                      (r.shortfallTzs ?? 0) > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                    }`}>{r.shortfallTzs == null ? '—' : tsh(r.shortfallTzs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {treasury.fullyBacked === false && (
            <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              On-chain float is below total liabilities — run the treasury sweep before large withdrawals.
            </p>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            {pending.length} partner{pending.length > 1 ? 's are' : ' is'} waiting for write access
          </p>
        </div>
      )}

      {partners === null ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : partners.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No partners have registered yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-gold text-sm font-bold text-white">
                  {p.org_name.charAt(0).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{p.org_name}</p>
                    {p.status === 'suspended' && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-500">
                        suspended
                      </span>
                    )}
                    {p.write_enabled ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                        write enabled
                      </span>
                    ) : p.write_requested ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                        write requested
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.contact_email}
                    {p.website && <> · <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.website}</a></>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {p.active_keys} active key{p.active_keys === 1 ? '' : 's'} · {p.requests_7d.toLocaleString()} reqs/7d ·
                    joined {new Date(p.created_at).toLocaleDateString('en-GB')}
                    {p.user_email && ` · ${p.user_email}`}
                  </p>

                  <button
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    className="mt-2 text-[11px] font-semibold text-primary hover:underline"
                  >
                    {expanded === p.id ? 'Hide use case' : 'View use case'}
                  </button>
                  {expanded === p.id && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
                      {p.use_case}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    onClick={() => update(p.id, { write_enabled: !p.write_enabled },
                      p.write_enabled ? 'Write access revoked.' : 'Write access enabled.')}
                    disabled={busy === p.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      p.write_enabled
                        ? 'border border-border text-muted-foreground hover:border-red-500/40 hover:text-red-500'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {p.write_enabled ? 'Revoke write' : 'Enable write'}
                  </button>
                  <button
                    onClick={() => update(p.id, { status: p.status === 'active' ? 'suspended' : 'active' },
                      p.status === 'active' ? 'Partner suspended.' : 'Partner reactivated.')}
                    disabled={busy === p.id}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    {p.status === 'active' ? 'Suspend' : 'Reactivate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
