'use client';

import React, { useEffect, useState } from 'react';

type Overview = {
  partner: { id: number; org_name: string; first_party: boolean };
  people: { members: number; members_active: number; members_with_business: number };
  groups: { total: number; active: number; memberships: number; avg_members: number };
  money: {
    volume_processed_tzs: number; held_in_groups_tzs: number; held_by_members_tzs: number;
    contributions_collected_tzs: number; contributions_count: number;
    disbursed_tzs: number; deposits_tzs: number; withdrawals_tzs: number;
  };
  treasury: {
    liabilities_tzs: number; deposited_in_tzs: number; withdrawn_out_tzs: number;
    net_contributed_tzs: number; attributed_float_tzs: number | null;
    shortfall_tzs: number | null; coverage_ratio: number | null; fully_backed: boolean | null;
  };
  governance: { proposals: number; proposals_open: number; proposals_funded: number; votes_cast: number };
  activity: { tx_24h: number; tx_7d: number; tx_30d: number };
  top_groups: { id: number; name: string; balance_tzs: string; member_count: number; status: string }[];
  recent_transactions: {
    id: number; type: string; purpose: string | null; status: string; amount_tzs: number;
    created_at: string; from_member: string | null; to_member: string | null;
    from_group: string | null; to_group: string | null;
  }[];
  daily_volume: { day: string; volume_tzs: string; tx_count: number }[];
  generated_at: string;
};

