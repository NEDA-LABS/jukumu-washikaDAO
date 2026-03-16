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
} from '@heroicons/react/24/outline';

interface WalletDashboardProps {
  userId: number;
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

export default function WalletDashboard({ userId }: WalletDashboardProps) {
  const [balance, setBalance] = useState<number>(0);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provisioned, setProvisioned] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [formData, setFormData] = useState({ amount: '', phone: '', groupId: '', toMemberId: '', purpose: 'contribution' });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [myGroups, setMyGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [availableMembers, setAvailableMembers] = useState<Array<{ id: number; full_name: string; email: string }>>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`/api/wallet/balance?userId=${userId}`);
      const data = await res.json();
      setBalance(data.balanceTzs || 0);
      setWalletAddress(data.walletAddress);
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
      const [, txs] = await Promise.all([fetchBalance(), fetchTransactions()]);
      setLoading(false);
      // Auto-sync if any pending transactions exist
      const hasPending = txs.some((t: { status: string }) =>
        ['pending', 'submitted', 'processing'].includes(t.status)
      );
      if (hasPending) syncTransactions();
    };
    load();
  }, [fetchBalance, fetchTransactions, syncTransactions]);

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
        setWalletAddress(data.walletAddress);
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
        endpoint = '/api/wallet/withdraw';
        body = { userId, amountTzs: parseInt(formData.amount), phone: formData.phone };
      } else {
        endpoint = '/api/wallet/transfer';
        body = {
          userId,
          amountTzs: parseInt(formData.amount),
          purpose: formData.purpose,
          groupId: formData.groupId ? parseInt(formData.groupId) : undefined,
          toMemberId: formData.toMemberId ? parseInt(formData.toMemberId) : undefined,
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
        setFormData({ amount: '', phone: '', groupId: '', toMemberId: '', purpose: 'contribution' });
        // Refresh immediately then poll for status updates
        setTimeout(() => { fetchBalance(); fetchTransactions(); }, 2000);
        setTimeout(() => syncTransactions(), 8000);
        setTimeout(() => syncTransactions(), 20000);
        setTimeout(() => setModal(null), 3000);
      } else {
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
            <p className="text-sm text-muted-foreground mb-1">Salio la Wallet</p>
            <p className="text-3xl font-bold text-foreground">{formatTzs(balance)}</p>
            {walletAddress && (
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
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
            Weka Pesa
          </button>
          <button
            onClick={() => { setModal('withdraw'); setFeedback(null); }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            Toa Pesa
          </button>
          <button
            onClick={() => { setModal('transfer'); setFeedback(null); }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowsRightLeftIcon className="h-4 w-4" />
            Hamisha
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Historia ya Miamala</h3>
        </div>
        {transactions.length === 0 ? (
          <div className="px-6 py-8 text-center text-muted-foreground">
            Hakuna miamala bado
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
                {modal === 'deposit' ? 'Weka Pesa' : modal === 'withdraw' ? 'Toa Pesa' : 'Hamisha Pesa'}
              </h3>
              <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Kiasi (TZS)</label>
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
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Namba ya Simu</label>
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
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Aina</label>
                    <select
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
                    >
                      <option value="contribution">Mchango kwa Kundi</option>
                      <option value="p2p">Tuma kwa Mwanachama</option>
                    </select>
                  </div>

                  {formData.purpose === 'contribution' && (
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Chagua Kundi</label>
                      {loadingOptions ? (
                        <div className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-muted-foreground text-sm">Inapakia...</div>
                      ) : myGroups.length === 0 ? (
                        <div className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-muted-foreground text-sm">Hujajiunga na kundi lolote</div>
                      ) : (
                        <select
                          required
                          value={formData.groupId}
                          onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
                        >
                          <option value="">-- Chagua kundi --</option>
                          {myGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {formData.purpose === 'p2p' && (
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Chagua Mpokezi</label>
                      {loadingOptions ? (
                        <div className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-muted-foreground text-sm">Inapakia...</div>
                      ) : availableMembers.length === 0 ? (
                        <div className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-muted-foreground text-sm">Hakuna wanachama wengine</div>
                      ) : (
                        <select
                          required
                          value={formData.toMemberId}
                          onChange={(e) => setFormData({ ...formData, toMemberId: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
                        >
                          <option value="">-- Chagua mwanachama --</option>
                          {availableMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.full_name} ({m.email})</option>
                          ))}
                        </select>
                      )}
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
                {submitting ? 'Inatuma...' : modal === 'deposit' ? 'Weka Pesa' : modal === 'withdraw' ? 'Toa Pesa' : 'Hamisha'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
