'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(ease * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

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
  const { showToast } = useToast();

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
          showToast('Malipo yamefanikiwa!', 'success');
          loadGroupPayments();
          setTimeout(() => loadGroupPayments(), 3000);
          setTimeout(() => loadGroupPayments(), 8000);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setPayStatus('failed');
          setPayError(data.failure_reason || 'Malipo yameshindwa.');
          showToast(data.failure_reason || 'Malipo yameshindwa.', 'error');
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
        showToast(data?.error || 'Imeshindikana kutuma fedha.', 'error');
        return;
      }
      setDisburseSuccess(`Malipo ya TSH ${amount.toLocaleString()} kwa ${disburseName} yametumwa! Ref: ${data?.reference}`);
      showToast(`TSH ${amount.toLocaleString()} imetumwa kwa ${disburseName}`, 'success');
      setDisbursePhone('');
      setDisburseName('');
      setDisburseAmount('');
      setDisburseDesc('');
      loadGroupPayments();
    } catch {
      setDisburseError('Hitilafu imetokea.');
      showToast('Hitilafu imetokea. Jaribu tena.', 'error');
    } finally {
      setDisburseLoading(false);
    }
  };

  // ── shared dark input style ──
  const dkInput = 'w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  const tabs: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',   label: 'Muhtasari',  icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
    { id: 'members',    label: 'Wanachama', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    { id: 'leadership', label: 'Uongozi',   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg> },
    { id: 'fedha',      label: 'Fedha',     icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
    { id: 'decisions',  label: 'Maamuzi',   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
  ];

  // ── animated counters for hero banner ──
  const animTotal    = useCountUp(paymentSummary.total_collected);
  const animMonth    = useCountUp(paymentSummary.this_month_collected);
  const animPayers   = useCountUp(paymentSummary.this_month_payers);
  const animMembers  = useCountUp(group?.member_count ?? members.length);

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Back nav ── */}
        <button
          onClick={() => router.push('/member-dashboard?section=group')}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors mb-4"
        >
          ← Rudi Makundi Yangu
        </button>

        {/* ── Hero banner ── */}
        <div className="relative rounded-2xl overflow-hidden mb-6">
          {/* gradient bg */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-600/30 via-orange-500/10 to-transparent" />
          <div className="absolute inset-0 bg-[#141414]" style={{ zIndex: -1 }} />
          {/* decorative circles */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-orange-500/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-orange-500/5 blur-xl pointer-events-none" />

          <div className="relative p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* group avatar */}
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <span className="text-xl font-bold text-orange-400">
                    {(group?.name || 'G').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">{group?.name || 'Kundi'}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/15 text-orange-400 border border-orange-500/25">
                      {roleLabel(membership?.role)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      group?.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30'
                    }`}>
                      {group?.status || 'active'}
                    </span>
                    {group?.founded_date && (
                      <span className="text-xs text-white/25">
                        Ilianzishwa {new Date(group.founded_date).getFullYear()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {canCreateProposal && (
                <button
                  onClick={() => { setActiveTab('decisions'); setShowCreateProposal(true); }}
                  className="shrink-0 self-start sm:self-auto px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-500/20"
                >
                  + Pendekezo
                </button>
              )}
            </div>

            {/* hero stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/[0.06]">
              {[
                { label: 'Wanachama', value: animMembers.toLocaleString(), unit: '' },
                { label: 'Mchango/Mwezi', value: `TSh ${Number.parseFloat(String(group?.monthly_contribution || 0)).toLocaleString()}`, unit: '' },
                { label: 'Jumla Iliyokusanywa', value: `TSh ${animTotal.toLocaleString()}`, unit: '' },
                { label: 'Waliolipa Mwezi Huu', value: String(animPayers), unit: `/ ${group?.member_count ?? members.length}` },
              ].map((s, i) => (
                <div key={i}>
                  <p className="text-xs text-white/30 mb-0.5">{s.label}</p>
                  <p className="text-base font-bold text-white tabular-nums">
                    {s.value}<span className="text-white/30 font-normal text-xs ml-0.5">{s.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {/* ── Side nav + content layout ── */}
        <div className="flex gap-5 items-start">

          {/* ── Sidebar (desktop) ── */}
          <aside className="hidden md:flex flex-col w-44 shrink-0 sticky top-6">
            <div className="rounded-xl bg-[#141414] border border-white/[0.06] overflow-hidden">
              {tabs.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium transition-all ${
                    activeTab === t.id
                      ? 'bg-orange-500/10 text-orange-400 border-l-2 border-orange-500'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03] border-l-2 border-transparent'
                  } ${i !== 0 ? 'border-t border-t-white/[0.04]' : ''}`}
                >
                  <span className={activeTab === t.id ? 'text-orange-400' : 'text-white/25'}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            {canCreateProposal && (
              <button
                onClick={() => { setActiveTab('decisions'); setShowCreateProposal(true); }}
                className="mt-3 w-full px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors shadow-lg shadow-orange-500/20"
              >
                + Pendekezo
              </button>
            )}
          </aside>

          {/* ── Content area ── */}
          <div className="flex-1 min-w-0">
          {activeTab === 'overview' && (
            <div className="space-y-4">

              {/* Group stat cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-4">
                  <p className="text-xs text-white/30 mb-1">Mchango/Mwezi</p>
                  <p className="text-base font-semibold text-orange-400">
                    TSh {Number.parseFloat(String(group?.monthly_contribution || 0)).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-4">
                  <p className="text-xs text-white/30 mb-1">Wanachama</p>
                  <p className="text-base font-semibold text-white">{group?.member_count ?? members.length}</p>
                </div>
                <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-4">
                  <p className="text-xs text-white/30 mb-1">Kiongozi</p>
                  <p className="text-base font-semibold text-white truncate">{group?.leader_name || '—'}</p>
                </div>
              </div>

              {/* Financial summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Jumla Iliyokusanywa', value: `TSh ${paymentSummary.total_collected.toLocaleString()}`, accent: 'text-emerald-400' },
                  { label: 'Mwezi Huu',            value: `TSh ${paymentSummary.this_month_collected.toLocaleString()}`, accent: 'text-blue-400' },
                  { label: 'Waliolipa Mwezi Huu',  value: String(paymentSummary.this_month_payers), accent: 'text-orange-400' },
                  { label: 'Jumla Iliyotumwa',     value: `TSh ${paymentSummary.total_disbursed.toLocaleString()}`, accent: 'text-purple-400' },
                ].map((c, i) => (
                  <div key={i} className="rounded-xl bg-[#1a1a1a] border border-white/5 p-3">
                    <p className="text-xs text-white/30 mb-1">{c.label}</p>
                    <p className={`text-sm font-semibold ${c.accent}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Group wallet card */}
              <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Wallet ya Kundi (USDC)</p>
                    <p className="text-xs text-white/30 mt-0.5">Inaonekana kwa wanachama wote.</p>
                  </div>
                  <div className="flex gap-2">
                    {walletSummary?.wallet === null && canCreateProposal && (
                      <button
                        disabled={walletLoading}
                        onClick={async () => {
                          if (!groupId) return;
                          setWalletLoading(true); setWalletError('');
                          try {
                            const res = await fetch(`/api/member/groups/${groupId}/wallet`, { method: 'POST' });
                            const json = await res.json().catch(() => null);
                            if (!res.ok) { setWalletError(json?.error || 'Imeshindikana kuunda wallet.'); showToast(json?.error || 'Imeshindikana kuunda wallet.', 'error'); return; }
                            const refresh = await fetch(`/api/member/groups/${groupId}/wallet`);
                            const rj = await refresh.json().catch(() => null);
                            if (refresh.ok) { setWalletSummary((rj as WalletSummary) || null); showToast('Wallet imeundwa!', 'success'); }
                            const tr = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                            const trj = await tr.json().catch(() => null);
                            if (tr.ok) setWalletTransfers(Array.isArray(trj?.transfers) ? trj.transfers : []);
                          } catch (err) { const msg = err instanceof Error ? err.message : 'Imeshindikana kuunda wallet.'; setWalletError(msg); showToast(msg, 'error'); }
                          finally { setWalletLoading(false); }
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors"
                      >
                        {walletLoading ? 'Inaunda...' : 'Unda Wallet'}
                      </button>
                    )}
                    {walletSummary?.wallet && (
                      <button
                        disabled={walletLoading}
                        onClick={async () => {
                          if (!groupId) return;
                          setWalletLoading(true); setWalletError('');
                          try {
                            const refresh = await fetch(`/api/member/groups/${groupId}/wallet`);
                            const rj = await refresh.json().catch(() => null);
                            if (refresh.ok) setWalletSummary((rj as WalletSummary) || null);
                            const tr = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                            const trj = await tr.json().catch(() => null);
                            if (tr.ok) setWalletTransfers(Array.isArray(trj?.transfers) ? trj.transfers : []);
                          } catch (err) { setWalletError(err instanceof Error ? err.message : 'Imeshindikana kupakua.'); }
                          finally { setWalletLoading(false); }
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/50 border border-white/10 disabled:opacity-50 transition-colors"
                      >
                        Refresh
                      </button>
                    )}
                  </div>
                </div>

                {walletError && (
                  <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{walletError}</div>
                )}

                {walletSummary?.wallet && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                      <p className="text-xs text-white/30 mb-1">Anwani</p>
                      <p className="text-sm font-mono text-white">{shortAddress(walletSummary.wallet.address)}</p>
                      <p className="text-xs text-white/20 mt-0.5">{walletSummary.wallet.network}</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                      <p className="text-xs text-white/30 mb-1">Salio la USDC</p>
                      <p className="text-sm font-semibold text-blue-400">
                        {formatBaseUnits(walletSummary.balances?.usdc?.amountBaseUnits, walletSummary.balances?.usdc?.decimals ?? 6)} USDC
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                      <p className="text-xs text-white/30 mb-1">ETH (Gas)</p>
                      <p className="text-sm font-semibold text-white/60">
                        {formatBaseUnits(walletSummary.balances?.eth?.amountBaseUnits, walletSummary.balances?.eth?.decimals ?? 18)} ETH
                      </p>
                    </div>
                  </div>
                )}

                {walletSummary?.wallet && (
                  <div>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Miamala ya Hivi Karibuni</p>
                    <div className="space-y-2">
                      {(walletSummary.recentTransfers || []).length === 0 ? (
                        <p className="text-xs text-white/20 py-3 text-center">— Hakuna miamala bado —</p>
                      ) : (walletSummary.recentTransfers || []).map((t) => (
                        <div key={t.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2.5">
                          <div>
                            <p className="text-xs text-white/70">→ {shortAddress(t.to_address)}</p>
                            <p className="text-xs text-white/30 mt-0.5">{formatBaseUnits(t.amount_base_units, 6)} USDC</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40">{t.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {walletSummary?.wallet && (
                  <div className="mt-5 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Simamia Miamala</p>
                        <p className="text-xs text-white/30 mt-0.5">USDC pekee. Inahitaji idhini 2-kati-ya-3.</p>
                      </div>
                      <button
                        disabled={walletTransfersLoading}
                        onClick={async () => {
                          if (!groupId) return;
                          setWalletTransfersLoading(true); setWalletTransfersError('');
                          try {
                            const tr = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                            const trj = await tr.json().catch(() => null);
                            if (!tr.ok) { setWalletTransfersError(trj?.error || 'Imeshindikana kupakua.'); return; }
                            setWalletTransfers(Array.isArray(trj?.transfers) ? trj.transfers : []);
                          } catch (err) { setWalletTransfersError(err instanceof Error ? err.message : 'Imeshindikana kupakua.'); }
                          finally { setWalletTransfersLoading(false); }
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/40 border border-white/10 disabled:opacity-50 transition-colors"
                      >
                        Refresh
                      </button>
                    </div>

                    {walletTransfersError && (
                      <div className="mb-3 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{walletTransfersError}</div>
                    )}

                    {canProposeTransfer && (
                      <form
                        className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!groupId || !walletSummary?.wallet) return;
                          const to = transferToAddress.trim();
                          const amt = transferAmount.trim();
                          if (!to || !amt) { setWalletTransfersError('Anwani na kiasi vinahitajika.'); return; }
                          setTransferSubmitting(true); setWalletTransfersError('');
                          try {
                            const res = await fetch(`/api/member/groups/${groupId}/wallet/transfers`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ toAddress: to, amount: amt }),
                            });
                            const json = await res.json().catch(() => null);
                            if (!res.ok) { setWalletTransfersError(json?.error || 'Imeshindikana kuanzisha transfer.'); showToast(json?.error || 'Imeshindikana kuanzisha transfer.', 'error'); return; }
                            showToast('Pendekezo la transfer limetumwa!', 'success');
                            setTransferToAddress(''); setTransferAmount('');
                            const refresh = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                            const rj = await refresh.json().catch(() => null);
                            if (refresh.ok) setWalletTransfers(Array.isArray(rj?.transfers) ? rj.transfers : []);
                          } catch (err) { const msg = err instanceof Error ? err.message : 'Imeshindikana.'; setWalletTransfersError(msg); showToast(msg, 'error'); }
                          finally { setTransferSubmitting(false); }
                        }}
                      >
                        <div className="md:col-span-2">
                          <label className="block text-xs text-white/40 mb-1">Anwani ya Mpokeaji</label>
                          <input value={transferToAddress} onChange={e => setTransferToAddress(e.target.value)} className={dkInput} placeholder="0x..." />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-1">Kiasi (USDC)</label>
                          <input value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className={dkInput} placeholder="e.g. 10.5" />
                        </div>
                        <div className="md:col-span-3">
                          <button type="submit" disabled={transferSubmitting}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors">
                            {transferSubmitting ? 'Inatuma...' : 'Pendekeza Transfer'}
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="mt-4 space-y-2">
                      {walletTransfers.length === 0 ? (
                        <p className="text-xs text-white/20 py-3 text-center">— Hakuna mapendekezo ya transfer bado —</p>
                      ) : walletTransfers.map((t) => (
                        <div key={t.id} className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-white">Transfer #{t.id}</p>
                              <p className="text-xs text-white/30 mt-0.5">→ {shortAddress(t.to_address)}</p>
                              <p className="text-xs text-white/30">{formatBaseUnits(t.amount_base_units, 6)} USDC</p>
                              <p className="text-xs text-white/20">Idhini: {t.approval_count ?? 0}/{t.approvals_required}</p>
                              {t.executed_tx_hash && (
                                <a href={`https://basescan.org/tx/${t.executed_tx_hash}`} target="_blank" rel="noreferrer"
                                  className="text-xs text-orange-400 hover:text-orange-300 mt-0.5 inline-block">
                                  Angalia BaseScan →
                                </a>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40">{t.status}</span>
                              {canApproveOrExecuteTransfer && t.status !== 'executed' && (
                                <div className="flex gap-1.5">
                                  <button
                                    disabled={walletTransfersLoading}
                                    onClick={async () => {
                                      if (!groupId) return;
                                      setWalletTransfersLoading(true); setWalletTransfersError('');
                                      try {
                                        const res = await fetch(`/api/member/groups/${groupId}/wallet/transfers/${t.id}/approve`, { method: 'POST' });
                                        const json = await res.json().catch(() => null);
                                        if (!res.ok) { setWalletTransfersError(json?.error || 'Imeshindikana.'); showToast(json?.error || 'Imeshindikana ku-idhinisha.', 'error'); return; }
                                        showToast('Transfer imeidhinishwa!', 'success');
                                        const refresh = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                                        const rj = await refresh.json().catch(() => null);
                                        if (refresh.ok) setWalletTransfers(Array.isArray(rj?.transfers) ? rj.transfers : []);
                                      } catch (err) { const msg = err instanceof Error ? err.message : 'Imeshindikana.'; setWalletTransfersError(msg); showToast(msg, 'error'); }
                                      finally { setWalletTransfersLoading(false); }
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white/50 border border-white/10 disabled:opacity-50 transition-colors"
                                  >Idhinisha</button>
                                  <button
                                    disabled={walletTransfersLoading}
                                    onClick={async () => {
                                      if (!groupId) return;
                                      setWalletTransfersLoading(true); setWalletTransfersError('');
                                      try {
                                        const res = await fetch(`/api/member/groups/${groupId}/wallet/transfers/${t.id}/execute`, { method: 'POST' });
                                        const json = await res.json().catch(() => null);
                                        if (!res.ok) { setWalletTransfersError(json?.error || 'Imeshindikana.'); showToast(json?.error || 'Imeshindikana kutekeleza.', 'error'); return; }
                                        showToast('Transfer imetekelezwa!', 'success');
                                        const rw = await fetch(`/api/member/groups/${groupId}/wallet`);
                                        const rwj = await rw.json().catch(() => null);
                                        if (rw.ok) setWalletSummary((rwj as WalletSummary) || null);
                                        const refresh = await fetch(`/api/member/groups/${groupId}/wallet/transfers`);
                                        const rj = await refresh.json().catch(() => null);
                                        if (refresh.ok) setWalletTransfers(Array.isArray(rj?.transfers) ? rj.transfers : []);
                                      } catch (err) { const msg = err instanceof Error ? err.message : 'Imeshindikana.'; setWalletTransfersError(msg); showToast(msg, 'error'); }
                                      finally { setWalletTransfersLoading(false); }
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors"
                                  >Tekeleza</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {walletSummary?.wallet === null && !walletLoading && !walletError && (
                  <p className="text-xs text-white/20 mt-3 text-center">— Hakuna wallet iliyoundwa bado —</p>
                )}
              </div>

              {/* Recent proposals preview */}
              <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-white">Mapendekezo ya Hivi Karibuni</p>
                  <button onClick={() => setActiveTab('decisions')} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
                    Angalia yote →
                  </button>
                </div>
                <div className="space-y-2">
                  {recentProposals.length === 0 ? (
                    <p className="text-xs text-white/20 py-3 text-center">— Hakuna mapendekezo bado —</p>
                  ) : recentProposals.map((p) => (
                    <button key={p.id}
                      onClick={() => router.push(`/member-dashboard/groups/${groupId}/proposals/${p.id}`)}
                      className="w-full text-left rounded-lg bg-white/[0.03] border border-white/5 hover:border-orange-500/20 hover:bg-orange-500/5 px-3 py-2.5 transition-all"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-white/80 truncate">{p.title}</p>
                          <p className="text-xs text-white/25 mt-0.5">{p.created_by_name || '—'}</p>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${
                          p.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30'
                        }`}>{p.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Members tab ── */}
          {activeTab === 'members' && (
            <div className="rounded-xl bg-[#1a1a1a] border border-white/5 overflow-hidden">
              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 px-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <p className="text-sm font-medium text-white/30">Hakuna wanachama bado</p>
                  <p className="text-xs text-white/15 mt-1">Wanachama wataonekana hapa baada ya kujiunga</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {members.map((m) => {
                    const mp = memberPaymentStatus.find((p: any) => p.member_id === m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-orange-400">
                              {m.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{m.full_name}</p>
                            <p className="text-xs text-white/25 truncate">{m.email || m.phone || ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            m.role === 'leader' || m.role === 'mwenyekiti' ? 'bg-orange-500/10 text-orange-400'
                            : m.role === 'katibu' || m.role === 'mwekahazina' ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-white/5 text-white/30'
                          }`}>{roleLabel(m.role)}</span>
                          {isLeader && mp && (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              mp.paid_this_month ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>{mp.paid_this_month ? 'Amelipa' : 'Hajalipa'}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Leadership tab ── */}
          {activeTab === 'leadership' && (
            <div className="space-y-2">
              {leadership.length === 0 ? (
                <div className="rounded-xl bg-[#1a1a1a] border border-white/5 flex flex-col items-center justify-center py-14 px-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                  </div>
                  <p className="text-sm font-medium text-white/30">Hakuna uongozi bado</p>
                  <p className="text-xs text-white/15 mt-1">Viongozi watateuliwa na msimamizi</p>
                </div>
              ) : leadership.map((l) => (
                <div key={l.id} className="rounded-xl bg-[#1a1a1a] border border-white/5 px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-blue-400">{l.full_name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{l.full_name}</p>
                      <p className="text-xs text-white/25">{l.email || ''}</p>
                    </div>
                  </div>
                  <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    {roleLabel(l.role)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Fedha tab ── */}
          {activeTab === 'fedha' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Jumla Iliyokusanywa', value: `TSh ${paymentSummary.total_collected.toLocaleString()}`, accent: 'text-emerald-400' },
                  { label: 'Mwezi Huu',            value: `TSh ${paymentSummary.this_month_collected.toLocaleString()}`, accent: 'text-blue-400' },
                  { label: `Waliolipa (${paymentSummary.this_month_payers}/${members.length})`, value: `${members.length > 0 ? Math.round((paymentSummary.this_month_payers / members.length) * 100) : 0}%`, accent: 'text-orange-400' },
                  { label: 'Jumla Iliyotumwa',     value: `TSh ${paymentSummary.total_disbursed.toLocaleString()}`, accent: 'text-purple-400' },
                ].map((c, i) => (
                  <div key={i} className="rounded-xl bg-[#1a1a1a] border border-white/5 p-3">
                    <p className="text-xs text-white/30 mb-1">{c.label}</p>
                    <p className={`text-sm font-semibold ${c.accent}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Pay buttons */}
              <div className="flex gap-3">
                <button onClick={() => handleOpenPay('contribution')}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
                  Lipa Mchango
                </button>
                <button onClick={() => handleOpenPay('topup')}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm font-medium transition-colors">
                  Weka Mfuko
                </button>
              </div>

              {/* Member payment status (leader only) */}
              {isLeader && memberPaymentStatus.length > 0 && (
                <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5">
                  <p className="text-sm font-semibold text-white mb-3">
                    Hali ya Michango — {new Date().toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' })}
                  </p>
                  <div className="divide-y divide-white/5">
                    {memberPaymentStatus.map((mp: any) => (
                      <div key={mp.member_id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm text-white">{mp.full_name}</p>
                          <p className="text-xs text-white/25">{mp.phone || ''}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          mp.paid_this_month ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>{mp.paid_this_month ? 'Amelipa ✓' : 'Hajalipa'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disbursement form (leader only) */}
              {isLeader && (
                <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5">
                  <p className="text-sm font-semibold text-white mb-0.5">Tuma Fedha kwa Mwanachama</p>
                  <p className="text-xs text-white/30 mb-4">Tuma pesa moja kwa moja kupitia mobile money.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Jina la Mpokeaji</label>
                      <input value={disburseName} onChange={e => { setDisburseName(e.target.value); setDisburseError(''); }}
                        placeholder="e.g. John Doe" className={dkInput} />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Nambari ya Simu</label>
                      <input value={disbursePhone} onChange={e => { setDisbursePhone(e.target.value); setDisburseError(''); }}
                        placeholder="255712345678" className={dkInput} />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Kiasi (TZS)</label>
                      <input type="number" value={disburseAmount} onChange={e => { setDisburseAmount(e.target.value); setDisburseError(''); }}
                        placeholder="e.g. 50000" className={dkInput} />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Mtandao</label>
                      <select value={disburseProvider} onChange={e => setDisburseProvider(e.target.value)}
                        className={dkInput + ' bg-[#111] [&>option]:bg-[#111]'}>
                        <option value="airtel">Airtel Money</option>
                        <option value="mpesa">Vodacom M-Pesa</option>
                        <option value="tigopesa">Tigo Pesa</option>
                        <option value="halopesa">Halo Pesa</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-white/40 mb-1">Maelezo (si lazima)</label>
                      <input value={disburseDesc} onChange={e => setDisburseDesc(e.target.value)}
                        placeholder="e.g. Malipo ya mkopo" className={dkInput} />
                    </div>
                  </div>
                  {disburseError && <p className="text-xs text-red-400 mt-2">{disburseError}</p>}
                  {disburseSuccess && <p className="text-xs text-emerald-400 mt-2">{disburseSuccess}</p>}
                  <button onClick={handleDisburse} disabled={disburseLoading}
                    className="mt-4 px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                    {disburseLoading ? 'Inatuma...' : 'Tuma Fedha'}
                  </button>
                </div>
              )}

              {/* Payment history */}
              <div className="rounded-xl bg-[#1a1a1a] border border-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                  <p className="text-sm font-semibold text-white">Historia ya Malipo</p>
                </div>
                {groupPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    <p className="text-sm font-medium text-white/30">Hakuna malipo bado</p>
                    <p className="text-xs text-white/15 mt-1">Malipo yataonekana hapa baada ya kukusanywa</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {groupPayments.map((p: any) => (
                      <div key={p.reference} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <p className="text-sm text-white/80 truncate">{p.member_name || p.customer_name || '—'}</p>
                          <p className="text-xs text-white/25 mt-0.5">
                            {p.payment_type === 'contribution' ? 'Mchango' : p.payment_type === 'group_topup' ? 'Mfuko' : 'Malipo'}
                            {' · '}
                            {p.created_at ? new Date(p.created_at).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short' }) : '—'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-sm font-semibold ${p.payment_type === 'disbursement' ? 'text-red-400' : 'text-emerald-400'}`}>
                            {p.payment_type === 'disbursement' ? '−' : '+'}TSh {parseInt(p.amount_tzs || 0).toLocaleString()}
                          </p>
                          <span className={`text-xs ${
                            p.status === 'completed' ? 'text-emerald-400' :
                            p.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                          }`}>
                            {p.status === 'completed' ? 'Imekamilika' : p.status === 'failed' ? 'Imeshindwa' : 'Inasubiri'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Decisions tab ── */}
          {activeTab === 'decisions' && (
            <div className="space-y-3">
              {showCreateProposal && (
                <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold text-white">Unda Pendekezo</p>
                      <p className="text-xs text-white/30 mt-0.5">Nafasi ya uongozi pekee.</p>
                    </div>
                    <button onClick={() => setShowCreateProposal(false)} className="text-white/30 hover:text-white/60 text-sm transition-colors">✕</button>
                  </div>

                  {!canCreateProposal && (
                    <div className="mb-4 px-3 py-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
                      Huna ruhusa ya kuunda mapendekezo.
                    </div>
                  )}

                  <form className="space-y-3" onSubmit={async (e) => {
                    e.preventDefault();
                    if (!groupId || !canCreateProposal) return;
                    const t = proposalTitle.trim();
                    const d = proposalDescription.trim();
                    if (!t) { setError('Kichwa cha pendekezo kinahitajika.'); return; }
                    setProposalSubmitting(true); setError('');
                    try {
                      const res = await fetch(`/api/member/groups/${groupId}/proposals`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: t, description: d }),
                      });
                      if (res.status === 401) { router.push('/login'); return; }
                      const json = await res.json().catch(() => null);
                      if (!res.ok) { setError(json?.error || 'Imeshindikana kuunda pendekezo.'); showToast(json?.error || 'Imeshindikana kuunda pendekezo.', 'error'); return; }
                      const created = json?.proposal as ProposalRow | undefined;
                      if (created) setProposals(prev => [created, ...prev]);
                      showToast('Pendekezo limeundwa!', 'success');
                      setProposalTitle(''); setProposalDescription(''); setShowCreateProposal(false);
                    } catch (err) { const msg = err instanceof Error ? err.message : 'Imeshindikana.'; setError(msg); showToast(msg, 'error'); }
                    finally { setProposalSubmitting(false); }
                  }}>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Kichwa</label>
                      <input value={proposalTitle} onChange={e => setProposalTitle(e.target.value)}
                        className={dkInput} placeholder="e.g. Ongeza mchango wa kila mwezi" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Maelezo</label>
                      <textarea value={proposalDescription} onChange={e => setProposalDescription(e.target.value)}
                        className={dkInput + ' resize-none'} placeholder="Eleza pendekezo lako..." rows={4} />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={proposalSubmitting || !canCreateProposal}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors">
                        {proposalSubmitting ? 'Inaunda...' : 'Unda'}
                      </button>
                      <button type="button" onClick={() => setShowCreateProposal(false)}
                        className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-white/50 border border-white/10 transition-colors">
                        Ghairi
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {proposals.length === 0 ? (
                <div className="rounded-xl bg-[#1a1a1a] border border-white/5 flex flex-col items-center justify-center py-14 px-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  </div>
                  <p className="text-sm font-medium text-white/30">Hakuna mapendekezo bado</p>
                  <p className="text-xs text-white/15 mt-1">Bonyeza &quot;+ Pendekezo&quot; kuunda la kwanza</p>
                </div>
              ) : proposals.map((p) => (
                <button key={p.id}
                  onClick={() => router.push(`/member-dashboard/groups/${groupId}/proposals/${p.id}`)}
                  className="w-full text-left rounded-xl bg-[#1a1a1a] border border-white/5 hover:border-orange-500/20 hover:bg-orange-500/5 p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{p.title}</p>
                      {p.description && <p className="text-xs text-white/40 mt-1 line-clamp-2">{p.description}</p>}
                      <p className="text-xs text-white/20 mt-2">na {p.created_by_name || '—'}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30'
                    }`}>{p.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          </div>
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111] border-t border-white/[0.07] flex">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-all ${
              activeTab === t.id ? 'text-orange-400' : 'text-white/30'
            }`}
          >
            <span className={activeTab === t.id ? 'text-orange-400' : 'text-white/25'}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      {/* spacer so content isn't hidden behind mobile nav */}
      <div className="md:hidden h-16" />

      {/* ── Payment modal ── */}
      {payModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#1a1a1a] border border-white/10 p-6">

            {payStatus === 'input' && (
              <>
                <h3 className="text-base font-semibold text-white mb-1">
                  {payModal.type === 'contribution' ? 'Lipa Mchango' : 'Weka Fedha Mfukoni'}
                </h3>
                <p className="text-xs text-white/30 mb-4">{group?.name}</p>
                {payModal.type === 'contribution' && (
                  <p className="text-xs text-orange-400/70 mb-4 px-3 py-2 rounded-lg bg-orange-500/5 border border-orange-500/10">
                    Mchango wa kawaida: TSh {Number.parseFloat(String(group?.monthly_contribution || 0)).toLocaleString()}/mwezi
                  </p>
                )}
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Kiasi (TZS)</label>
                    <input type="number" min="1" value={payAmount}
                      onChange={e => { setPayAmount(e.target.value); setPayError(''); }}
                      placeholder="e.g. 50000" className={dkInput} />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Nambari ya Simu</label>
                    <input type="tel" value={payPhone}
                      onChange={e => { setPayPhone(e.target.value); setPayError(''); }}
                      placeholder="255712345678" className={dkInput} />
                  </div>
                </div>
                {payError && <p className="text-xs text-red-400 mb-3">{payError}</p>}
                <p className="text-xs text-white/20 mb-5">Utapokea arifa ya USSD kwenye simu yako. Ingiza PIN kuthibitisha.</p>
                <div className="flex gap-2">
                  <button onClick={handleClosePay} disabled={payLoading}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 disabled:opacity-50 transition-colors">
                    Ghairi
                  </button>
                  <button onClick={handlePay} disabled={payLoading}
                    className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                    {payLoading ? 'Inatuma...' : 'Lipa Sasa'}
                  </button>
                </div>
              </>
            )}

            {payStatus === 'waiting' && (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto mb-4" />
                <h3 className="text-base font-semibold text-white mb-2">Inasubiri Uthibitisho...</h3>
                <p className="text-sm text-white/40 mb-1">Arifa imetumwa kwa <span className="text-white">{payPhone}</span></p>
                <p className="text-xs text-white/25 mb-4">Ingiza PIN kwenye simu yako kuthibitisha TSh {parseInt(payAmount).toLocaleString()}</p>
                <div className="px-4 py-3 rounded-xl bg-orange-500/5 border border-orange-500/10 mb-4">
                  <p className="text-xs text-orange-400/70">Usifunge ukurasa huu hadi malipo yakamilike.</p>
                </div>
                <button onClick={handleClosePay} className="text-xs text-white/25 hover:text-white/50 underline transition-colors">Ghairi</button>
              </div>
            )}

            {payStatus === 'success' && (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Malipo Yamefanikiwa!</h3>
                <p className="text-sm text-white/40 mb-1">TSh {parseInt(payAmount).toLocaleString()} — {group?.name}</p>
                <p className="text-xs text-white/20 mb-5">Ref: {payReference}</p>
                <button onClick={handleClosePay} className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors">Funga</button>
              </div>
            )}

            {payStatus === 'failed' && (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">Malipo Yameshindwa</h3>
                {payError && <p className="text-sm text-red-400 mb-4">{payError}</p>}
                <div className="flex gap-2">
                  <button onClick={handleClosePay} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-colors">Funga</button>
                  <button onClick={() => { setPayStatus('input'); setPayError(''); }}
                    className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">Jaribu Tena</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
