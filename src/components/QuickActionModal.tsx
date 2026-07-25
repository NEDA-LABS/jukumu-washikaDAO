'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';

export type ActionType = 'deposit' | 'withdraw' | 'transfer';

const COPY: Record<ActionType, { sw: string; en: string }> = {
  deposit: { sw: 'Weka Pesa', en: 'Deposit' },
  withdraw: { sw: 'Toa Pesa', en: 'Withdraw' },
  transfer: { sw: 'Hamisha Pesa', en: 'Transfer' },
};

type Group = { id: number; name: string };
type Purpose = 'contribution' | 'p2p';

type WithdrawQuote = {
  quoteId: string;
  expiresAt: string;
  recipientName: string | null;
  receiveAmountTzs: number;
  burnAmountTzs: number;
  fees: { platformFeeTzs?: number; pspFeeTzs?: number; totalFeeTzs?: number };
  balance: { availableTzs: number; sufficient: boolean };
  platformFeeTzs: number;
  totalDebitTzs: number;
  normalizedPhone: string;
};

/**
 * Self-contained deposit / withdraw / transfer pop-up. Posts to the same
 * wallet endpoints the wallet page uses, so it can be triggered from anywhere
 * (e.g. the overview) without redirecting. Theme-aware via design tokens.
 *
 * Withdrawals are a two-step flow because nTZS enforces quote_required:
 *   1. Fetch a quote from /api/wallet/withdraw/quote (shows a confirmation
 *      card with recipient name + fees + net amount).
 *   2. Confirm → POST /api/wallet/withdraw with the returned quoteId.
 */
