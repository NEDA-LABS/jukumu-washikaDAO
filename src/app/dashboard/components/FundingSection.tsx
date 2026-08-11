'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import TokenMark, { type TokenId } from '@/components/TokenMark';

/**
 * Review queue for nTZS sent to the treasury from an outside wallet.
 *
 * A funder can only tell us what they say they sent — the transfer itself
 * happens on chain, outside this application. Confirming here is the step that
 * turns that claim into a group's money, so it is a deliberate human decision:
 * whoever presses Confirm is asserting they have seen the transfer arrive at
 * the treasury address, and their user id is recorded against it.
 *
 * The transaction hash is the thing to check. Paste it into an explorer, or
 * match it against the treasury wallet's inbound history, before confirming.
 */

type DonationClaim = {
  id: number;
  donor_name: string;
  amount_tzs: number;
  token: TokenId | null;
  tx_hash: string | null;
  from_address: string | null;
  status: string;
  certificate_code: string;
  message: string | null;
  created_at: string;
};

type Claim = {
  id: number;
  group_id: number;
  proposal_id: number | null;
  from_address: string | null;
  amount_tzs: number;
  tx_hash: string | null;
  status: string;
  note: string | null;
  review_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  group_name: string;
  proposal_title: string | null;
  funder_name: string | null;
  funder_email: string | null;
};

const tsh = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`;

export default function FundingSection({ showToast }: {
  showToast?: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'rejected'>('pending');
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [donations, setDonations] = useState<DonationClaim[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reason, setReason] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setClaims(null); setDonations(null);
    // Donations use their own status names — a gift is 'completed', a group
    // funding claim is 'confirmed'.
    const donationStatus = status === 'pending' ? 'pending_review'
      : status === 'confirmed' ? 'completed' : 'rejected';
    try {
      const [f, d] = await Promise.all([
        fetch(`/api/admin/funding/external?status=${status}`),
        fetch(`/api/admin/donations?status=${donationStatus}`),
      ]);
      setClaims(f.ok ? ((await f.json()).claims ?? []) : []);
      setDonations(d.ok ? ((await d.json()).donations ?? []) : []);
    } catch {
      setClaims([]); setDonations([]);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const review = async (id: number, action: 'confirm' | 'reject') => {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/funding/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId: id, action, reason: reason[id] || undefined }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { showToast?.(d?.error || t('fund.err'), 'error'); return; }
      showToast?.(
        action === 'confirm' ? t('fund.confirmed') : t('fund.rejected'),
        action === 'confirm' ? 'success' : 'info'
      );
      await load();
    } catch {
      showToast?.(t('fund.err'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const reviewDonation = async (id: number, action: 'confirm' | 'reject') => {
    setBusyId(-id);
    try {
      const res = await fetch('/api/admin/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationId: id, action, reason: reason[-id] || undefined }),
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

  const tabs: { id: typeof status; label: string }[] = [
    { id: 'pending', label: t('fund.tab.pending') },
    { id: 'confirmed', label: t('fund.tab.confirmed') },
    { id: 'rejected', label: t('fund.tab.rejected') },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">{t('fund.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('fund.subtitle')}</p>
      </div>

      <div className="flex gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setStatus(tb.id)}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              status === tb.id
                ? 'bg-foreground text-background'
                : 'border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Gifts to WashikaDAU itself, sent on chain. */}
      {donations && donations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">{t('fund.donations')}</h3>
          {donations.map((d) => (
            <div key={d.id} className="border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {d.token && <TokenMark token={d.token} size={28} className="mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground">
                      {tsh(d.amount_tzs)}
                      {d.token && <span className="ml-2 text-xs font-semibold uppercase text-muted-foreground">{d.token}</span>}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{d.donor_name}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{d.certificate_code}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(d.created_at).toLocaleString()}
                </span>
              </div>

              <div className="mt-3 space-y-1 border-t border-border pt-3">
                <p className="break-all font-mono text-[11px] text-foreground">
                  <span className="text-muted-foreground">tx </span>{d.tx_hash || '—'}
                </p>
                <p className="break-all font-mono text-[11px] text-muted-foreground">
                  <span>from </span>{d.from_address || '—'}
                </p>
                {d.message && <p className="pt-1 text-xs text-muted-foreground">{d.message}</p>}
              </div>

              {d.status === 'pending_review' && (
                <div className="mt-3 space-y-2">
                  <input
                    value={reason[-d.id] || ''}
                    onChange={(e) => setReason((p) => ({ ...p, [-d.id]: e.target.value }))}
                    placeholder={t('fund.reason.ph')}
                    className="w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewDonation(d.id, 'confirm')}
                      disabled={busyId === -d.id}
                      className="flex-1 bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-40"
                    >
                      {busyId === -d.id ? t('fund.working') : t('fund.confirm')}
                    </button>
                    <button
                      onClick={() => reviewDonation(d.id, 'reject')}
                      disabled={busyId === -d.id}
                      className="flex-1 border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-40"
                    >
                      {t('fund.reject')}
                    </button>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">{t('fund.donationWarning')}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {claims === null ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('fund.loading')}</p>
      ) : claims.length === 0 ? (
        <p className="border border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t('fund.none')}
        </p>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <div key={c.id} className="border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold text-foreground">{tsh(c.amount_tzs)}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {c.proposal_title ? `${c.proposal_title} · ` : ''}{c.group_name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.funder_name || '—'}{c.funder_email ? ` · ${c.funder_email}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>

              {/* The hash is the evidence. Everything else is what they typed. */}
              <div className="mt-3 space-y-1 border-t border-border pt-3">
                <p className="break-all font-mono text-[11px] text-foreground">
                  <span className="text-muted-foreground">tx </span>{c.tx_hash || '—'}
                </p>
                <p className="break-all font-mono text-[11px] text-muted-foreground">
                  <span>from </span>{c.from_address || '—'}
                </p>
                {c.note && <p className="pt-1 text-xs text-muted-foreground">{c.note}</p>}
                {c.review_reason && (
                  <p className="pt-1 text-xs text-muted-foreground">{t('fund.reason')}: {c.review_reason}</p>
                )}
              </div>

              {c.status === 'pending' && (
                <div className="mt-3 space-y-2">
                  <input
                    value={reason[c.id] || ''}
                    onChange={(e) => setReason((p) => ({ ...p, [c.id]: e.target.value }))}
                    placeholder={t('fund.reason.ph')}
                    className="w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => review(c.id, 'confirm')}
                      disabled={busyId === c.id}
                      className="flex-1 bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-40"
                    >
                      {busyId === c.id ? t('fund.working') : t('fund.confirm')}
                    </button>
                    <button
                      onClick={() => review(c.id, 'reject')}
                      disabled={busyId === c.id}
                      className="flex-1 border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-40"
                    >
                      {t('fund.reject')}
                    </button>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">{t('fund.warning')}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
