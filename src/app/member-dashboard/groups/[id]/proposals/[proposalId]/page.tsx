'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

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
  proposal_type?: 'general' | 'ask' | 'spend' | 'prodcast' | string;
  payment_amount_tzs?: string | number | null;
  payment_status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
  recipient_member_id?: number | null;
  recipient_name?: string | null;
  executed_at?: string | null;
};

const LEADERSHIP_ROLES = ['leader', 'mwenyekiti', 'katibu', 'mwekahazina'];

type VoteSummary = { yes: number; no: number; abstain: number; total: number };
type Member = { id: number; full_name: string };

export default function MemberGroupProposalDetailsPage() {
  const router = useRouter();
  const routeParams = useParams<{ id?: string | string[]; proposalId?: string | string[] }>();

  const groupId = Array.isArray(routeParams?.id) ? routeParams?.id[0] : routeParams?.id;
  const proposalId = Array.isArray(routeParams?.proposalId) ? routeParams?.proposalId[0] : routeParams?.proposalId;

  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<ProposalRow | null>(null);
  const [voteSummary, setVoteSummary] = useState<VoteSummary>({ yes: 0, no: 0, abstain: 0, total: 0 });
  const [myVote, setMyVote] = useState<'yes' | 'no' | 'abstain' | null>(null);
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteError, setVoteError] = useState('');
  const [error, setError] = useState('');
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);
  const [requiredYes, setRequiredYes] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [amountInput, setAmountInput] = useState('');
  const [recipientInput, setRecipientInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [executeError, setExecuteError] = useState('');
  const [executeSuccess, setExecuteSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!groupId || !proposalId) { router.push('/member-dashboard?section=group'); return; }

    async function load() {
      setLoading(true); setError('');
      try {
        const res = await fetch(`/api/member/groups/${groupId}/proposals/${proposalId}`);
        if (cancelled) return;
        if (res.status === 401) { router.push('/login'); return; }
        const json = await res.json().catch(() => null);
        if (res.status === 403) { setError('Huruhusiwi kuona pendekezo hili.'); return; }
        if (!res.ok) { setError(json?.error || 'Imeshindikana kupakua pendekezo.'); return; }
        const p = (json?.proposal as ProposalRow) || null;
        setProposal(p);
        setVoteSummary((json?.voteSummary as VoteSummary) || { yes: 0, no: 0, abstain: 0, total: 0 });
        const v = json?.myVote;
        setMyVote(v === 'yes' || v === 'no' || v === 'abstain' ? v : null);
        setMembershipRole((json?.membership as { role?: string } | undefined)?.role ?? null);
        setPassed(Boolean(json?.passed));
        setRequiredYes(Number(json?.requiredYes ?? 0));
        // Pre-fill disburse form from the proposal (editable by leadership).
        if (p) {
          const amt = Number(p.payment_amount_tzs ?? 0);
          setAmountInput(amt > 0 ? String(amt) : '');
          setRecipientInput(String(p.recipient_member_id ?? p.created_by_member_id ?? ''));
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Imeshindikana kupakua pendekezo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadMembers() {
      try {
        const res = await fetch(`/api/member/groups/${groupId}/members`);
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const raw = (json?.members ?? json ?? []) as Record<string, unknown>[];
        const list = raw
          .map((m) => ({ id: Number(m.member_id ?? m.id), full_name: String(m.full_name ?? m.name ?? '—') }))
          .filter((m) => Number.isFinite(m.id) && m.id > 0);
        if (!cancelled) setMembers(list);
      } catch { /* recipient dropdown just stays empty */ }
    }

    load();
    loadMembers();
    return () => { cancelled = true; };
  }, [groupId, proposalId, router]);

  const handleVote = async (vote: 'yes' | 'no' | 'abstain') => {
    if (!groupId || !proposalId || proposal?.status !== 'open') return;
    setVoteSubmitting(true); setVoteError('');
    try {
      const res = await fetch(`/api/member/groups/${groupId}/proposals/${proposalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      const json = await res.json().catch(() => null);
      if (!res.ok) { setVoteError(json?.error || 'Imeshindikana kupiga kura.'); return; }
      setMyVote(vote);
      setVoteSummary((json?.voteSummary as VoteSummary) || voteSummary);
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : 'Imeshindikana kupiga kura.');
    } finally {
      setVoteSubmitting(false);
    }
  };

  const handleExecute = async () => {
    if (!groupId || !proposalId) return;
    const amt = Number(amountInput);
    if (!amt || amt <= 0) { setExecuteError('Weka kiasi sahihi cha malipo.'); return; }
    if (!recipientInput) { setExecuteError('Chagua mpokeaji.'); return; }
    setExecuting(true); setExecuteError(''); setExecuteSuccess('');
    try {
      const res = await fetch(`/api/member/groups/${groupId}/proposals/${proposalId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTzs: amt, recipientMemberId: Number(recipientInput) }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      const json = await res.json().catch(() => null);
      if (!res.ok) { setExecuteError(json?.error || json?.details || 'Imeshindikana kutekeleza malipo.'); return; }
      setExecuteSuccess('Malipo yamekamilika! (Funds disbursed)');
      setProposal(p => (p ? { ...p, payment_status: 'completed' } : p));
    } catch (e) {
      setExecuteError(e instanceof Error ? e.message : 'Imeshindikana kutekeleza malipo.');
    } finally {
      setExecuting(false);
    }
  };

  const handleReopen = async () => {
    if (!groupId || !proposalId) return;
    setReopening(true); setExecuteError(''); setExecuteSuccess('');
    try {
      const res = await fetch(`/api/member/groups/${groupId}/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen' }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      const json = await res.json().catch(() => null);
      if (!res.ok) { setExecuteError(json?.error || 'Imeshindikana kufungua kura.'); return; }
      setProposal(p => (p ? { ...p, status: 'open' } : p));
      setExecuteSuccess('Kura zimefunguliwa tena. Wanachama wanaweza kupiga kura.');
    } catch (e) {
      setExecuteError(e instanceof Error ? e.message : 'Imeshindikana kufungua kura.');
    } finally {
      setReopening(false);
    }
  };

  const pct = (n: number) => voteSummary.total > 0 ? Math.round((n / voteSummary.total) * 100) : 0;
  const isOpen = proposal?.status === 'open';
  const isPaid = proposal?.payment_status === 'completed';
  const isLeadership = membershipRole ? LEADERSHIP_ROLES.includes(membershipRole) : false;
  const hasAmount = Number(proposal?.payment_amount_tzs ?? 0) > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0a09] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0a09]">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <button
          onClick={() => router.push(`/member-dashboard/groups/${groupId}`)}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors mb-6"
        >
          ← Rudi Kwa Kundi
        </button>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {!error && proposal && (
          <div className="space-y-4">

            {/* Header card */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-white leading-snug">{proposal.title}</h1>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-white/30">na {proposal.created_by_name || '—'}</span>
                    {proposal.created_at && (
                      <span className="text-xs text-white/20">
                        {new Date(proposal.created_at).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isOpen ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-white/30 border border-white/10'
                }`}>
                  {isOpen ? 'Wazi' : 'Imefungwa'}
                </span>
              </div>

              {proposal.description && (
                <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{proposal.description}</p>
              )}
            </div>

            {/* Vote results */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Matokeo ya Kura</p>

              <div className="space-y-3 mb-4">
                {([
                  { key: 'yes' as const,     label: 'Ndio',    count: voteSummary.yes,     bar: 'bg-emerald-500', text: 'text-emerald-400' },
                  { key: 'no' as const,      label: 'Hapana',  count: voteSummary.no,      bar: 'bg-red-500',     text: 'text-red-400'     },
                  { key: 'abstain' as const, label: 'Jiepushe', count: voteSummary.abstain, bar: 'bg-white/20',   text: 'text-white/40'    },
                ]).map(row => (
                  <div key={row.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${row.text}`}>{row.label}</span>
                      <span className={`text-xs tabular-nums ${row.text}`}>{row.count} ({pct(row.count)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className={`h-2 rounded-full ${row.bar} transition-all duration-500`} style={{ width: `${pct(row.count)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <p className="text-xs text-white/25">Jumla: {voteSummary.total} kura{requiredYes > 0 ? ` · zinahitajika ${requiredYes} "Ndio"` : ''}</p>
                {myVote && (
                  <p className="text-xs text-[#e4a233]">
                    Kura yako: <span className="font-semibold capitalize">{myVote === 'yes' ? 'Ndio' : myVote === 'no' ? 'Hapana' : 'Jiepushe'}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Vote action */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Piga Kura</p>
                {!isOpen && <p className="text-xs text-white/25">Upigaji kura umefungwa</p>}
              </div>

              {voteError && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{voteError}</div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'yes' as const,     label: 'Ndio',     active: 'bg-emerald-500 hover:bg-emerald-600 text-white border-transparent', inactive: 'bg-white/[0.03] hover:bg-emerald-500/10 text-white/40 hover:text-emerald-400 border-white/[0.06]' },
                  { key: 'no' as const,      label: 'Hapana',   active: 'bg-red-500 hover:bg-red-600 text-white border-transparent',         inactive: 'bg-white/[0.03] hover:bg-red-500/10 text-white/40 hover:text-red-400 border-white/[0.06]'       },
                  { key: 'abstain' as const, label: 'Jiepushe', active: 'bg-white/20 hover:bg-white/30 text-white border-transparent',       inactive: 'bg-white/[0.03] hover:bg-white/10 text-white/40 border-white/[0.06]'                             },
                ]).map(btn => (
                  <button
                    key={btn.key}
                    onClick={() => handleVote(btn.key)}
                    disabled={voteSubmitting || !isOpen}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      myVote === btn.key ? btn.active : btn.inactive
                    }`}
                  >
                    {voteSubmitting && myVote === btn.key ? '...' : btn.label}
                  </button>
                ))}
              </div>

              {isOpen && (
                <p className="text-xs text-white/20 mt-3 text-center">
                  {myVote ? 'Unaweza kubadilisha kura yako wakati wowote.' : 'Wanachama wote wa kundi wanaweza kupiga kura.'}
                </p>
              )}
            </div>

            {/* Requested amount (visible to everyone, if any) */}
            {hasAmount && (
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Kiasi kilichoombwa</span>
                  <span className="text-sm font-semibold text-white tabular-nums">TZS {Number(proposal.payment_amount_tzs ?? 0).toLocaleString()}</span>
                </div>
                {proposal.recipient_name && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-white/50">Mpokeaji</span>
                    <span className="text-sm text-white/70">{proposal.recipient_name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-white/50">Hali ya malipo</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {isPaid ? 'Imelipwa' : 'Inasubiri'}
                  </span>
                </div>
              </div>
            )}

            {/* Leadership actions on a closed proposal */}
            {isLeadership && !isOpen && (
              <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Kitendo cha Uongozi</p>

                {executeError && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{executeError}</div>
                )}
                {executeSuccess && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">{executeSuccess}</div>
                )}

                {isPaid ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/50">Hali</span>
                    <span className="text-xs font-semibold text-emerald-400">✓ Imelipwa</span>
                  </div>
                ) : passed ? (
                  <div className="space-y-3">
                    <p className="text-xs text-emerald-400">Pendekezo limepita kura ✓ — unaweza kulipa kutoka hazina ya kundi.</p>
                    <div>
                      <label className="text-xs text-white/40">Kiasi (TZS)</label>
                      <input
                        type="number" inputMode="numeric" value={amountInput}
                        onChange={e => setAmountInput(e.target.value)}
                        placeholder="mf. 5000"
                        className="mt-1 w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40">Mpokeaji</label>
                      <select
                        value={recipientInput}
                        onChange={e => setRecipientInput(e.target.value)}
                        className="mt-1 w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                      >
                        <option value="" className="bg-white/[0.04]">— Chagua mwanachama —</option>
                        {members.map(mm => (
                          <option key={mm.id} value={mm.id} className="bg-white/[0.04]">{mm.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleExecute}
                      disabled={executing}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#d1622b] hover:bg-[#b9531f] text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {executing ? 'Inatekeleza...' : 'Tekeleza Malipo (Disburse)'}
                    </button>
                    <p className="text-xs text-white/20 text-center">Itatolewa kwenye salio la hazina ya kundi.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-white/40">
                      Pendekezo halikupata kura za kutosha ({voteSummary.yes}/{requiredYes} &quot;Ndio&quot;). Unaweza kufungua kura tena au kutengeneza pendekezo jipya.
                    </p>
                    <button
                      onClick={handleReopen}
                      disabled={reopening}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-white/70 border border-white/[0.08] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {reopening ? '...' : 'Fungua Kura Tena (Re-open voting)'}
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
