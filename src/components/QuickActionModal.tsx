'use client';

import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';

export type ActionType = 'deposit' | 'withdraw' | 'transfer';

const COPY: Record<ActionType, { sw: string; en: string }> = {
  deposit: { sw: 'Weka Pesa', en: 'Deposit' },
  withdraw: { sw: 'Toa Pesa', en: 'Withdraw' },
  transfer: { sw: 'Hamisha Pesa', en: 'Transfer' },
};

/**
 * Self-contained deposit / withdraw / transfer pop-up. Posts to the same wallet
 * endpoints the wallet page uses, so it can be triggered from anywhere (e.g. the
 * overview) without redirecting. Theme-aware via design tokens.
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
  const { language } = useLanguage();
  const sw = language === 'sw';
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [toUsername, setToUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const title = sw ? COPY[type].sw : COPY[type].en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!userId) { setFeedback({ type: 'error', message: sw ? 'Kikao kimeisha. Ingia tena.' : 'Session expired. Log in again.' }); return; }
    if (!amount || parseInt(amount) <= 0) { setFeedback({ type: 'error', message: sw ? 'Weka kiasi sahihi' : 'Enter a valid amount' }); return; }
    setSubmitting(true);
    try {
      const endpoint = type === 'deposit' ? '/api/wallet/deposit' : type === 'withdraw' ? '/api/wallet/withdraw' : '/api/wallet/transfer';
      const body: Record<string, unknown> = type === 'transfer'
        ? { userId, amountTzs: parseInt(amount), purpose: 'contribution', toUsername: toUsername || undefined }
        : { userId, amountTzs: parseInt(amount), phone };
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback({ type: 'success', message: data.message || (sw ? 'Imefanikiwa!' : 'Success!') });
        setAmount(''); setPhone(''); setToUsername('');
        onSuccess?.();
        setTimeout(onClose, 1800);
      } else {
        setFeedback({ type: 'error', message: data.error || (sw ? 'Imeshindikana' : 'Failed') });
      }
    } catch {
      setFeedback({ type: 'error', message: sw ? 'Tatizo la mtandao' : 'Network error' });
    } finally {
      setSubmitting(false);
    }
  };

  const input = 'w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-[wd-rise_0.25s_ease-out]">
        {/* grab handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3"><span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" /></div>

        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#d1622b] to-[#e4a233] flex items-center justify-center text-white text-sm font-bold">
              {type === 'deposit' ? '+' : type === 'withdraw' ? '−' : '⇄'}
            </span>
            <h3 className="font-display text-lg text-foreground">{title}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              {sw ? 'Kiasi (TSh)' : 'Amount (TSh)'}
            </label>
            <input type="number" inputMode="numeric" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10,000" className={input} autoFocus />
          </div>

          {type === 'transfer' ? (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {sw ? 'Mpokeaji (jina la mtumiaji)' : 'Recipient (username)'}
              </label>
              <input type="text" value={toUsername} onChange={e => setToUsername(e.target.value)} placeholder="@username" className={input} />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {sw ? 'Nambari ya Simu' : 'Phone Number'}
              </label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07xx xxx xxx" className={input} />
            </div>
          )}

          {feedback && (
            <div className={`text-sm rounded-xl px-4 py-3 ${feedback.type === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
              {feedback.message}
            </div>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#d1622b] to-[#e4a233] text-white shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0"
          >
            {submitting ? (sw ? 'Inatuma...' : 'Sending...') : title}
          </button>
          <p className="text-[11px] text-center text-muted-foreground">
            {sw ? 'Inaendeshwa na nTZS · Malipo salama' : 'Powered by nTZS · Secure payments'}
          </p>
        </form>
      </div>
    </div>
  );
}