export default function QuickActionModal({
  userId,
  type,
  onClose,
  onSuccess,
}: {
  userId: number;
  type: ActionType;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { language, t } = useLanguage();
  const sw = language === 'sw';
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [toUsername, setToUsername] = useState('');
  const [purpose, setPurpose] = useState<Purpose>('contribution');
  const [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Withdrawal quote flow: null = form step, set = confirmation step
  const [withdrawQuote, setWithdrawQuote] = useState<WithdrawQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await fetch('/api/member/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups((data.groups || []).map((g: any) => ({ id: g.id, name: g.name })));
      }
    } catch {
      // swallow — the field will show the "no groups" state
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    if (type === 'transfer' && purpose === 'contribution' && groups.length === 0 && !loadingGroups) {
      fetchGroups();
    }
  }, [type, purpose, groups.length, loadingGroups, fetchGroups]);

  const title = sw ? COPY[type].sw : COPY[type].en;

  const validateBase = (): string | null => {
    if (!userId) return sw ? 'Kikao kimeisha. Ingia tena.' : 'Session expired. Log in again.';
    if (!amount || parseInt(amount) <= 0) return sw ? 'Weka kiasi sahihi' : 'Enter a valid amount';
    return null;
  };

  // Step 1 for withdrawals: fetch a fresh quote.
  const handleGetQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const err = validateBase();
    if (err) { setFeedback({ type: 'error', message: err }); return; }
    if (!phone.trim()) { setFeedback({ type: 'error', message: sw ? 'Weka nambari ya simu' : 'Enter a phone number' }); return; }
    setQuoting(true);
    try {
      const res = await fetch('/api/wallet/withdraw/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amountTzs: parseInt(amount), phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.quoteId) {
        setFeedback({ type: 'error', message: data.error || (sw ? 'Imeshindikana kupata bei' : 'Could not price this withdrawal') });
        return;
      }
      setWithdrawQuote(data as WithdrawQuote);
    } catch {
      setFeedback({ type: 'error', message: sw ? 'Tatizo la mtandao' : 'Network error' });
    } finally {
      setQuoting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const err = validateBase();
    if (err) { setFeedback({ type: 'error', message: err }); return; }
    if (type === 'transfer' && purpose === 'contribution' && !groupId) {
      setFeedback({ type: 'error', message: sw ? 'Chagua kundi' : 'Choose a group' }); return;
    }
    if (type === 'transfer' && purpose === 'p2p' && !toUsername.trim()) {
      setFeedback({ type: 'error', message: sw ? 'Weka jina la mtumiaji' : 'Enter a username' }); return;
    }
    setSubmitting(true);
    try {
      const endpoint = type === 'deposit' ? '/api/wallet/deposit' : type === 'withdraw' ? '/api/wallet/withdraw' : '/api/wallet/transfer';
      const body: Record<string, unknown> = type === 'transfer'
        ? {
            userId,
            amountTzs: parseInt(amount),
            purpose,
            groupId: purpose === 'contribution' && groupId ? parseInt(groupId) : undefined,
            toUsername: purpose === 'p2p' ? toUsername.trim() : undefined,
          }
        : type === 'withdraw'
          ? { userId, amountTzs: parseInt(amount), phone, quoteId: withdrawQuote?.quoteId }
          : { userId, amountTzs: parseInt(amount), phone };
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback({ type: 'success', message: data.message || (sw ? 'Imefanikiwa!' : 'Success!') });
        setAmount(''); setPhone(''); setToUsername(''); setGroupId(''); setWithdrawQuote(null);
        onSuccess?.();
        setTimeout(onClose, 1800);
      } else {
        // If the quote went stale between fetch and confirm, drop back to step 1
        // so the user can re-quote.
        if (data.code === 'invalid_quote' || data.code === 'quote_stale' || data.code === 'quote_mismatch') {
          setWithdrawQuote(null);
        }
        setFeedback({ type: 'error', message: data.error || (sw ? 'Imeshindikana' : 'Failed') });
      }
    } catch {
      setFeedback({ type: 'error', message: sw ? 'Tatizo la mtandao' : 'Network error' });
    } finally {
      setSubmitting(false);
    }
  };

  const input = 'w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';
  const label = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5';

  const fmtTzs = (n: number) => `TSh ${Math.round(n).toLocaleString()}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col animate-[wd-rise_0.25s_ease-out]"
        style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)' }}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-[#d1622b] to-[#e4a233] flex items-center justify-center text-white text-sm font-bold">
              {type === 'deposit' ? '+' : type === 'withdraw' ? '−' : '⇄'}
            </span>
            <h3 className="font-display text-lg text-foreground truncate">
              {title}
              {type === 'withdraw' && withdrawQuote && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">· {sw ? 'Thibitisha' : 'Confirm'}</span>
              )}
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Withdrawal — confirmation step */}
        {type === 'withdraw' && withdrawQuote ? (
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-3"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{sw ? 'Utapokea' : 'You will receive'}</p>
                <p className="text-2xl font-bold text-foreground tabular-nums mt-0.5">{fmtTzs(withdrawQuote.receiveAmountTzs)}</p>
              </div>

              <div className="pt-3 border-t border-border grid grid-cols-1 gap-1.5 text-xs">
                {withdrawQuote.recipientName && (
                  <Row label={sw ? 'Jina la mpokeaji' : 'Recipient name'} value={withdrawQuote.recipientName} />
                )}
                <Row label={sw ? 'Nambari ya simu' : 'Phone number'} value={<span className="font-mono">{withdrawQuote.normalizedPhone}</span>} />
                {(withdrawQuote.fees?.totalFeeTzs ?? 0) > 0 && (
                  <Row label={sw ? 'Ada ya nTZS' : 'nTZS fee'} value={fmtTzs(withdrawQuote.fees.totalFeeTzs!)} />
                )}
                {withdrawQuote.platformFeeTzs > 0 && (
                  <Row label={sw ? 'Ada ya jukwaa' : 'Platform fee'} value={fmtTzs(withdrawQuote.platformFeeTzs)} />
                )}
                <Row
                  label={sw ? 'Jumla itakayotolewa' : 'Total to be debited'}
                  value={<span className="font-semibold text-foreground">{fmtTzs(withdrawQuote.totalDebitTzs)}</span>}
                />
              </div>
            </div>

            <p className="text-[11px] text-center text-muted-foreground">
              {sw
                ? 'Bei hii inatumika kwa dakika 5. Bonyeza Thibitisha kuendelea.'
                : 'This quote is valid for 5 minutes. Press Confirm to proceed.'}
            </p>

            {feedback && (
              <div className={`text-sm rounded-xl px-4 py-3 ${feedback.type === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                {feedback.message}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setWithdrawQuote(null); setFeedback(null); }}
                className="px-4 py-3 rounded-xl bg-muted hover:bg-border text-foreground text-sm font-semibold transition-colors"
              >
                ← {sw ? 'Rudi' : 'Back'}
              </button>
              <button
                type="submit" disabled={submitting}
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#d1622b] to-[#e4a233] text-white shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0"
              >
                {submitting ? (sw ? 'Inatuma...' : 'Sending...') : (sw ? 'Thibitisha Kutoa' : 'Confirm Withdrawal')}
              </button>
            </div>
          </form>
        ) : (
          /* Scrollable form step */
          <form
            onSubmit={type === 'withdraw' ? handleGetQuote : handleSubmit}
            className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-4"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div>
              <label className={label}>{sw ? 'Kiasi (TSh)' : 'Amount (TSh)'}</label>
              <input type="number" inputMode="numeric" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10,000" className={input} autoFocus />
            </div>

            {type === 'transfer' ? (
              <>
                <div>
                  <label className={label}>{t('wal.type')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['contribution', 'p2p'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPurpose(p)}
                        className={`px-2 py-2.5 rounded-xl text-xs font-semibold border transition-all leading-tight text-center ${
                          purpose === p
                            ? 'bg-primary/10 border-primary/60 text-primary'
                            : 'bg-background border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {p === 'contribution' ? t('wal.contribution') : t('wal.p2p')}
                      </button>
                    ))}
                  </div>
                </div>

                {purpose === 'contribution' ? (
                  <div>
                    <label className={label}>{t('wal.chooseGroup')}</label>
                    {loadingGroups ? (
                      <div className={`${input} text-muted-foreground`}>{t('wal.loading')}</div>
                    ) : groups.length === 0 ? (
                      <div className={`${input} text-muted-foreground`}>{t('wal.noGroups')}</div>
                    ) : (
                      <select
                        value={groupId}
                        onChange={e => setGroupId(e.target.value)}
                        className={input}
                      >
                        <option value="">{t('wal.chooseGroupPh')}</option>
                        {groups.map(g => (
                          <option key={g.id} value={String(g.id)}>{g.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className={label}>{sw ? 'Mpokeaji (jina la mtumiaji)' : 'Recipient (username)'}</label>
                    <input
                      type="text"
                      value={toUsername}
                      onChange={e => setToUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="juma_ally"
                      className={input}
                      minLength={3}
                      maxLength={30}
                    />
                  </div>
                )}
              </>
            ) : (
              <div>
                <label className={label}>{sw ? 'Nambari ya Simu' : 'Phone Number'}</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07xx xxx xxx" className={input} />
              </div>
            )}

            {feedback && (
              <div className={`text-sm rounded-xl px-4 py-3 ${feedback.type === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                {feedback.message}
              </div>
            )}

            <button
              type="submit" disabled={submitting || quoting}
              className="w-full py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#d1622b] to-[#e4a233] text-white shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0"
            >
              {type === 'withdraw'
                ? (quoting ? (sw ? 'Inapata bei...' : 'Getting quote...') : (sw ? 'Endelea' : 'Continue'))
                : (submitting ? (sw ? 'Inatuma...' : 'Sending...') : title)}
            </button>
            <p className="text-[11px] text-center text-muted-foreground">
              {sw ? 'Inaendeshwa na nTZS · Malipo salama' : 'Powered by nTZS · Secure payments'}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}
