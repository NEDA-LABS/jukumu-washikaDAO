'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import TokenMark, { type TokenId } from '@/components/TokenMark';

/**
 * Every gift to WashikaDAU, however it arrived.
 *
 * Mobile money and bank transfers settle themselves once nTZS sees the money.
 * A transfer sent on chain carries only a hash the donor typed, so it waits
 * here for someone to match it against the treasury wallet — confirming is
 * what releases the certificate.
 */

type Donation = {
  id: number;
  donor_name: string;
  phone: string | null;
  amount_tzs: number;
  token: TokenId | null;
  token_amount: number | null;
  tx_hash: string | null;
  from_address: string | null;
  status: string;
  method: string;
  certificate_code: string;
  message: string | null;
  review_reason: string | null;
  created_at: string;
  settled_at: string | null;
};

type Totals = { raisedTzs: number; supporters: number; awaitingReview: number; inFlight: number };

const tsh = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`;

const STATUS_STYLE: Record<string, string> = {
  completed: 'text-success',
  pending_review: 'text-gold-deep',
  pending: 'text-muted-foreground',
  submitted: 'text-muted-foreground',
  processing: 'text-muted-foreground',
  rejected: 'text-destructive',
  failed: 'text-destructive',
};

export default function DonationsSection({ showToast }: {
  showToast?: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
}) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<string>('');
  const [rows, setRows] = useState<Donation[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reason, setReason] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setRows(null);
    try {
      const res = await fetch(`/api/admin/donations${filter ? `?status=${filter}` : ''}`);
      if (!res.ok) { setRows([]); return; }
      const d = await res.json();
      setRows(d.donations ?? []);
      setTotals(d.totals ?? null);
    } catch {
      setRows([]);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const review = async (id: number, action: 'confirm' | 'reject') => {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationId: id, action, reason: reason[id] || undefined }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { showToast?.(d?.error || t('fund.err'), 'error'); return; }
      showToast?.(action === 'confirm' ? t('fund.confirmed') : t('fund.rejected'),
        action === 'confirm' ? 'success' : 'info');
      await load();
    } catch {
      showToast?.(t('fund.err'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const filters: { id: string; label: string }[] = [
    { id: '', label: t('don.all') },
    { id: 'pending_review', label: t('don.awaiting') },
    { id: 'completed', label: t('don.completed') },
    { id: 'submitted', label: t('don.inflight') },
    { id: 'rejected', label: t('don.rejected') },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">{t('don.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('don.subtitle')}</p>
      </div>

      {totals && (
        <div className="grid grid-cols-2 border border-border sm:grid-cols-4">
          {[
            [t('don.raised'), tsh(totals.raisedTzs)],
            [t('don.supporters'), String(totals.supporters)],
            [t('don.awaiting'), String(totals.awaitingReview)],
            [t('don.inflight'), String(totals.inFlight)],
          ].map(([k, v], i) => (
            <div key={k} className={`px-4 py-4 ${i < 3 ? 'sm:border-r' : ''} border-border`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</p>
              <p className="mt-1.5 text-lg font-bold text-foreground">{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id || 'all'}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              filter === f.id
                ? 'bg-foreground text-background'
                : 'border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('fund.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="border border-border px-4 py-10 text-center text-sm text-muted-foreground">{t('don.none')}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <div key={d.id} className="border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {d.token
                    ? <TokenMark token={d.token} size={28} className="mt-0.5 shrink-0" />
                    : (
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-border text-[10px] font-semibold text-muted-foreground">
                        {d.method === 'bank' ? '🏦' : '📱'}
                      </span>
                    )}
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground">
                      {d.token && d.token_amount != null
                        ? <>{d.token_amount.toLocaleString()} <span className="text-xs uppercase">{d.token}</span>
                            <span className="ml-2 text-xs font-normal text-muted-foreground">≈ {tsh(d.amount_tzs)}</span></>
                        : tsh(d.amount_tzs)}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {d.donor_name}{d.phone ? ` · ${d.phone}` : ''}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {d.certificate_code} · {d.method}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-xs font-semibold ${STATUS_STYLE[d.status] || 'text-muted-foreground'}`}>
                    {d.status}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {(d.tx_hash || d.from_address || d.message || d.review_reason) && (
                <div className="mt-3 space-y-1 border-t border-border pt-3">
                  {d.tx_hash && (
                    <p className="break-all font-mono text-[11px] text-foreground">
                      <span className="text-muted-foreground">tx </span>{d.tx_hash}
                    </p>
                  )}
                  {d.from_address && (
                    <p className="break-all font-mono text-[11px] text-muted-foreground">
                      <span>from </span>{d.from_address}
                    </p>
                  )}
                  {d.message && <p className="pt-1 text-xs text-muted-foreground">{d.message}</p>}
                  {d.review_reason && (
                    <p className="pt-1 text-xs text-muted-foreground">{t('fund.reason')}: {d.review_reason}</p>
                  )}
                </div>
              )}

              {/* Only a gift sent on chain needs deciding. */}
              {d.status === 'pending_review' && (
                <div className="mt-3 space-y-2">
                  <input
                    value={reason[d.id] || ''}
                    onChange={(e) => setReason((p) => ({ ...p, [d.id]: e.target.value }))}
                    placeholder={t('fund.reason.ph')}
                    className="w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => review(d.id, 'confirm')}
                      disabled={busyId === d.id}
                      className="flex-1 bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-40"
                    >
                      {busyId === d.id ? t('fund.working') : t('fund.confirm')}
                    </button>
                    <button
                      onClick={() => review(d.id, 'reject')}
                      disabled={busyId === d.id}
                      className="flex-1 border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-40"
                    >
                      {t('fund.reject')}
                    </button>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">{t('fund.donationWarning')}</p>
                </div>
              )}

              {d.status === 'completed' && (
                <a
                  href={`/shukrani/${encodeURIComponent(d.certificate_code)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs font-semibold text-gold-deep underline underline-offset-4"
                >
                  {t('don.viewCertificate')}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
