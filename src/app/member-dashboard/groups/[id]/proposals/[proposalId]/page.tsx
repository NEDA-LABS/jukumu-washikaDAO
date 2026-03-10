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
};

type VoteSummary = {
  yes: number;
  no: number;
  abstain: number;
  total: number;
};

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
        setProposal((json?.proposal as ProposalRow) || null);
        setVoteSummary((json?.voteSummary as VoteSummary) || { yes: 0, no: 0, abstain: 0, total: 0 });
        const v = json?.myVote;
        setMyVote(v === 'yes' || v === 'no' || v === 'abstain' ? v : null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Imeshindikana kupakua pendekezo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
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

  const pct = (n: number) => voteSummary.total > 0 ? Math.round((n / voteSummary.total) * 100) : 0;
  const isOpen = proposal?.status === 'open';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back */}
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
            <div className="rounded-2xl bg-[#141414] border border-white/[0.06] p-6">
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
            <div className="rounded-2xl bg-[#141414] border border-white/[0.06] p-5">
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
                      <div
                        className={`h-2 rounded-full ${row.bar} transition-all duration-500`}
                        style={{ width: `${pct(row.count)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <p className="text-xs text-white/25">Jumla: {voteSummary.total} kura</p>
                {myVote && (
                  <p className="text-xs text-orange-400">
                    Kura yako: <span className="font-semibold capitalize">{myVote === 'yes' ? 'Ndio' : myVote === 'no' ? 'Hapana' : 'Jiepushe'}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Vote action */}
            <div className="rounded-2xl bg-[#141414] border border-white/[0.06] p-5">
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

          </div>
        )}
      </div>
    </div>
  );
}