const tsh = (n: number | string) => `TSh ${Math.round(Number(n)).toLocaleString('en-US')}`;
const compact = (n: number | string) => {
  const v = Number(n);
  if (v >= 1_000_000_000) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
};

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums" style={accent ? { color: accent } : undefined}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function PlatformOverview() {
  const [d, setD] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/developer/overview')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setD)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  if (!d) {
    return (
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  const maxDaily = Math.max(...d.daily_volume.map((x) => Number(x.volume_tzs)), 1);
  const isEmpty = d.people.members === 0 && d.groups.total === 0;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl text-foreground">
          {d.partner.first_party ? 'Platform overview' : 'Your overview'}
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Live · {new Date(d.generated_at).toLocaleTimeString('en-GB')}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {d.partner.first_party
          ? 'Every tenant on the platform, because this is an internal first-party account.'
          : 'Your own groups and members only — the same slice your API key returns.'}
      </p>

      {isEmpty && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-semibold text-foreground">Nothing here yet</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Your tenant starts empty — you can&rsquo;t see groups or people created by WashikaDAU
            or by other partners. Create your first member with{' '}
            <code className="font-mono text-xs text-foreground">POST /api/v1/members/create</code>,
            then a group for them to lead.
          </p>
        </div>
      )}

      {/* People + groups */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Members" value={d.people.members.toLocaleString()} sub={`${d.people.members_with_business.toLocaleString()} run a business`} />
        <Stat label="Active members" value={d.people.members_active.toLocaleString()} />
        <Stat label="Groups" value={d.groups.total.toLocaleString()} sub={`${d.groups.active} active · avg ${d.groups.avg_members} members`} />
        <Stat label="Memberships" value={d.groups.memberships.toLocaleString()} />
      </div>

      {/* Treasury */}
      <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-muted-foreground">Treasury</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="You owe your users"
          value={tsh(d.treasury.liabilities_tzs)}
          sub="Sum of your members' and groups' balances"
          accent="#e4a233"
        />
        <Stat label="Deposited in" value={tsh(d.treasury.deposited_in_tzs)} sub="Settled, lifetime" />
        <Stat label="Withdrawn out" value={tsh(d.treasury.withdrawn_out_tzs)} sub="Settled, incl. fees" />
        <Stat
          label="Net contributed"
          value={tsh(d.treasury.net_contributed_tzs)}
          sub="Float you've added to the pool"
          accent={d.treasury.net_contributed_tzs < 0 ? '#dc2626' : undefined}
        />
      </div>
      <div className={`mt-3 rounded-2xl border p-4 ${
        d.treasury.fully_backed === false
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-border bg-card'
      }`}>
        <p className="text-sm font-semibold text-foreground">
          {d.treasury.coverage_ratio === null
            ? 'Backing unavailable'
            : d.treasury.fully_backed
              ? 'Fully backed'
              : `Pool coverage ${(d.treasury.coverage_ratio * 100).toFixed(1)}%`}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {d.treasury.coverage_ratio === null
            ? 'The on-chain balance could not be read right now, so backing cannot be confirmed.'
            : d.treasury.fully_backed
              ? 'Balances are held in one shared WashikaDAU wallet whose on-chain float currently covers every tenant in full.'
              : `Funds sit in one shared wallet that currently holds less than the total owed across all tenants. Your pro-rata share is ${tsh(d.treasury.attributed_float_tzs ?? 0)}, leaving ${tsh(d.treasury.shortfall_tzs ?? 0)} uncovered until WashikaDAU tops up the float.`}
        </p>
      </div>

      {/* Money */}
      <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-muted-foreground">Money</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Volume processed" value={tsh(d.money.volume_processed_tzs)} accent="#16a34a" />
        <Stat label="Held in groups" value={tsh(d.money.held_in_groups_tzs)} accent="#e4a233" />
        <Stat label="Held by members" value={tsh(d.money.held_by_members_tzs)} />
        <Stat label="Contributions collected" value={tsh(d.money.contributions_collected_tzs)} sub={`${d.money.contributions_count} payments`} />
        <Stat label="Disbursed" value={tsh(d.money.disbursed_tzs)} />
        <Stat label="Deposits (settled)" value={tsh(d.money.deposits_tzs)} />
        <Stat label="Withdrawals (settled)" value={tsh(d.money.withdrawals_tzs)} />
      </div>

      {/* Governance + activity */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Governance</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Proposals" value={d.governance.proposals.toLocaleString()} sub={`${d.governance.proposals_open} open`} />
            <Stat label="Funded" value={d.governance.proposals_funded.toLocaleString()} sub={`${d.governance.votes_cast} votes cast`} />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Transactions</h3>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="24 hours" value={d.activity.tx_24h.toLocaleString()} />
            <Stat label="7 days" value={d.activity.tx_7d.toLocaleString()} />
            <Stat label="30 days" value={d.activity.tx_30d.toLocaleString()} />
          </div>
        </div>
      </div>

      {/* Daily volume */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold text-foreground">Daily volume · 14 days</h3>
        <div className="mt-4 flex h-28 items-end gap-1.5">
          {d.daily_volume.map((day) => {
            const h = Math.max(2, Math.round((Number(day.volume_tzs) / maxDaily) * 100));
            return (
              <div key={day.day} className="group relative flex-1">
                <div
                  className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                  style={{ height: `${h}%` }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-2 py-1 text-[10px] shadow-lg group-hover:block">
                  {day.day} · {tsh(day.volume_tzs)} · {day.tx_count} tx
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{d.daily_volume[0]?.day}</span>
          <span>peak {compact(maxDaily)}</span>
          <span>{d.daily_volume[d.daily_volume.length - 1]?.day}</span>
        </div>
      </div>

      {/* Top groups + recent tx */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-bold text-foreground">Largest treasuries</h3>
          </div>
          <div className="divide-y divide-border">
            {d.top_groups.map((g) => (
              <div key={g.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#d1622b] to-[#e4a233] text-xs font-bold text-white">
                  {g.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                  <p className="text-[11px] text-muted-foreground">{g.member_count} members · id {g.id}</p>
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">{tsh(g.balance_tzs)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-bold text-foreground">Recent transactions</h3>
          </div>
          <div className="divide-y divide-border">
            {d.recent_transactions.map((t) => {
              const who = t.from_member || t.from_group || '—';
              const to = t.to_member || t.to_group || '—';
              return (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    t.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : t.type === 'withdrawal' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                  }`}>
                    {t.type}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {who} <span className="text-muted-foreground/60">→</span> {to}
                  </p>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">{tsh(t.amount_tzs)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
