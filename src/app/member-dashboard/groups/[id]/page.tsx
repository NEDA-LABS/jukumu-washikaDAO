'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type Membership = {
  member_id: number;
  role: string;
  status: string;
};

type Group = {
  id: number;
  name: string;
  founded_date: string | null;
  total_investment: string | number | null;
  monthly_contribution: string | number | null;
  status: string;
  created_at?: string;
  leader_name?: string | null;
  member_count?: number;
};

type MemberRow = {
  id: number;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  joined_date?: string | null;
  status?: string | null;
};

type LeadershipRow = {
  id: number;
  role: string;
  full_name: string;
  email?: string | null;
  joined_date?: string | null;
  status?: string | null;
};

type ProposalRow = {
  id: number;
  group_id: number;
  title: string;
  description?: string | null;
  status: 'open' | 'closed' | string;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string;
  created_by_member_id?: number;
};

type WalletSummary = {
  wallet: { id: number; network: string; address: string } | null;
  balances?: {
    usdc?: { amountBaseUnits: string; decimals: number };
    eth?: { amountBaseUnits: string; decimals: number };
  };
  recentTransfers?: {
    id: number;
    to_address: string;
    amount_base_units: string | number;
    status: string;
    approvals_required: number;
    executed_tx_hash?: string | null;
    created_at?: string;
  }[];
};

type WalletTransferRow = {
  id: number;
  to_address: string;
  amount_base_units: string | number;
  status: string;
  approvals_required: number;
  approval_count?: number;
  executed_tx_hash?: string | null;
  created_at?: string;
};

