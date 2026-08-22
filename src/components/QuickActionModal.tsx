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

/** A member you share an active group with — see /api/member/peers. */
type Peer = { id: number; name: string; username: string | null; groups: string[] };

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
  initialPurpose,
  onClose,
  onSuccess,
}: {
  userId: number;
  type: ActionType;
  /** Preselects the transfer kind so Home's buttons land on the right form
      instead of dropping everyone on "contribution" and making them switch. */
  initialPurpose?: Purpose;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { language, t } = useLanguage();
  const sw = language === 'sw';
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [toUsername, setToUsername] = useState('');
  const [toMemberId, setToMemberId] = useState('');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loadingPeers, setLoadingPeers] = useState(false);
  const [purpose, setPurpose] = useState<Purpose>(initialPurpose ?? 'contribution');
  const [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Withdrawal quote flow: null = form step, set = confirmation step
  const [withdrawQuote, setWithdrawQuote] = useState<WithdrawQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  // Registered name behind the number. Shown when the lookup answers; the form
  // works exactly the same when it does not.
  const [lookupName, setLookupName] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // A deposit is not money until the person approves the push on their handset
  // and the webhook settles it. This is that wait.
  const [pending, setPending] = useState<{ depositId: string; amountTzs: number } | null>(null);
  // Set when the provider could not confirm the prompt reached the handset.
  // The deposit is still real and still worth waiting on; what changes is what
  // we tell the member while they wait.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [waitedSec, setWaitedSec] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => {
    if (type !== 'deposit' && type !== 'withdraw') return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) { setLookupName(null); return; }

    let cancelled = false;
    setLookingUp(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/wallet/name-lookup?phone=${encodeURIComponent(phone)}&direction=${type}`
        );
        const d = await res.json().catch(() => null);
        if (!cancelled) setLookupName(d?.name ?? null);
      } catch {
        if (!cancelled) setLookupName(null);
      } finally {
        if (!cancelled) setLookingUp(false);
      }
    }, 500);

    return () => { cancelled = true; clearTimeout(timer); setLookingUp(false); };
  }, [phone, type]);

  // Poll until the top-up settles. The webhook is the real settlement path;
  // the status route also self-settles, so a delayed webhook is not a stuck
  // spinner. Idempotent either way.
  useEffect(() => {
    if (!pending) return;
    let alive = true;
    const started = Date.now();

    const tick = async () => {
      if (!alive) return;
      setWaitedSec(Math.round((Date.now() - started) / 1000));
      try {
        const res = await fetch(`/api/wallet/deposit/status?depositId=${encodeURIComponent(pending.depositId)}`);
        const d = await res.json().catch(() => null);
        if (!alive) return;
        if (d?.settled) {
          setPending(null);
          setFeedback({ type: 'success', message: sw ? 'Malipo yamethibitishwa!' : 'Payment confirmed!' });
          onSuccess?.();
          setTimeout(onClose, 1400);
          return;
        }
        if (d?.failed) {
          setPending(null);
          setFeedback({ type: 'error', message: sw ? 'Malipo hayakukamilika.' : 'The payment did not go through.' });
          return;
        }
      } catch {
        // Network blip — keep waiting rather than calling it a failure.
      }
      if (alive) timer = setTimeout(tick, 3000);
    };

    let timer = setTimeout(tick, 2000);
    return () => { alive = false; clearTimeout(timer); };
  }, [pending, sw, onClose, onSuccess]);

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

  const fetchPeers = useCallback(async () => {
    setLoadingPeers(true);
    try {
      const res = await fetch('/api/member/peers');
      if (res.ok) setPeers((await res.json()).peers ?? []);
    } catch {
      // swallow — the field falls back to typing a username
    } finally {
      setLoadingPeers(false);
    }
  }, []);

  useEffect(() => {
    if (type === 'transfer' && purpose === 'p2p' && peers.length === 0 && !loadingPeers) {
      fetchPeers();
    }
  }, [type, purpose, peers.length, loadingPeers, fetchPeers]);

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
    setUnconfirmed(false);
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

  /**
   * The server classifies a provider failure and sends back a code plus its
   * English wording. Swahili lives here, because only the client knows which
   * language the reader chose. An unrecognised code falls through to whatever
   * the server said, which is already the friendly text rather than nTZS's.
   */
  const ntzsMessage = (data: { error?: string; code?: string }): string => {
    if (!sw) return data?.error || '';
    const swahili: Record<string, string> = {
      unconfirmed_delivery: 'Hatukuweza kuthibitisha ombi la malipo limefika kwenye simu yako. Kama umekatwa, salio litaonekana lenyewe — tafadhali usilipe tena.',
      insufficient_funds: 'Salio halitoshi kwenye akaunti hiyo ya simu.',
      invalid_phone: 'Nambari hiyo ya simu haikukubaliwa. Iangalie kisha jaribu tena.',
      limit_exceeded: 'Kiasi hicho kiko nje ya kikomo cha akaunti hii. Jaribu kiasi kidogo.',
      duplicate: 'Malipo hayo tayari yameanzishwa. Angalia simu yako.',
      unavailable: 'Huduma ya malipo haipatikani kwa sasa. Tafadhali jaribu tena baada ya dakika chache.',
      unknown: 'Malipo hayakuweza kuanzishwa. Tafadhali jaribu tena baada ya dakika chache.',
    };
    return (data?.code && swahili[data.code]) || data?.error || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const err = validateBase();
    if (err) { setFeedback({ type: 'error', message: err }); return; }
    if (type === 'transfer' && purpose === 'contribution' && !groupId) {
      setFeedback({ type: 'error', message: sw ? 'Chagua kundi' : 'Choose a group' }); return;
    }
    if (type === 'transfer' && purpose === 'p2p' && !toMemberId && !toUsername.trim()) {
      setFeedback({ type: 'error', message: sw ? 'Chagua mpokeaji' : 'Choose a recipient' }); return;
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
            // A picked recipient wins: usernames are rarely set, so the id is
            // the reliable identifier. The typed field stays as a fallback for
            // sending to someone outside your groups.
            toMemberId: purpose === 'p2p' && toMemberId ? parseInt(toMemberId) : undefined,
            toUsername: purpose === 'p2p' && !toMemberId ? toUsername.trim() : undefined,
          }
        : type === 'withdraw'
          ? { userId, amountTzs: parseInt(amount), phone, quoteId: withdrawQuote?.quoteId }
          : { userId, amountTzs: parseInt(amount), phone };
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // A deposit has only been *requested* at this point — the STK push is
        // on its way to the handset. Saying "success" here and closing was
        // telling people their money had arrived before they had even paid.
        if (type === 'deposit' && data.depositId) {
          setWaitedSec(0);
          // `unconfirmed` means nTZS could not tell whether the prompt was
          // delivered but may already have collected. It is still a deposit to
          // wait on, not a failure — the waiting screen says so in the copy.
          setUnconfirmed(!!data.unconfirmed);
          setPending({ depositId: String(data.depositId), amountTzs: parseInt(amount) || 0 });
          return;
        }
        setFeedback({ type: 'success', message: data.message || (sw ? 'Imefanikiwa!' : 'Success!') });
        setAmount(''); setPhone(''); setToUsername(''); setToMemberId(''); setGroupId(''); setWithdrawQuote(null);
        onSuccess?.();
        setTimeout(onClose, 1800);
      } else {
        // If the quote went stale between fetch and confirm, drop back to step 1
        // so the user can re-quote.
        if (data.code === 'invalid_quote' || data.code === 'quote_stale' || data.code === 'quote_mismatch') {
          setWithdrawQuote(null);
        }
        setFeedback({ type: 'error', message: ntzsMessage(data) || (sw ? 'Imeshindikana' : 'Failed') });
      }
    } catch {
      setFeedback({ type: 'error', message: sw ? 'Tatizo la mtandao' : 'Network error' });
    } finally {
      setSubmitting(false);
    }
  };

  const input = 'w-full border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-ink-3 focus:border-foreground';
  const label = 'wd-kicker mb-1.5 block';

  const fmtTzs = (n: number) => `TSh ${Math.round(n).toLocaleString()}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative flex w-full max-w-md flex-col border-2 border-rule bg-card animate-[wd-rise_0.25s_ease-out]"
        style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)' }}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            {/* Context, not a restatement of the title below it. */}
            <span className="wd-kicker wd-kicker-gold">
              {type === 'deposit' ? (sw ? 'Kwa simu' : 'Mobile money')
                : type === 'withdraw' ? (sw ? 'Kwenda kwa simu' : 'To mobile money')
                : (sw ? 'Pochi yangu' : 'My wallet')}
            </span>
            <h3 className="mt-1 truncate font-display text-[19px] font-bold leading-tight text-foreground">
              {title}
              {type === 'withdraw' && withdrawQuote && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {sw ? 'Thibitisha' : 'Confirm'}</span>
              )}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="wd-press ml-3 shrink-0 border border-border px-2.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Waiting on the handset. The push has been sent; nothing has been
            paid until they approve it and the webhook lands. */}
        {pending ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="wd-round h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            <p className="mt-5 font-display text-[17px] font-bold leading-tight">
              {sw ? 'Inasubiri malipo' : 'Waiting for payment'}
            </p>
            <p className="mt-2 max-w-[280px] text-[12px] leading-relaxed text-muted-foreground">
              {unconfirmed
                ? (sw
                  ? 'Hatukuweza kuthibitisha ombi limefika kwenye simu yako, lakini malipo yanaweza kuwa yamechukuliwa. Tunaangalia sasa.'
                  : 'We could not confirm the prompt reached your phone, but the payment may already have been taken. We are checking now.')
                : (sw
                  ? 'Angalia simu yako na thibitisha malipo. Dirisha hili litafunga yenyewe.'
                  : 'Check your phone and approve the payment. This will close on its own.')}
            </p>

            {/* The one thing they must not do is pay twice. Said plainly, and
                only when it applies. */}
            {unconfirmed && (
              <p className="mt-3 max-w-[280px] border border-gold-deep/40 bg-gold/10 px-3 py-2 text-[11px] leading-relaxed text-foreground">
                {sw ? 'Usilipe tena.' : 'Please do not pay again.'}
              </p>
            )}
            <p className="mt-4 wd-figure text-[22px]">{fmtTzs(pending.amountTzs)}</p>
            <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">
              {waitedSec}s
            </p>
            {/* After a while, let them leave without losing the deposit —
                settlement continues server-side either way. */}
            {waitedSec >= 45 && (
              <button
                onClick={onClose}
                className="wd-press mt-6 border border-border px-4 py-2.5 text-[11px] font-semibold text-muted-foreground"
              >
                {sw ? 'Funga — itaendelea nyuma' : 'Close — it keeps going'}
              </button>
            )}
          </div>
        ) : /* Withdrawal — confirmation step */
        type === 'withdraw' && withdrawQuote ? (
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-3"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="space-y-3 border border-border bg-background p-4">
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
                  <Row label={sw ? 'Ada ya huduma' : 'Service fee'} value={fmtTzs(withdrawQuote.fees.totalFeeTzs!)} />
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
              <div className={`border px-4 py-3 text-[12px] leading-snug ${feedback.type === 'success' ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
                {feedback.message}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setWithdrawQuote(null); setFeedback(null); }}
                className="wd-press border border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                ← {sw ? 'Rudi' : 'Back'}
              </button>
              <button
                type="submit" disabled={submitting}
                className="wd-press flex-1 bg-gold py-3.5 text-sm font-semibold text-[#1a1714] disabled:opacity-40"
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
                        className={`wd-press border px-2 py-2.5 text-center text-xs font-semibold leading-tight transition-colors ${
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
                    <label className={label}>{sw ? 'Mpokeaji' : 'Recipient'}</label>
                    {/* A named list of the people you actually share a group
                        with. This was a bare username box, which asked members
                        to recall a handle almost nobody has set — 4 of 199 at
                        the time of writing — for a person they know by name. */}
                    <select
                      value={toMemberId}
                      onChange={e => { setToMemberId(e.target.value); if (e.target.value) setToUsername(''); }}
                      className={input}
                      disabled={loadingPeers}
                    >
                      <option value="">
                        {loadingPeers
                          ? (sw ? 'Inapakia…' : 'Loading…')
                          : peers.length === 0
                            ? (sw ? '-- Hakuna wanachama wenzako --' : '-- No fellow members --')
                            : (sw ? '-- Chagua mwanachama --' : '-- Choose a member --')}
                      </option>
                      {peers.map(pr => (
                        <option key={pr.id} value={String(pr.id)}>
                          {pr.name}{pr.groups.length ? ` · ${pr.groups[0]}` : ''}
                        </option>
                      ))}
                    </select>

                    {/* Kept so you can still pay someone outside your groups,
                        but demoted: it is the exception, not the default. */}
                    {!toMemberId && (
                      <>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {sw ? 'Au tuma kwa username:' : 'Or send by username:'}
                        </p>
                        <input
                          type="text"
                          value={toUsername}
                          onChange={e => setToUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          placeholder="juma_ally"
                          className={`${input} mt-1`}
                          minLength={3}
                          maxLength={30}
                        />
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div>
                <label className={label}>{sw ? 'Nambari ya Simu' : 'Phone Number'}</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07xx xxx xxx" className={input} />
                {/* Who the number belongs to, so it can be checked before
                    committing. Absent when the lookup has nothing to say —
                    it is a confirmation aid, never a gate. */}
                <p className="mt-1.5 min-h-[15px] text-[11px] leading-none" aria-live="polite">
                  {lookingUp ? (
                    <span className="text-muted-foreground">{sw ? 'Inaangalia jina...' : 'Checking name...'}</span>
                  ) : lookupName ? (
                    <span className="font-semibold text-success">{lookupName}</span>
                  ) : null}
                </p>
              </div>
            )}

            {feedback && (
              <div className={`border px-4 py-3 text-[12px] leading-snug ${feedback.type === 'success' ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
                {feedback.message}
              </div>
            )}

            <button
              type="submit" disabled={submitting || quoting}
              className="wd-press w-full bg-gold py-3.5 text-sm font-semibold text-[#1a1714] disabled:opacity-40"
            >
              {type === 'withdraw'
                ? (quoting ? (sw ? 'Inapata bei...' : 'Getting quote...') : (sw ? 'Endelea' : 'Continue'))
                : (submitting ? (sw ? 'Inatuma...' : 'Sending...') : title)}
            </button>
            <p className="text-[11px] text-center text-muted-foreground">
              {sw ? 'Malipo salama' : 'Secure payments'}
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
