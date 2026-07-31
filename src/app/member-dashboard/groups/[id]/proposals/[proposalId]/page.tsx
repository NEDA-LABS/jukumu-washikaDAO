'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

type ProposalMetadata = {
  funding_goal_tzs?: number | string;
  timeline?: string;
  expected_impact?: string;
  project_description?: string;
  vendor_name?: string;
  expense_category?: string;
  business_purpose?: string;
  attachment?: { dataUrl: string; name: string; mime: string } | null;
} | null;

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
  recipient_phone?: string | null;
  executed_at?: string | null;
  metadata?: ProposalMetadata;
};

const LEADERSHIP_ROLES = ['leader', 'mwenyekiti', 'katibu', 'mwekahazina'];

type VoteSummary = { yes: number; no: number; abstain: number; total: number };
type Member = { id: number; full_name: string };

export default function MemberGroupProposalDetailsPage() {
  const { t, language } = useLanguage();
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
        if (res.status === 403) { setError(t('prop.err.notAllowed')); return; }
        if (!res.ok) { setError(json?.error || t('prop.err.loadFailed')); return; }
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
        setError(e instanceof Error ? e.message : t('prop.err.loadFailed'));
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
      if (!res.ok) { setVoteError(json?.error || t('prop.err.voteFailed')); return; }
      setMyVote(vote);
      setVoteSummary((json?.voteSummary as VoteSummary) || voteSummary);
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : t('prop.err.voteFailed'));
    } finally {
      setVoteSubmitting(false);
    }
  };

  const handleExecute = async () => {
    if (!groupId || !proposalId) return;
    const amt = Number(amountInput);
    if (!amt || amt <= 0) { setExecuteError(t('prop.err.invalidAmount')); return; }
    if (!recipientInput) { setExecuteError(t('prop.chooseRecipient')); return; }
    setExecuting(true); setExecuteError(''); setExecuteSuccess('');
    try {
      const res = await fetch(`/api/member/groups/${groupId}/proposals/${proposalId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTzs: amt, recipientMemberId: Number(recipientInput) }),
      });
      if (res.status === 401) { router.push('/login'); return; }
      const json = await res.json().catch(() => null);
      if (!res.ok) { setExecuteError(json?.error || json?.details || t('prop.err.payFailed')); return; }
      setExecuteSuccess(t('prop.paid'));
      setProposal(p => (p ? { ...p, payment_status: 'completed' } : p));
    } catch (e) {
      setExecuteError(e instanceof Error ? e.message : t('prop.err.payFailed'));
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
      if (!res.ok) { setExecuteError(json?.error || t('prop.err.reopenFailed')); return; }
      setProposal(p => (p ? { ...p, status: 'open' } : p));
      setExecuteSuccess(t('prop.reopenSuccess'));
    } catch (e) {
      setExecuteError(e instanceof Error ? e.message : t('prop.err.reopenFailed'));
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <button
          onClick={() => router.push(`/member-dashboard/groups/${groupId}`)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          ← {t('prop.backToGroup')}
        </button>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {!error && proposal && (
          <div className="space-y-4">

            {/* Header card */}
            <div className="rounded-2xl bg-card border border-border p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  {proposal.proposal_type && (
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 ${
                      proposal.proposal_type === 'prodcast' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' :
                      proposal.proposal_type === 'ask' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' :
                      proposal.proposal_type === 'spend' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                      'bg-white/5 text-muted-foreground border border-border'
                    }`}>
                      {t(`prop.type.pill${proposal.proposal_type.charAt(0).toUpperCase()}${proposal.proposal_type.slice(1)}` as any) || proposal.proposal_type}
                    </span>
                  )}
                  <h1 className="text-lg font-bold text-foreground leading-snug">{proposal.title}</h1>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{t('prop.by')} {proposal.created_by_name || '—'}</span>
                    {proposal.created_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(proposal.created_at).toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isOpen ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-muted-foreground border border-border'
                }`}>
                  {isOpen ? t('prop.open') : t('prop.closed')}
                </span>
              </div>

              {proposal.description && (
                <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{proposal.description}</p>
              )}

              {/* Attachment (photo/PDF) */}
              {proposal.metadata?.attachment?.dataUrl && (
                proposal.metadata.attachment.mime.startsWith('image/') ? (
                  <a href={proposal.metadata.attachment.dataUrl} target="_blank" rel="noopener noreferrer" className="mt-4 block">
                    <img
                      src={proposal.metadata.attachment.dataUrl}
                      alt={proposal.metadata.attachment.name || 'Attachment'}
                      className="max-h-72 w-auto max-w-full rounded-xl border border-border object-contain"
                    />
                  </a>
                ) : (
                  <a
                    href={proposal.metadata.attachment.dataUrl}
                    download={proposal.metadata.attachment.name || 'attachment.pdf'}
                    className="mt-4 inline-flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-gold/40 transition-colors"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400 text-[10px] font-bold">PDF</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">{proposal.metadata.attachment.name || 'attachment.pdf'}</span>
                      <span className="block text-[11px] text-muted-foreground">{t('prop.attachment.view')} ↓</span>
                    </span>
                  </a>
                )
              )}
            </div>

            {/* Proposal details — type-specific metadata */}
            {(() => {
              const m = proposal.metadata || {};
              const rows: Array<{ label: string; value: React.ReactNode }> = [];

              if (proposal.proposal_type === 'prodcast') {
                if (m.funding_goal_tzs) rows.push({ label: t('prop.field.fundingGoal'), value: <span className="tabular-nums font-semibold text-foreground">TZS {Number(m.funding_goal_tzs).toLocaleString()}</span> });
                if (m.timeline) rows.push({ label: t('prop.field.timeline'), value: m.timeline });
                if (m.expected_impact) rows.push({ label: t('prop.field.impact'), value: m.expected_impact });
                if (m.project_description) rows.push({ label: t('prop.field.projectDesc'), value: <span className="whitespace-pre-wrap">{m.project_description}</span> });
              } else if (proposal.proposal_type === 'spend') {
                if (m.vendor_name) rows.push({ label: t('prop.field.vendor'), value: m.vendor_name });
                if (m.expense_category) rows.push({ label: t('prop.field.expenseCategory'), value: m.expense_category });
                if (proposal.recipient_phone) rows.push({ label: t('prop.recipientPhone'), value: <span className="font-mono">{proposal.recipient_phone}</span> });
              } else if (proposal.proposal_type === 'ask') {
                if (m.business_purpose) rows.push({ label: t('prop.field.businessPurpose'), value: <span className="whitespace-pre-wrap">{m.business_purpose}</span> });
              }

              if (rows.length === 0) return null;
              return (
                <div className="rounded-2xl bg-card border border-border p-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('prop.detailsHeading')}</p>
                  <dl className="space-y-3">
                    {rows.map((r, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
                        <dt className="text-xs text-muted-foreground sm:shrink-0 sm:w-40">{r.label}</dt>
                        <dd className="text-sm text-foreground sm:text-right sm:flex-1">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })()}

            {/* Vote results */}
            <div className="rounded-2xl bg-card border border-border p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('prop.results')}</p>

              <div className="space-y-3 mb-4">
                {([
                  { key: 'yes' as const,     label: t('prop.yes'),     count: voteSummary.yes,     bar: 'bg-emerald-500', text: 'text-emerald-400' },
                  { key: 'no' as const,      label: t('prop.no'),      count: voteSummary.no,      bar: 'bg-red-500',     text: 'text-red-400'     },
                  { key: 'abstain' as const, label: t('prop.abstain'), count: voteSummary.abstain, bar: 'bg-white/20',    text: 'text-muted-foreground' },
                ]).map(row => (
                  <div key={row.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${row.text}`}>{row.label}</span>
                      <span className={`text-xs tabular-nums ${row.text}`}>{row.count} ({pct(row.count)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-card overflow-hidden">
                      <div className={`h-2 rounded-full ${row.bar} transition-all duration-500`} style={{ width: `${pct(row.count)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border gap-3 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  {t('prop.totalVotes')}: {voteSummary.total} {t('prop.votes')}
                  {requiredYes > 0 ? ` · ${t('prop.needed')} ${requiredYes} "${t('prop.yes')}"` : ''}
                </p>
                {myVote && (
                  <p className="text-xs text-gold">
                    {t('prop.yourVote')}: <span className="font-semibold">{myVote === 'yes' ? t('prop.yes') : myVote === 'no' ? t('prop.no') : t('prop.abstain')}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Vote action */}
            <div className="rounded-2xl bg-card border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('prop.vote')}</p>
                {!isOpen && <p className="text-xs text-muted-foreground">{t('prop.votingClosed')}</p>}
              </div>

              {voteError && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{voteError}</div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'yes' as const,     label: t('prop.yes'),     active: 'bg-emerald-500 hover:bg-emerald-600 text-foreground border-transparent', inactive: 'bg-card hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 border-border' },
                  { key: 'no' as const,      label: t('prop.no'),      active: 'bg-red-500 hover:bg-red-600 text-foreground border-transparent',         inactive: 'bg-card hover:bg-red-500/10 text-muted-foreground hover:text-red-400 border-border'       },
                  { key: 'abstain' as const, label: t('prop.abstain'), active: 'bg-white/20 hover:bg-white/30 text-foreground border-transparent',       inactive: 'bg-card hover:bg-white/10 text-muted-foreground border-border'                             },
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
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  {myVote ? t('prop.canChange') : t('prop.allCanVote')}
                </p>
              )}
            </div>

            {/* Requested amount (visible to everyone, if any) */}
            {hasAmount && (
              <div className="rounded-2xl bg-card border border-border p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('prop.amountRequested')}</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">TZS {Number(proposal.payment_amount_tzs ?? 0).toLocaleString()}</span>
                </div>
                {proposal.recipient_name && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-muted-foreground">{t('prop.recipient')}</span>
                    <span className="text-sm text-foreground">{proposal.recipient_name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">{t('prop.paymentStatus')}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {isPaid ? t('prop.status.paid') : t('prop.status.pending')}
                  </span>
                </div>
              </div>
            )}

            {/* Leadership actions on a closed proposal */}
            {isLeadership && !isOpen && (
              <div className="rounded-2xl bg-card border border-border p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('prop.leaderAction')}</p>

                {executeError && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{executeError}</div>
                )}
                {executeSuccess && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">{executeSuccess}</div>
                )}

                {isPaid ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('prop.status')}</span>
                    <span className="text-xs font-semibold text-emerald-400">✓ {t('prop.status.paid')}</span>
                  </div>
                ) : passed ? (
                  <div className="space-y-3">
                    <p className="text-xs text-emerald-400">{t('prop.passed')}</p>
                    <div>
                      <label className="text-xs text-muted-foreground">{t('prop.amountTzs')}</label>
                      <input
                        type="number" inputMode="numeric" value={amountInput}
                        onChange={e => setAmountInput(e.target.value)}
                        placeholder={t('prop.amountPh')}
                        className="mt-1 w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder-white/20 focus:outline-none focus:border-orange-500/40"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{t('prop.recipient')}</label>
                      <select
                        value={recipientInput}
                        onChange={e => setRecipientInput(e.target.value)}
                        className="mt-1 w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-orange-500/40"
                      >
                        <option value="" className="bg-card">— {t('prop.chooseMember')} —</option>
                        {members.map(mm => (
                          <option key={mm.id} value={mm.id} className="bg-card">{mm.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleExecute}
                      disabled={executing}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-gold-deep text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {executing ? t('prop.executing') : t('prop.disburse')}
                    </button>
                    <p className="text-xs text-muted-foreground text-center">{t('prop.fromTreasury')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {t('prop.notEnoughVotes')} ({voteSummary.yes}/{requiredYes} &quot;{t('prop.yes')}&quot;). {t('prop.notEnoughVotesTail')}
                    </p>
                    <button
                      onClick={handleReopen}
                      disabled={reopening}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold bg-card hover:bg-muted text-muted-foreground border border-border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {reopening ? '...' : t('prop.reopenVoting')}
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