function shortAddress(addr?: string | null) {
  if (!addr) return '—';
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatBaseUnits(amountBaseUnits: string | number | null | undefined, decimals: number) {
  const raw = String(amountBaseUnits ?? '0').trim();
  const digits = raw.replace(/[^0-9]/g, '') || '0';
  const d = Math.max(0, Number.isFinite(decimals) ? decimals : 0);
  if (d === 0) return digits;

  const padded = digits.padStart(d + 1, '0');
  const intPartRaw = padded.slice(0, -d);
  const fracPartRaw = padded.slice(-d);
  const fracTrimmed = fracPartRaw.replace(/0+$/, '');

  const intPart = intPartRaw.replace(/^0+(?=\d)/, '');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracTrimmed ? `${withCommas}.${fracTrimmed}` : withCommas;
}

function roleLabel(role?: string) {
  switch (role) {
    case 'leader':
      return 'Kiongozi';
    case 'mwenyekiti':
      return 'Mwenyekiti';
    case 'katibu':
      return 'Katibu';
    case 'mwekahazina':
      return 'MwekaHazina';
    case 'member':
    default:
      return 'Mwanachama';
  }
}

export default function MemberGroupDetailsPage() {
  const router = useRouter();
  const routeParams = useParams<{ id?: string | string[] }>();
  const groupId = Array.isArray(routeParams?.id) ? routeParams?.id[0] : routeParams?.id;

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [leadership, setLeadership] = useState<LeadershipRow[]>([]);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'leadership' | 'decisions' | 'fedha'>('overview');
  const [error, setError] = useState<string>('');

  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string>('');

  const [walletTransfers, setWalletTransfers] = useState<WalletTransferRow[]>([]);
  const [walletTransfersLoading, setWalletTransfersLoading] = useState(false);
  const [walletTransfersError, setWalletTransfersError] = useState<string>('');

  const [transferToAddress, setTransferToAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalSubmitting, setProposalSubmitting] = useState(false);

  // Finances / Payments state
  const [groupPayments, setGroupPayments] = useState<any[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<{ total_collected: number; total_disbursed: number; this_month_collected: number; this_month_payers: number }>({ total_collected: 0, total_disbursed: 0, this_month_collected: 0, this_month_payers: 0 });
  const [memberPaymentStatus, setMemberPaymentStatus] = useState<any[]>([]);
  const [isLeader, setIsLeader] = useState(false);

  // USSD Pay modal state
  const [payModal, setPayModal] = useState<{ type: 'contribution' | 'topup' } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payPhone, setPayPhone] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [payStatus, setPayStatus] = useState<'input' | 'waiting' | 'success' | 'failed'>('input');
  const [payReference, setPayReference] = useState('');

  // Disbursement form state
  const [disbursePhone, setDisbursePhone] = useState('');
  const [disburseName, setDisburseName] = useState('');
  const [disburseAmount, setDisburseAmount] = useState('');
  const [disburseProvider, setDisburseProvider] = useState('airtel');
  const [disburseDesc, setDisburseDesc] = useState('');
  const [disburseLoading, setDisburseLoading] = useState(false);
  const [disburseError, setDisburseError] = useState('');
  const [disburseSuccess, setDisburseSuccess] = useState('');

  const canCreateProposal = useMemo(() => {
    const r = membership?.role;
    return r === 'leader' || r === 'mwenyekiti' || r === 'katibu' || r === 'mwekahazina';
  }, [membership?.role]);

  const canProposeTransfer = useMemo(() => {
    const r = membership?.role;
    return r === 'leader' || r === 'mwenyekiti' || r === 'katibu' || r === 'mwekahazina';
  }, [membership?.role]);

  const canApproveOrExecuteTransfer = useMemo(() => {
    const r = membership?.role;
    return r === 'mwenyekiti' || r === 'katibu' || r === 'mwekahazina';
  }, [membership?.role]);

  const recentProposals = useMemo(() => proposals.slice(0, 3), [proposals]);

  useEffect(() => {
    let cancelled = false;

    if (!groupId) {
      router.push('/member-dashboard?section=group');
      return;
    }

    async function load() {
      setLoading(true);
      setError('');
      setWalletError('');
      setWalletTransfersError('');

      try {
        const [groupRes, membersRes, leadershipRes, proposalsRes, walletRes, transfersRes, paymentsRes] = await Promise.all([
          fetch(`/api/member/groups/${groupId}`),
          fetch(`/api/member/groups/${groupId}/members`),
          fetch(`/api/member/groups/${groupId}/leadership`),
          fetch(`/api/member/groups/${groupId}/proposals`),
          fetch(`/api/member/groups/${groupId}/wallet`),
          fetch(`/api/member/groups/${groupId}/wallet/transfers`),
          fetch(`/api/member/groups/${groupId}/payments`)
        ]);

        if (cancelled) return;

        if (
          [groupRes.status, membersRes.status, leadershipRes.status, proposalsRes.status, walletRes.status, transfersRes.status, paymentsRes.status].includes(
            401
          )
        ) {
          router.push('/login');
          return;
        }

        if (groupRes.status === 403) {
          setError('Huruhusiwi kuona taarifa za kundi hili.');
          return;
        }

        const groupJson = await groupRes.json().catch(() => null);
        const membersJson = await membersRes.json().catch(() => null);
        const leadershipJson = await leadershipRes.json().catch(() => null);
        const proposalsJson = await proposalsRes.json().catch(() => null);
        const walletJson = await walletRes.json().catch(() => null);
        const transfersJson = await transfersRes.json().catch(() => null);

        if (!groupRes.ok) {
          setError(groupJson?.error || 'Imeshindikana kupakua taarifa za kundi.');
          return;
        }

        setGroup(groupJson?.group || null);
        setMembership(groupJson?.membership || null);

        setMembers(Array.isArray(membersJson?.members) ? membersJson.members : []);
        setLeadership(Array.isArray(leadershipJson?.leadership) ? leadershipJson.leadership : []);
        setProposals(Array.isArray(proposalsJson?.proposals) ? proposalsJson.proposals : []);

        if (walletRes.ok) {
          setWalletSummary((walletJson as WalletSummary) || null);
        } else {
          setWalletSummary(null);
          setWalletError(walletJson?.error || 'Imeshindikana kupakua taarifa za wallet.');
        }

        if (transfersRes.ok) {
          setWalletTransfers(Array.isArray(transfersJson?.transfers) ? (transfersJson.transfers as WalletTransferRow[]) : []);
        } else {
          setWalletTransfers([]);
          setWalletTransfersError(transfersJson?.error || 'Imeshindikana kupakua transfers za wallet.');
        }

        const paymentsJson = await paymentsRes.json().catch(() => null);
        if (paymentsRes.ok) {
          setGroupPayments(Array.isArray(paymentsJson?.payments) ? paymentsJson.payments : []);
          setPaymentSummary(paymentsJson?.summary || { total_collected: 0, total_disbursed: 0, this_month_collected: 0, this_month_payers: 0 });
          setMemberPaymentStatus(Array.isArray(paymentsJson?.memberPayments) ? paymentsJson.memberPayments : []);
          setIsLeader(!!paymentsJson?.isLeader);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Imeshindikana kupakua taarifa.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, router]);

  const loadGroupPayments = async () => {
    if (!groupId) return;
    try {
      const res = await fetch(`/api/member/groups/${groupId}/payments`);
      if (res.ok) {
        const data = await res.json();
        setGroupPayments(data.payments || []);
        setPaymentSummary(data.summary || { total_collected: 0, total_disbursed: 0, this_month_collected: 0, this_month_payers: 0 });
        setMemberPaymentStatus(data.memberPayments || []);
        setIsLeader(!!data.isLeader);
      }
    } catch { /* ignore */ }
  };

  const handleOpenPay = (type: 'contribution' | 'topup') => {
    setPayAmount(type === 'contribution' ? String(Number.parseFloat(String(group?.monthly_contribution || 0))) : '');
    setPayPhone('');
    setPayError('');
    setPayStatus('input');
    setPayReference('');
    setPayModal({ type });
  };

  const handleClosePay = () => {
    setPayModal(null);
    setPayError('');
    setPayStatus('input');
    setPayReference('');
  };

  const handlePay = async () => {
    if (!payModal || !groupId) return;
    const amount = parseInt(payAmount);
    if (!amount || amount <= 0) { setPayError('Ingiza kiasi sahihi (TZS)'); return; }
    if (!payPhone || payPhone.length < 9) { setPayError('Ingiza nambari sahihi ya simu'); return; }
    setPayLoading(true);
    setPayError('');
    try {
      const endpoint = payModal.type === 'contribution'
        ? '/api/member/contributions'
        : `/api/member/groups/${groupId}/topup`;
      const body = payModal.type === 'contribution'
        ? { groupId: Number(groupId), amount, phone_number: payPhone }
        : { amount, phone_number: payPhone };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const rawText = await res.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(rawText); } catch { /* non-JSON */ }
      if (!res.ok) {
        setPayError((data.error as string) || `Hitilafu ${res.status}: ${rawText.slice(0, 120)}`);
        return;
      }
      setPayReference(data.reference as string);
      setPayStatus('waiting');
      pollPaymentStatus(data.reference as string);
    } catch {
      setPayError('Hitilafu imetokea. Jaribu tena.');
    } finally {
      setPayLoading(false);
    }
  };

  const pollPaymentStatus = (reference: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 60) { clearInterval(interval); setPayStatus('failed'); setPayError('Muda wa malipo umekwisha.'); return; }
      try {
        const res = await fetch(`/api/member/payments/status?reference=${encodeURIComponent(reference)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'completed') {
          clearInterval(interval);
          setPayStatus('success');
          loadGroupPayments();
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setPayStatus('failed');
          setPayError(data.failure_reason || 'Malipo yameshindwa.');
        }
      } catch { /* ignore */ }
    }, 5000);
  };

  const handleDisburse = async () => {
    if (!groupId) return;
    if (!disbursePhone || !disburseName || !disburseAmount) {
      setDisburseError('Jaza taarifa zote zinazohitajika');
      return;
    }
    const amount = parseInt(disburseAmount);
    if (!amount || amount <= 0) { setDisburseError('Kiasi lazima kiwe zaidi ya 0'); return; }
    setDisburseLoading(true);
    setDisburseError('');
    setDisburseSuccess('');
    try {
      const res = await fetch(`/api/member/groups/${groupId}/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: disbursePhone,
          recipientName: disburseName,
          provider: disburseProvider,
          amount,
          description: disburseDesc || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setDisburseError(data?.error || 'Imeshindikana kutuma fedha.');
        return;
      }
      setDisburseSuccess(`Malipo ya TSH ${amount.toLocaleString()} kwa ${disburseName} yametumwa! Ref: ${data?.reference}`);
      setDisbursePhone('');
      setDisburseName('');
      setDisburseAmount('');
      setDisburseDesc('');
      loadGroupPayments();
    } catch {
      setDisburseError('Hitilafu imetokea.');
    } finally {
      setDisburseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/member-dashboard?section=group')}
              className="text-sm text-orange-700 hover:text-orange-800"
            >
              ← Back to My Groups
            </button>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">{group?.name || 'Group'}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Role: <span className="font-medium">{roleLabel(membership?.role)}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab('decisions');
                setShowCreateProposal(true);
              }}
              disabled={!canCreateProposal}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                canCreateProposal
                  ? 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}
            >
              Create Proposal
            </button>
            <button
              onClick={() => alert('Coming soon: Vote on proposals')}
              className="px-4 py-2 rounded-lg text-sm font-medium border bg-white text-gray-700 hover:bg-gray-50"
            >
              Vote
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200 px-4">
            <nav className="flex gap-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'overview' ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-600'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('members')}
                className={`py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'members' ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-600'
                }`}
              >
                Members
              </button>
              <button
                onClick={() => setActiveTab('leadership')}
                className={`py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'leadership' ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-600'
                }`}
              >
                Leadership
              </button>
              <button
                onClick={() => setActiveTab('fedha')}
                className={`py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'fedha' ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-600'
                }`}
              >
                Fedha
              </button>
              <button
                onClick={() => setActiveTab('decisions')}
                className={`py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'decisions' ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-600'
                }`}
              >
                Decisions
              </button>
            </nav>
          </div>

          <div className="p-4">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-xs text-gray-500">Monthly Contribution</p>
                    <p className="text-lg font-semibold text-gray-900">
                      TSH {Number.parseFloat(String(group?.monthly_contribution || 0)).toLocaleString()}
                    </p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-xs text-gray-500">Members</p>
                    <p className="text-lg font-semibold text-gray-900">{group?.member_count ?? members.length}</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-xs text-gray-500">Leader</p>
                    <p className="text-lg font-semibold text-gray-900">{group?.leader_name || '—'}</p>
                  </div>
                </div>

                {/* Pay Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleOpenPay('contribution')}
                    className="flex-1 px-4 py-3 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    💳 Lipa Mchango
                  </button>
                  <button
                    onClick={() => handleOpenPay('topup')}
                    className="flex-1 px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ➕ Weka Mfuko
                  </button>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600">Jumla Iliyokusanywa</p>
                    <p className="text-lg font-semibold text-green-800">TSH {paymentSummary.total_collected.toLocaleString()}</p>
                  </div>
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600">Mwezi Huu</p>
                    <p className="text-lg font-semibold text-blue-800">TSH {paymentSummary.this_month_collected.toLocaleString()}</p>
                  </div>
                  <div className="border border-orange-200 bg-orange-50 rounded-lg p-3">
                    <p className="text-xs text-orange-600">Waliolipa Mwezi Huu</p>
                    <p className="text-lg font-semibold text-orange-800">{paymentSummary.this_month_payers}</p>
                  </div>
                  <div className="border border-purple-200 bg-purple-50 rounded-lg p-3">
                    <p className="text-xs text-purple-600">Jumla Iliyotumwa</p>
                    <p className="text-lg font-semibold text-purple-800">TSH {paymentSummary.total_disbursed.toLocaleString()}</p>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Group Wallet (USDC)</p>
                      <p className="text-sm text-gray-600 mt-1">Visible to all group members.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {walletSummary?.wallet === null && canCreateProposal && (
                        <button
                          disabled={walletLoading}
                          onClick={async () => {
                            if (!groupId) return;
                            setWalletLoading(true);
                            setWalletError('');
                            try {
                              const res = await fetch(`/api/member/groups/${groupId}/wallet`, { method: 'POST' });
                              const json = await res.json().catch(() => null);
                              if (!res.ok) {
                                setWalletError(json?.error || 'Imeshindikana kuunda wallet.');
                                return;
                              }
                              const refresh = await fetch(`/api/member/groups/${groupId}/wallet`);
                              const refreshJson = await refresh.json().catch(() => null);
                              if (refresh.ok) setWalletSummary((refreshJson as WalletSummary) || null);
                              else setWalletError(refreshJson?.error || 'Imeshindikana kupakua taarifa za wallet.');

                              const transfers = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                              const transfersJson = await transfers.json().catch(() => null);
                              if (transfers.ok) {
                                setWalletTransfers(
                                  Array.isArray(transfersJson?.transfers) ? (transfersJson.transfers as WalletTransferRow[]) : []
                                );
                              }
                            } catch (err) {
                              setWalletError(err instanceof Error ? err.message : 'Imeshindikana kuunda wallet.');
                            } finally {
                              setWalletLoading(false);
                            }
                          }}
                          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            walletLoading
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700'
                          }`}
                        >
                          {walletLoading ? 'Creating...' : 'Create Wallet'}
                        </button>
                      )}
                      {walletSummary?.wallet && (
                        <button
                          disabled={walletLoading}
                          onClick={async () => {
                            if (!groupId) return;
                            setWalletLoading(true);
                            setWalletError('');
                            try {
                              const refresh = await fetch(`/api/member/groups/${groupId}/wallet`);
                              const refreshJson = await refresh.json().catch(() => null);
                              if (refresh.ok) setWalletSummary((refreshJson as WalletSummary) || null);
                              else setWalletError(refreshJson?.error || 'Imeshindikana kupakua taarifa za wallet.');

                              const transfers = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                              const transfersJson = await transfers.json().catch(() => null);
                              if (transfers.ok) {
                                setWalletTransfers(
                                  Array.isArray(transfersJson?.transfers) ? (transfersJson.transfers as WalletTransferRow[]) : []
                                );
                              }
                            } catch (err) {
                              setWalletError(err instanceof Error ? err.message : 'Imeshindikana kupakua taarifa za wallet.');
                            } finally {
                              setWalletLoading(false);
                            }
                          }}
                          className="px-3 py-2 rounded-lg text-sm font-medium border bg-white text-gray-700 hover:bg-gray-50"
                        >
                          Refresh
                        </button>
                      )}
                    </div>
                  </div>

                  {walletError && (
                    <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {walletError}
                    </div>
                  )}

                  {walletSummary?.wallet && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Address</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{shortAddress(walletSummary.wallet.address)}</p>
                        <p className="text-xs text-gray-500 mt-1">Network: {walletSummary.wallet.network}</p>
                      </div>
                      <div className="border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-500">USDC Balance</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {formatBaseUnits(walletSummary.balances?.usdc?.amountBaseUnits, walletSummary.balances?.usdc?.decimals ?? 6)} USDC
                        </p>
                      </div>
                      <div className="border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-500">ETH (Gas)</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {formatBaseUnits(walletSummary.balances?.eth?.amountBaseUnits, walletSummary.balances?.eth?.decimals ?? 18)} ETH
                        </p>
                      </div>
                    </div>
                  )}

                  {walletSummary?.wallet && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-900">Recent Transfers</p>
                      <div className="mt-2 space-y-2">
                        {(walletSummary.recentTransfers || []).map((t) => (
                          <div key={t.id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  To: {shortAddress(t.to_address)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Amount: {formatBaseUnits(t.amount_base_units, 6)} USDC
                                </p>
                              </div>
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-50 text-gray-800 border border-gray-200">
                                {t.status}
                              </span>
                            </div>
                          </div>
                        ))}

                        {(walletSummary.recentTransfers || []).length === 0 && (
                          <p className="text-sm text-gray-600">No transfers yet.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {walletSummary?.wallet && (
                    <div className="mt-6 border-t border-gray-200 pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Manage Transfers</p>
                          <p className="text-sm text-gray-600 mt-1">USDC only. Requires 2-of-3 approvals (Mwenyekiti/Katibu/MwekaHazina).</p>
                        </div>
                        <button
                          disabled={walletTransfersLoading}
                          onClick={async () => {
                            if (!groupId) return;
                            setWalletTransfersLoading(true);
                            setWalletTransfersError('');
                            try {
                              const transfers = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                              const transfersJson = await transfers.json().catch(() => null);
                              if (!transfers.ok) {
                                setWalletTransfersError(transfersJson?.error || 'Imeshindikana kupakua transfers za wallet.');
                                return;
                              }
                              setWalletTransfers(
                                Array.isArray(transfersJson?.transfers) ? (transfersJson.transfers as WalletTransferRow[]) : []
                              );
                            } catch (err) {
                              setWalletTransfersError(
                                err instanceof Error ? err.message : 'Imeshindikana kupakua transfers za wallet.'
                              );
                            } finally {
                              setWalletTransfersLoading(false);
                            }
                          }}
                          className="px-3 py-2 rounded-lg text-sm font-medium border bg-white text-gray-700 hover:bg-gray-50"
                        >
                          Refresh
                        </button>
                      </div>

                      {walletTransfersError && (
                        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                          {walletTransfersError}
                        </div>
                      )}

                      {canProposeTransfer && (
                        <form
                          className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!groupId) return;
                            if (!walletSummary?.wallet) return;

                            const to = transferToAddress.trim();
                            const amt = transferAmount.trim();
                            if (!to || !amt) {
                              setWalletTransfersError('To address and amount are required.');
                              return;
                            }

                            setTransferSubmitting(true);
                            setWalletTransfersError('');
                            try {
                              const res = await fetch(`/api/member/groups/${groupId}/wallet/transfers`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ toAddress: to, amount: amt })
                              });

                              const json = await res.json().catch(() => null);
                              if (!res.ok) {
                                setWalletTransfersError(json?.error || 'Imeshindikana kuanzisha transfer.');
                                return;
                              }

                              setTransferToAddress('');
                              setTransferAmount('');

                              const refresh = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                              const refreshJson = await refresh.json().catch(() => null);
                              if (refresh.ok) {
                                setWalletTransfers(
                                  Array.isArray(refreshJson?.transfers) ? (refreshJson.transfers as WalletTransferRow[]) : []
                                );
                              }
                            } catch (err) {
                              setWalletTransfersError(err instanceof Error ? err.message : 'Imeshindikana kuanzisha transfer.');
                            } finally {
                              setTransferSubmitting(false);
                            }
                          }}
                        >
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">To address</label>
                            <input
                              value={transferToAddress}
                              onChange={(e) => setTransferToAddress(e.target.value)}
                              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                              placeholder="0x..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Amount (USDC)</label>
                            <input
                              value={transferAmount}
                              onChange={(e) => setTransferAmount(e.target.value)}
                              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                              placeholder="e.g. 10.5"
                            />
                          </div>
                          <div className="md:col-span-3 flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={transferSubmitting}
                              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                transferSubmitting
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700'
                              }`}
                            >
                              {transferSubmitting ? 'Submitting...' : 'Propose Transfer'}
                            </button>
                          </div>
                        </form>
                      )}

                      <div className="mt-4 space-y-2">
                        {walletTransfers.map((t) => (
                          <div key={t.id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">Transfer #{t.id}</p>
                                <p className="text-xs text-gray-500 mt-1">To: {shortAddress(t.to_address)}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Amount: {formatBaseUnits(t.amount_base_units, 6)} USDC
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Approvals: {t.approval_count ?? 0}/{t.approvals_required}
                                </p>
                                {t.executed_tx_hash && (
                                  <a
                                    href={`https://basescan.org/tx/${t.executed_tx_hash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-orange-700 hover:text-orange-800 mt-1 inline-block"
                                  >
                                    View on BaseScan
                                  </a>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-50 text-gray-800 border border-gray-200">
                                  {t.status}
                                </span>

                                {canApproveOrExecuteTransfer && t.status !== 'executed' && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={async () => {
                                        if (!groupId) return;
                                        setWalletTransfersLoading(true);
                                        setWalletTransfersError('');
                                        try {
                                          const res = await fetch(
                                            `/api/member/groups/${groupId}/wallet/transfers/${t.id}/approve`,
                                            { method: 'POST' }
                                          );
                                          const json = await res.json().catch(() => null);
                                          if (!res.ok) {
                                            setWalletTransfersError(json?.error || 'Imeshindikana ku-approve transfer.');
                                            return;
                                          }
                                          const refresh = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                                          const refreshJson = await refresh.json().catch(() => null);
                                          if (refresh.ok) {
                                            setWalletTransfers(
                                              Array.isArray(refreshJson?.transfers)
                                                ? (refreshJson.transfers as WalletTransferRow[])
                                                : []
                                            );
                                          }
                                        } catch (err) {
                                          setWalletTransfersError(
                                            err instanceof Error ? err.message : 'Imeshindikana ku-approve transfer.'
                                          );
                                        } finally {
                                          setWalletTransfersLoading(false);
                                        }
                                      }}
                                      disabled={walletTransfersLoading}
                                      className="px-3 py-2 rounded-lg text-sm font-medium border bg-white text-gray-700 hover:bg-gray-50"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!groupId) return;
                                        setWalletTransfersLoading(true);
                                        setWalletTransfersError('');
                                        try {
                                          const res = await fetch(
                                            `/api/member/groups/${groupId}/wallet/transfers/${t.id}/execute`,
                                            { method: 'POST' }
                                          );
                                          const json = await res.json().catch(() => null);
                                          if (!res.ok) {
                                            setWalletTransfersError(json?.error || 'Imeshindikana ku-execute transfer.');
                                            return;
                                          }
                                          const refreshWallet = await fetch(`/api/member/groups/${groupId}/wallet`);
                                          const refreshWalletJson = await refreshWallet.json().catch(() => null);
                                          if (refreshWallet.ok) setWalletSummary((refreshWalletJson as WalletSummary) || null);

                                          const refresh = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                                          const refreshJson = await refresh.json().catch(() => null);
                                          if (refresh.ok) {
                                            setWalletTransfers(
                                              Array.isArray(refreshJson?.transfers)
                                                ? (refreshJson.transfers as WalletTransferRow[])
                                                : []
                                            );
                                          }
                                        } catch (err) {
                                          setWalletTransfersError(
                                            err instanceof Error ? err.message : 'Imeshindikana ku-execute transfer.'
                                          );
                                        } finally {
                                          setWalletTransfersLoading(false);
                                        }
                                      }}
                                      disabled={walletTransfersLoading}
                                      className="px-3 py-2 rounded-lg text-sm font-medium border bg-orange-600 text-white border-orange-600 hover:bg-orange-700"
                                    >
                                      Execute
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                        {walletTransfers.length === 0 && (
                          <p className="text-sm text-gray-600">No transfer proposals yet.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {walletSummary?.wallet === null && !walletLoading && !walletError && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600">No wallet created yet.</p>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Recent Proposals</p>
                      <p className="text-sm text-gray-600 mt-1">Visible to all group members.</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('decisions')}
                      className="text-sm text-orange-700 hover:text-orange-800"
                    >
                      View all
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {recentProposals.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => router.push(`/member-dashboard/groups/${groupId}/proposals/${p.id}`)}
                        className="w-full text-left border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{p.title}</p>
                            <p className="text-xs text-gray-500 mt-1">Created by: {p.created_by_name || '—'}</p>
                          </div>
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-50 text-gray-800 border border-gray-200">
                            {String(p.status)}
                          </span>
                        </div>
                      </button>
                    ))}

                    {recentProposals.length === 0 && <p className="text-sm text-gray-600">No proposals yet.</p>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      {isLeader && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mchango Mwezi Huu</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{m.full_name}</div>
                          <div className="text-xs text-gray-500">{m.email || m.phone || ''}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{roleLabel(m.role)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{m.status || 'active'}</td>
                        {isLeader && (
                          <td className="px-4 py-2 whitespace-nowrap">
                            {(() => {
                              const mp = memberPaymentStatus.find((p: any) => p.member_id === m.id);
                              if (!mp) return <span className="text-xs text-gray-400">—</span>;
                              return mp.paid_this_month ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Amelipa</span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Hajalipa</span>
                              );
                            })()}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {members.length === 0 && <p className="text-sm text-gray-600">No members found.</p>}
              </div>
            )}

            {activeTab === 'leadership' && (
              <div className="space-y-3">
                {leadership.map((l) => (
                  <div key={l.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{l.full_name}</p>
                        <p className="text-xs text-gray-500">{l.email || ''}</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-50 text-orange-800 border border-orange-200">
                        {roleLabel(l.role)}
                      </span>
                    </div>
                  </div>
                ))}

                {leadership.length === 0 && <p className="text-sm text-gray-600">No leadership assigned yet.</p>}
              </div>
            )}

            {activeTab === 'fedha' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600">Jumla Iliyokusanywa</p>
                    <p className="text-lg font-semibold text-green-800">TSH {paymentSummary.total_collected.toLocaleString()}</p>
                  </div>
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600">Mwezi Huu</p>
                    <p className="text-lg font-semibold text-blue-800">TSH {paymentSummary.this_month_collected.toLocaleString()}</p>
                  </div>
                  <div className="border border-orange-200 bg-orange-50 rounded-lg p-3">
                    <p className="text-xs text-orange-600">Waliolipa</p>
                    <p className="text-lg font-semibold text-orange-800">{paymentSummary.this_month_payers} / {members.length}</p>
                  </div>
                  <div className="border border-purple-200 bg-purple-50 rounded-lg p-3">
                    <p className="text-xs text-purple-600">Jumla Iliyotumwa</p>
                    <p className="text-lg font-semibold text-purple-800">TSH {paymentSummary.total_disbursed.toLocaleString()}</p>
                  </div>
                </div>

                {/* Pay Buttons */}
                <div className="flex gap-3">
                  <button onClick={() => handleOpenPay('contribution')} className="flex-1 px-4 py-3 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700">
                    💳 Lipa Mchango
                  </button>
                  <button onClick={() => handleOpenPay('topup')} className="flex-1 px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
                    ➕ Weka Mfuko
                  </button>
                </div>

                {/* Member Payment Status (Leaders only) */}
                {isLeader && memberPaymentStatus.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <p className="text-sm font-medium text-gray-900 mb-3">Hali ya Michango - {new Date().toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' })}</p>
                    <div className="space-y-2">
                      {memberPaymentStatus.map((mp: any) => (
                        <div key={mp.member_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{mp.full_name}</p>
                            <p className="text-xs text-gray-500">{mp.phone || ''}</p>
                          </div>
                          {mp.paid_this_month ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Amelipa ✓</span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Hajalipa</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disbursement Form (Leaders only) */}
                {isLeader && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <p className="text-sm font-medium text-gray-900 mb-1">Tuma Fedha kwa Mwanachama</p>
                    <p className="text-xs text-gray-500 mb-3">Tuma pesa moja kwa moja kwa simu ya mwanachama kupitia mobile money.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Jina la Mpokeaji</label>
                        <input
                          value={disburseName}
                          onChange={(e) => { setDisburseName(e.target.value); setDisburseError(''); }}
                          placeholder="e.g. John Doe"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Nambari ya Simu</label>
                        <input
                          value={disbursePhone}
                          onChange={(e) => { setDisbursePhone(e.target.value); setDisburseError(''); }}
                          placeholder="255712345678"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Kiasi (TZS)</label>
                        <input
                          type="number"
                          value={disburseAmount}
                          onChange={(e) => { setDisburseAmount(e.target.value); setDisburseError(''); }}
                          placeholder="e.g. 50000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Mtandao</label>
                        <select
                          value={disburseProvider}
                          onChange={(e) => setDisburseProvider(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        >
                          <option value="airtel">Airtel Money</option>
                          <option value="mpesa">M-Pesa</option>
                          <option value="tigopesa">Tigo Pesa</option>
                          <option value="halopesa">Halo Pesa</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Maelezo (si lazima)</label>
                      <input
                        value={disburseDesc}
                        onChange={(e) => setDisburseDesc(e.target.value)}
                        placeholder="e.g. Malipo ya mkopo"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    {disburseError && <p className="text-xs text-red-600 mt-2">{disburseError}</p>}
                    {disburseSuccess && <p className="text-xs text-green-600 mt-2">{disburseSuccess}</p>}
                    <button
                      onClick={handleDisburse}
                      disabled={disburseLoading}
                      className="mt-3 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {disburseLoading ? 'Inatuma...' : 'Tuma Fedha'}
                    </button>
                  </div>
                )}

                {/* Payment History */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <p className="text-sm font-medium text-gray-900 mb-3">Historia ya Malipo</p>
                  {groupPayments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tarehe</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aina</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mwanachama</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Kiasi</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hali</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {groupPayments.map((p: any) => (
                            <tr key={p.reference} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-xs text-gray-600">
                                {p.created_at ? new Date(p.created_at).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-700">
                                {p.payment_type === 'contribution' ? 'Mchango' : p.payment_type === 'group_topup' ? 'Mfuko' : 'Malipo'}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-700">{p.member_name || p.customer_name || '—'}</td>
                              <td className="px-3 py-2 text-xs text-gray-900 text-right font-medium">
                                {p.payment_type === 'disbursement' ? '-' : '+'}TSH {parseInt(p.amount_tzs || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  p.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  p.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {p.status === 'completed' ? 'Imekamilika' : p.status === 'failed' ? 'Imeshindwa' : 'Inasubiri'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">Hakuna malipo bado.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'decisions' && (
              <div className="space-y-3">
                {showCreateProposal && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Create Proposal</p>
                        <p className="text-sm text-gray-600 mt-1">Only leadership roles can create proposals.</p>
                      </div>
                      <button
                        onClick={() => setShowCreateProposal(false)}
                        className="text-sm text-gray-600 hover:text-gray-800"
                      >
                        Close
                      </button>
                    </div>

                    {!canCreateProposal && (
                      <div className="mt-3 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                        You do not have permission to create proposals.
                      </div>
                    )}

                    <form
                      className="mt-4 space-y-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!groupId) return;
                        if (!canCreateProposal) return;

                        const t = proposalTitle.trim();
                        const d = proposalDescription.trim();
                        if (!t) {
                          setError('Proposal title is required.');
                          return;
                        }

                        setProposalSubmitting(true);
                        setError('');
                        try {
                          const res = await fetch(`/api/member/groups/${groupId}/proposals`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: t, description: d })
                          });

                          if (res.status === 401) {
                            router.push('/login');
                            return;
                          }

                          const json = await res.json().catch(() => null);
                          if (!res.ok) {
                            setError(json?.error || 'Imeshindikana kuunda pendekezo.');
                            return;
                          }

                          const created = json?.proposal as ProposalRow | undefined;
                          if (created) {
                            setProposals((prev) => [created, ...prev]);
                          }
                          setProposalTitle('');
                          setProposalDescription('');
                          setShowCreateProposal(false);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Imeshindikana kuunda pendekezo.');
                        } finally {
                          setProposalSubmitting(false);
                        }
                      }}
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Title</label>
                        <input
                          value={proposalTitle}
                          onChange={(e) => setProposalTitle(e.target.value)}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="e.g. Increase monthly contribution"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                          value={proposalDescription}
                          onChange={(e) => setProposalDescription(e.target.value)}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="Explain the proposal..."
                          rows={4}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={proposalSubmitting || !canCreateProposal}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            proposalSubmitting || !canCreateProposal
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700'
                          }`}
                        >
                          {proposalSubmitting ? 'Creating...' : 'Create'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateProposal(false)}
                          className="px-4 py-2 rounded-lg text-sm font-medium border bg-white text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                  <p className="text-sm font-medium text-gray-900">Proposals</p>
                  <p className="text-sm text-gray-600 mt-1">Latest proposals for this group.</p>
                </div>

                {proposals.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => router.push(`/member-dashboard/groups/${groupId}/proposals/${p.id}`)}
                    className="w-full text-left border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{p.title}</p>
                        {p.description && <p className="text-sm text-gray-700 mt-1">{p.description}</p>}
                        <p className="text-xs text-gray-500 mt-2">Created by: {p.created_by_name || '—'}</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-50 text-gray-800 border border-gray-200">
                        {String(p.status)}
                      </span>
                    </div>
                  </button>
                ))}

                {proposals.length === 0 && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <p className="text-sm text-gray-600">No proposals yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* USSD Push Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">

            {payStatus === 'input' && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {payModal.type === 'contribution' ? '💳 Lipa Mchango' : '➕ Weka Fedha Mfukoni'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">{group?.name}</p>

                {payModal.type === 'contribution' && (
                  <p className="text-xs text-gray-500 mb-3">
                    Mchango wa kawaida: TSH {Number.parseFloat(String(group?.monthly_contribution || 0)).toLocaleString()}/mwezi
                  </p>
                )}

                <label className="block text-sm font-medium text-gray-700 mb-1">Kiasi (TZS)</label>
                <input
                  type="number" min="1" value={payAmount}
                  onChange={(e) => { setPayAmount(e.target.value); setPayError(''); }}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />

                <label className="block text-sm font-medium text-gray-700 mb-1">Nambari ya Simu</label>
                <input
                  type="tel" value={payPhone}
                  onChange={(e) => { setPayPhone(e.target.value); setPayError(''); }}
                  placeholder="255712345678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-1 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                {payError && <p className="text-xs text-red-600 mb-2">{payError}</p>}

                <p className="text-xs text-gray-400 mb-4">
                  Utapokea arifa ya USSD kwenye simu yako. Ingiza PIN yako kuthibitisha malipo.
                </p>

                <div className="flex space-x-3">
                  <button onClick={handleClosePay} disabled={payLoading}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                    Ghairi
                  </button>
                  <button onClick={handlePay} disabled={payLoading}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                    {payLoading ? 'Inatuma...' : 'Lipa Sasa'}
                  </button>
                </div>
              </>
            )}

            {payStatus === 'waiting' && (
              <div className="text-center py-4">
                <div className="inline-block w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Inasubiri Uthibitisho...</h3>
                <p className="text-sm text-gray-600 mb-2">Arifa ya USSD imetumwa kwa <strong>{payPhone}</strong></p>
                <p className="text-xs text-gray-400 mb-4">Tafadhali ingiza PIN yako kwenye simu yako kuthibitisha malipo ya TSH {parseInt(payAmount).toLocaleString()}</p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-orange-700">Usifunge ukurasa huu hadi uthibitishe malipo kwenye simu yako.</p>
                </div>
                <button onClick={handleClosePay} className="text-sm text-gray-500 hover:text-gray-700 underline">Ghairi</button>
              </div>
            )}

            {payStatus === 'success' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">Malipo Yamefanikiwa!</h3>
                <p className="text-sm text-gray-600 mb-1">TSH {parseInt(payAmount).toLocaleString()} - {group?.name}</p>
                <p className="text-xs text-gray-400 mb-4">Ref: {payReference}</p>
                <button onClick={handleClosePay} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Funga</button>
              </div>
            )}

            {payStatus === 'failed' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Malipo Yameshindwa</h3>
                {payError && <p className="text-sm text-red-600 mb-4">{payError}</p>}
                <div className="flex space-x-3">
                  <button onClick={handleClosePay} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Funga</button>
                  <button onClick={() => { setPayStatus('input'); setPayError(''); }} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Jaribu Tena</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
