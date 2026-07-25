'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowsRightLeftIcon,
  WalletIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';

interface WalletDashboardProps {
  userId: number;
  username?: string;
}

interface Transaction {
  id: number;
  type: 'deposit' | 'transfer' | 'withdrawal';
  status: string;
  amount_tzs: number;
  fee_tzs: number;
  purpose: string;
  note: string;
  from_member_name: string | null;
  from_group_name: string | null;
  to_member_name: string | null;
  to_group_name: string | null;
  created_at: string;
}

type ModalType = 'deposit' | 'withdraw' | 'transfer' | null;

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

function CustomDropdown({ value, onChange, options, placeholder }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#e4a233]/60"
      >
        <span>{selectedOption?.label || placeholder || 'Chagua...'}</span>
        <ChevronDownIcon className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                  value === option.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-white/5'
                }`}
              >
                {value === option.value && <span className="mr-2">✓</span>}
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function WalletDashboard({ userId, username }: WalletDashboardProps) {
  const { t } = useLanguage();
  const [balance, setBalance] = useState<number>(0);
  const [provisioned, setProvisioned] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [formData, setFormData] = useState({ amount: '', phone: '', groupId: '', toMemberId: '', toUsername: '', purpose: 'contribution' });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [myGroups, setMyGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [availableMembers, setAvailableMembers] = useState<Array<{ id: number; full_name: string; email: string }>>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [withdrawQuote, setWithdrawQuote] = useState<{
    quoteId: string; expiresAt: string; recipientName: string | null;
    receiveAmountTzs: number; burnAmountTzs: number;
    fees: { platformFeeTzs?: number; pspFeeTzs?: number; totalFeeTzs?: number };
    balance: { availableTzs: number; sufficient: boolean };
    platformFeeTzs: number; totalDebitTzs: number; normalizedPhone: string;
  } | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`/api/wallet/balance?userId=${userId}`);
      const data = await res.json();
      setBalance(data.balanceTzs || 0);
      setProvisioned(data.provisioned ?? false);
    } catch {
      console.error('Failed to fetch balance');
    }
  }, [userId]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`/api/wallet/transactions?userId=${userId}&limit=10`);
      const data = await res.json();
      setTransactions(data.transactions || []);
      return data.transactions || [];
    } catch {
      console.error('Failed to fetch transactions');
      return [];
    }
  }, [userId]);

  const syncTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/wallet/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.synced > 0) {
        await fetchBalance();
        await fetchTransactions();
      }
    } catch {
      console.error('Failed to sync transactions');
    }
  }, [userId, fetchBalance, fetchTransactions]);

  useEffect(() => {
    const load = async () => {
      // Balance first — it self-syncs minted deposits — then read the (updated) list.
      await fetchBalance();
      await fetchTransactions();
      setLoading(false);
    };
    load();
    // Keep the wallet live: re-checking the balance also settles any deposit that
    // has minted since it was opened, so it lands without a manual refresh.
    const iv = setInterval(() => { fetchBalance(); fetchTransactions(); }, 12000);
    return () => clearInterval(iv);
  }, [fetchBalance, fetchTransactions]);

  const fetchTransferOptions = async () => {
    setLoadingOptions(true);
    try {
      const [groupsRes, membersRes] = await Promise.all([
        fetch('/api/member/groups'),
        fetch('/api/member/available-members'),
      ]);
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        setMyGroups(groupsData.groups || []);
      }
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setAvailableMembers(membersData.members || []);
      }
    } catch (e) {
      console.error('Failed to fetch transfer options:', e);
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    if (modal === 'transfer') {
      fetchTransferOptions();
    }
  }, [modal]);

  const provisionWallet = async () => {
    setProvisioning(true);
    try {
      const res = await fetch('/api/wallet/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setProvisioned(true);
        setFeedback({ type: 'success', message: data.message || 'Wallet imetengenezwa!' });
      } else {
        setFeedback({ type: 'error', message: data.error || 'Imeshindikana' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Tatizo la mtandao' });
    } finally {
      setProvisioning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    // Validate userId
    if (!userId || userId === 0) {
      setFeedback({ type: 'error', message: 'User session expired. Please log in again.' });
      setSubmitting(false);
      return;
    }

    try {
      let endpoint: string;
      let body: Record<string, unknown>;

      if (modal === 'deposit') {
        endpoint = '/api/wallet/deposit';
        body = { userId, amountTzs: parseInt(formData.amount), phone: formData.phone };
      } else if (modal === 'withdraw') {
        // Two-step: fetch quote first, then confirm with quoteId.
        if (!withdrawQuote) {
          const qRes = await fetch('/api/wallet/withdraw/quote', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, amountTzs: parseInt(formData.amount), phone: formData.phone }),
          });
          const qData = await qRes.json().catch(() => ({}));
          if (!qRes.ok || !qData.quoteId) {
            setFeedback({ type: 'error', message: qData.error || 'Could not get a withdrawal quote.' });
            setSubmitting(false);
            return;
          }
          setWithdrawQuote(qData);
          setSubmitting(false);
          return;
        }
        endpoint = '/api/wallet/withdraw';
        body = { userId, amountTzs: parseInt(formData.amount), phone: formData.phone, quoteId: withdrawQuote.quoteId };
      } else {
        endpoint = '/api/wallet/transfer';
        body = {
          userId,
          amountTzs: parseInt(formData.amount),
          purpose: formData.purpose,
          groupId: formData.groupId ? parseInt(formData.groupId) : undefined,
          toUsername: formData.toUsername || undefined,
        };
      }

      console.log('[WalletDashboard] Submitting:', { endpoint, body });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setFeedback({ type: 'success', message: data.message || 'Imefanikiwa!' });
        setFormData({ amount: '', phone: '', groupId: '', toMemberId: '', toUsername: '', purpose: 'contribution' });
        setWithdrawQuote(null);
        // Refresh immediately then poll for status updates
        setTimeout(() => { fetchBalance(); fetchTransactions(); }, 2000);
        setTimeout(() => syncTransactions(), 8000);
        setTimeout(() => syncTransactions(), 20000);
        setTimeout(() => setModal(null), 3000);
      } else {
        if (data.code === 'invalid_quote' || data.code === 'quote_stale' || data.code === 'quote_mismatch') {
          setWithdrawQuote(null);
        }
        setFeedback({ type: 'error', message: data.error || 'Imeshindikana' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Tatizo la mtandao' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTzs = (amount: number) =>
    new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'minted':
        return <CheckCircleIcon className="h-4 w-4 text-success" />;
      case 'failed':
        return <ExclamationTriangleIcon className="h-4 w-4 text-destructive" />;
      default:
        return <ClockIcon className="h-4 w-4 text-warning" />;
    }
  };

  const purposeLabel = (purpose: string) => {
    const labels: Record<string, string> = {
      deposit: 'Amana',
      withdrawal: 'Kutoa',
      contribution: 'Mchango',
      disbursement: 'Malipo',
      p2p: 'Uhamisho',
    };
    return labels[purpose] || purpose;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Wallet not provisioned — show setup CTA
  if (!provisioned) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <WalletIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Tengeneza Wallet Yako</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Anza kutumia pesa za kidijitali. Wallet yako itakuwezesha kupokea, kutuma, na kutoa pesa kwa urahisi kupitia simu yako.
        </p>
        <button
          onClick={provisionWallet}
          disabled={provisioning}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <WalletIcon className="h-5 w-5" />
          {provisioning ? 'Inatengeneza...' : 'Tengeneza Wallet'}
        </button>
        {feedback && (
          <p className={`mt-4 text-sm ${feedback.type === 'error' ? 'text-destructive' : 'text-success'}`}>
            {feedback.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t('wal.balance')}</p>
            <p className="text-3xl font-bold text-foreground">{formatTzs(balance)}</p>
            {username && (
              <p className="text-sm text-emerald-400 mt-2 font-medium">
                @{username}
              </p>
            )}
          </div>
          <WalletIcon className="h-8 w-8 text-primary" />
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => { setModal('deposit'); setFeedback(null); }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {t('wal.deposit')}
          </button>
          <button
            onClick={() => { setModal('withdraw'); setFeedback(null); }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            {t('wal.withdraw')}
          </button>
          <button
            onClick={() => { setModal('transfer'); setFeedback(null); }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowsRightLeftIcon className="h-4 w-4" />
            {t('wal.transfer')}
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{t('wal.history')}</h3>
        </div>
        {transactions.length === 0 ? (
          <div className="px-6 py-8 text-center text-muted-foreground">
            {t('wal.noTx')}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((tx) => (
              <div key={tx.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon(tx.status)}
                  <div>
                    <p className="text-sm font-medium text-foreground">{purposeLabel(tx.purpose)}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.to_group_name || tx.to_member_name || tx.from_group_name || tx.from_member_name || ''}
                      {' · '}{formatDate(tx.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${tx.type === 'deposit' || (tx.type === 'transfer' && tx.to_member_name) ? 'text-success' : 'text-foreground'}`}>
                    {tx.type === 'withdrawal' || tx.purpose === 'contribution' ? '-' : '+'}
                    {formatTzs(tx.amount_tzs)}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{tx.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">
                {modal === 'deposit' ? t('wal.deposit') : modal === 'withdraw' ? t('wal.withdraw') : t('wal.transferFull')}
              </h3>
              <button onClick={() => { setModal(null); setWithdrawQuote(null); }} className="text-muted-foreground hover:text-foreground">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {modal === 'withdraw' && withdrawQuote && (
              <div className="p-6 space-y-3">
                <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">You will receive</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums mt-0.5">TSh {Math.round(withdrawQuote.receiveAmountTzs).toLocaleString()}</p>
                  </div>
                  <div className="pt-3 border-t border-border grid gap-1.5 text-xs">
                    {withdrawQuote.recipientName && (
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Recipient</span><span className="text-foreground">{withdrawQuote.recipientName}</span></div>
                    )}
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Phone</span><span className="text-foreground font-mono">{withdrawQuote.normalizedPhone}</span></div>
                    {(withdrawQuote.fees?.totalFeeTzs ?? 0) > 0 && (
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">nTZS fee</span><span className="text-foreground">TSh {Math.round(withdrawQuote.fees.totalFeeTzs!).toLocaleString()}</span></div>
                    )}
                    {withdrawQuote.platformFeeTzs > 0 && (
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Platform fee</span><span className="text-foreground">TSh {Math.round(withdrawQuote.platformFeeTzs).toLocaleString()}</span></div>
                    )}
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Total debited</span><span className="text-foreground font-semibold">TSh {Math.round(withdrawQuote.totalDebitTzs).toLocaleString()}</span></div>
                  </div>
                </div>
                <p className="text-[11px] text-center text-muted-foreground">Quote valid for 5 minutes.</p>
                {feedback && (
                  <div className={`rounded-lg px-4 py-3 text-sm ${feedback.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                    {feedback.message}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setWithdrawQuote(null); setFeedback(null); }}
                    className="px-4 py-2.5 rounded-lg bg-muted hover:bg-border text-foreground text-sm font-medium"
                  >← Back</button>
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >{submitting ? t('wal.sending') : 'Confirm Withdrawal'}</button>
                </div>
              </div>
            )}

            {!(modal === 'withdraw' && withdrawQuote) && (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">{t('wal.amountTzs')}</label>
                <input
                  type="number"
                  min="100"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="10000"
                />
              </div>

              {/* Phone (for deposit/withdraw) */}
              {(modal === 'deposit' || modal === 'withdraw') && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">{t('wal.phoneShort')}</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0712345678"
                  />
                </div>
              )}

              {/* Transfer fields */}
              {modal === 'transfer' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">{t('wal.type')}</label>
                    <CustomDropdown
                      value={formData.purpose}
                      onChange={(val) => setFormData({ ...formData, purpose: val })}
                      options={[
                        { value: 'contribution', label: t('wal.contribution') },
                        { value: 'p2p', label: t('wal.p2p') },
                      ]}
                    />
                  </div>

                  {formData.purpose === 'contribution' && (
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">{t('wal.chooseGroup')}</label>
                      {loadingOptions ? (
                        <div className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-muted-foreground text-sm">{t('wal.loading')}</div>
                      ) : myGroups.length === 0 ? (
                        <div className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-muted-foreground text-sm">{t('wal.noGroups')}</div>
                      ) : (
                        <CustomDropdown
                          value={formData.groupId}
                          onChange={(val) => setFormData({ ...formData, groupId: val })}
                          options={myGroups.map(g => ({ value: String(g.id), label: g.name }))}
                          placeholder={t('wal.chooseGroupPh')}
                        />
                      )}
                    </div>
                  )}

                  {formData.purpose === 'p2p' && (
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">{t('wal.recipientUsername')}</label>
                      <input
                        type="text"
                        required
                        value={formData.toUsername}
                        onChange={(e) => setFormData({ ...formData, toUsername: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="mfano: juma_ally"
                        pattern="[a-z0-9_]{3,30}"
                        minLength={3}
                        maxLength={30}
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t('wal.usernameHint')}</p>
                    </div>
                  )}
                </>
              )}

              {feedback && (
                <div className={`rounded-lg px-4 py-3 text-sm ${feedback.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                  {feedback.message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting
                  ? t('wal.sending')
                  : modal === 'deposit' ? t('wal.deposit')
                    : modal === 'withdraw' ? 'Continue →'
                    : t('wal.transfer')}
              </button>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
