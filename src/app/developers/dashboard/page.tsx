'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashTopBar from '@/components/DashTopBar';
import PartnerRegister from './PartnerRegister';
import PlatformOverview from './PlatformOverview';
import { SECTIONS } from '@/lib/api/spec';

type KeyRow = {
  id: number;
  name: string;
  key_hint: string;
  scopes: string[];
  rate_limit_per_min: number;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  requests_7d: number;
  errors_7d: number;
  requests_today: number;
};

type EndpointUsage = { endpoint: string; requests: number; errors: number };

type Partner = {
  org_name: string; contact_email: string; website: string | null;
  status: string; write_enabled: boolean; write_requested: boolean; created_at: string;
};

const ALL_ENDPOINTS = SECTIONS.flatMap((s) =>
  s.endpoints.map((e) => ({ label: `${e.method} ${e.path}`, method: e.method, path: e.path })),
).filter((e) => e.method === 'GET' && !e.path.includes('{'));

export default function PartnerDashboard() {
  const [partner, setPartner] = useState<Partner | null | undefined>(undefined);
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [usage, setUsage] = useState<EndpointUsage[]>([]);
  const [error, setError] = useState('');

  // Create form
  const [name, setName] = useState('');
  const [wantWrite, setWantWrite] = useState(false);
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Console
  const [testPath, setTestPath] = useState(ALL_ENDPOINTS[0]?.path ?? '/api/v1/stats');
  const [testKey, setTestKey] = useState('');
  const [testOut, setTestOut] = useState('');
  const [testing, setTesting] = useState(false);

  const loadPartner = useCallback(async () => {
    try {
      const res = await fetch('/api/developer/partner');
      if (res.status === 401) { setError('unauth'); setPartner(null); return; }
      const d = await res.json();
      setPartner(d.partner ?? null);
    } catch { setPartner(null); }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/developer/keys');
      if (res.status === 401) { setError('unauth'); setKeys([]); return; }
      if (!res.ok) { setError('load'); setKeys([]); return; }
      const d = await res.json();
      setKeys(d.keys ?? []);
      setUsage(d.usage_by_endpoint ?? []);
      setError('');
    } catch {
      setError('load'); setKeys([]);
    }
  }, []);

  useEffect(() => { loadPartner(); load(); }, [loadPartner, load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setFreshKey(null);
    try {
      const res = await fetch('/api/developer/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Default key', scopes: wantWrite ? ['read', 'write'] : ['read'] }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not create the key.'); return; }
      setFreshKey(d.key);
      setTestKey(d.key);
      setName('');
      load();
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: number) => {
    await fetch(`/api/developer/keys?id=${id}`, { method: 'DELETE' });
    load();
  };

  const runTest = async () => {
    if (!testKey) { setTestOut('Paste an API key first.'); return; }
    setTesting(true);
    try {
      const res = await fetch(testPath, { headers: { Authorization: `Bearer ${testKey}` } });
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep raw */ }
      setTestOut(`HTTP ${res.status}\n\n${pretty}`);
    } catch (err) {
      setTestOut(String(err));
    } finally {
      setTesting(false);
    }
  };

  const live = (keys ?? []).filter((k) => !k.revoked_at);
  const totals = live.reduce(
    (a, k) => ({ today: a.today + k.requests_today, week: a.week + k.requests_7d, errors: a.errors + k.errors_7d }),
    { today: 0, week: 0, errors: 0 },
  );

  const card = 'rounded-2xl border border-border bg-card';
  const input =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashTopBar back="/developers" />

      <main className="wd-container py-8 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-foreground">Partner dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage API keys, watch usage, and try endpoints without leaving the page.
            </p>
          </div>
          <Link href="/developers" className="text-sm font-semibold text-primary hover:underline">
            API reference →
          </Link>
        </div>

        {error === 'unauth' && (
          <div className="mt-8 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6 text-center">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Sign in to create and manage API keys.
            </p>
            <Link
              href="/login?next=/developers/dashboard"
              className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Sign in
            </Link>
          </div>
        )}

        {error !== 'unauth' && partner === null && (
          <PartnerRegister onDone={() => { loadPartner(); load(); }} />
        )}

        {error !== 'unauth' && partner && (
          <>
            {/* Partner identity */}
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d1622b] to-[#e4a233] text-sm font-bold text-white">
                {partner.org_name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{partner.org_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {partner.contact_email} · partner since{' '}
                  {new Date(partner.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                read enabled
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  partner.write_enabled
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : partner.write_requested
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {partner.write_enabled ? 'write enabled' : partner.write_requested ? 'write under review' : 'write off'}
              </span>
            </div>

            {/* Usage summary */}
            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              {[
                { label: 'Active keys', value: String(live.length) },
                { label: 'Requests today', value: totals.today.toLocaleString() },
                { label: 'Requests · 7 days', value: totals.week.toLocaleString() },
                { label: 'Errors · 7 days', value: totals.errors.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className={`${card} p-4`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className="mt-1 font-display text-2xl tabular-nums text-foreground">{s.value}</p>
                </div>
              ))}
            </div>

            <PlatformOverview />

            {/* Fresh key reveal */}
            {freshKey && (
              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Your new key — copy it now
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This is the only time it will be shown. We store a hash, so we cannot recover it later.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs text-foreground">
                    {freshKey}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(freshKey).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className="rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
              {/* Create + list */}
              <div className="space-y-6">
                <div className={`${card} p-5`}>
                  <h2 className="text-base font-bold">Create a key</h2>
                  <form onSubmit={create} className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Label
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Reporting service"
                        className={input}
                        maxLength={120}
                      />
                    </div>
                    <label
                      className={`flex items-start gap-3 rounded-xl border border-border bg-background p-3 ${
                        partner.write_enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={wantWrite && partner.write_enabled}
                        disabled={!partner.write_enabled}
                        onChange={(e) => setWantWrite(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#d1622b]"
                      />
                      <span>
                        <span className="block text-sm font-medium text-foreground">Include write scope</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {partner.write_enabled
                            ? 'Needed to create groups and move money. Leave off for reporting-only integrations.'
                            : partner.write_requested
                              ? 'Your write request is under review. Read-only keys work in the meantime.'
                              : 'Write access is not enabled for this account. Contact us to request it.'}
                        </span>
                      </span>
                    </label>
                    <button
                      type="submit"
                      disabled={creating}
                      className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {creating ? 'Creating…' : 'Create key'}
                    </button>
                  </form>
                </div>

                <div className={`${card} overflow-hidden`}>
                  <div className="border-b border-border px-5 py-4">
                    <h2 className="text-base font-bold">Your keys</h2>
                  </div>
                  {keys === null ? (
                    <div className="space-y-2 p-5">
                      {[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}
                    </div>
                  ) : keys.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                      No keys yet. Create one above to start calling the API.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {keys.map((k) => (
                        <div key={k.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{k.name}</p>
                              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                …{k.key_hint}
                              </code>
                              {k.scopes.map((s) => (
                                <span
                                  key={s}
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    s === 'write'
                                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {s}
                                </span>
                              ))}
                              {k.revoked_at && (
                                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-500">
                                  revoked
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {k.requests_7d.toLocaleString()} reqs / 7d
                              {k.errors_7d > 0 && ` · ${k.errors_7d} errors`}
                              {' · '}
                              {k.last_used_at
                                ? `last used ${new Date(k.last_used_at).toLocaleDateString('en-GB')}`
                                : 'never used'}
                            </p>
                          </div>
                          {!k.revoked_at && (
                            <button
                              onClick={() => revoke(k.id)}
                              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-500"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Console + usage */}
              <div className="space-y-6">
                <div className={`${card} p-5`}>
                  <h2 className="text-base font-bold">API console</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Send a real GET request with one of your keys and see the live response.
                  </p>
                  <div className="mt-4 space-y-3">
                    <select value={testPath} onChange={(e) => setTestPath(e.target.value)} className={input}>
                      {ALL_ENDPOINTS.map((e) => (
                        <option key={e.path} value={e.path}>{e.label}</option>
                      ))}
                    </select>
                    <input
                      value={testKey}
                      onChange={(e) => setTestKey(e.target.value)}
                      placeholder="wd_live_…"
                      className={`${input} font-mono text-xs`}
                    />
                    <button
                      onClick={runTest}
                      disabled={testing}
                      className="w-full rounded-xl bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-50"
                    >
                      {testing ? 'Sending…' : 'Send request'}
                    </button>
                  </div>
                  {testOut && (
                    <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-border bg-muted/60 p-4 text-[11.5px] leading-relaxed">
                      <code className="font-mono text-foreground/90">{testOut}</code>
                    </pre>
                  )}
                </div>

                <div className={`${card} overflow-hidden`}>
                  <div className="border-b border-border px-5 py-4">
                    <h2 className="text-base font-bold">Top endpoints · 7 days</h2>
                  </div>
                  {usage.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                      No requests recorded yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {usage.map((u) => {
                        const max = Math.max(...usage.map((x) => x.requests), 1);
                        return (
                          <div key={u.endpoint} className="px-5 py-3">
                            <div className="flex items-baseline justify-between gap-3">
                              <code className="min-w-0 truncate font-mono text-[11px] text-foreground">{u.endpoint}</code>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {u.requests.toLocaleString()}
                                {u.errors > 0 && <span className="text-red-500"> · {u.errors} err</span>}
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.round((u.requests / max) * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
