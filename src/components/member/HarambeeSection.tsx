'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { HARAMBEE_KINDS } from '@/lib/harambee-kinds';

/**
 * A member's collections: the ones they have opened, and the form to open one.
 *
 * The organiser's view is not the public one. It shows contributions that are
 * still in flight, and the real name behind a gift given anonymously, because
 * the organiser is the person who has to thank people and account for what
 * arrived. The public page shows neither.
 */

type Harambee = {
  id: number; code: string; title: string; kind: string; story: string | null;
  beneficiary: string | null; target_tzs: string | null; deadline: string | null;
  status: string; group_name: string | null; raised_tzs: string; contributors: number;
};
type Contribution = {
  id: number; contributor_name: string; phone: string | null; amount_tzs: string;
  method: string; status: string; message: string | null; anonymous: boolean;
  reference: string; created_at: string;
};

const tsh = (n: number | string) => `TSh ${Math.round(Number(n)).toLocaleString('en-US')}`;

const KIND_LABEL: Record<string, [string, string]> = {
  wedding: ['Harusi', 'Wedding'], funeral: ['Msiba', 'Funeral'], medical: ['Matibabu', 'Medical'],
  education: ['Elimu', 'Education'], emergency: ['Dharura', 'Emergency'],
  community: ['Jamii', 'Community'], other: ['Nyingine', 'Other'],
};

export default function HarambeeSection() {
  const { language } = useLanguage();
  const sw = language === 'sw';
  const [rows, setRows] = useState<Harambee[] | null>(null);
  // Fetched here rather than passed in: the destination selector is this
  // component's business, and threading it through the dashboard would couple
  // two screens that otherwise share nothing.
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ contributions: Contribution[]; totals: { raisedTzs: number; pendingTzs: number } } | null>(null);
  const [copied, setCopied] = useState('');

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('other');
  const [beneficiary, setBeneficiary] = useState('');
  const [story, setStory] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [groupId, setGroupId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/member/harambees');
      if (res.ok) { const d = await res.json(); setRows(d.harambees ?? []); }
      else setRows([]);
    } catch { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/member/groups');
        if (!res.ok) return;
        const d = await res.json();
        const list = Array.isArray(d) ? d : (d.groups ?? []);
        setGroups(list.map((g: { id: number; name: string }) => ({ id: g.id, name: g.name })));
      } catch {
        // Without groups the collection simply pays into the member's wallet.
      }
    })();
  }, []);

  const openDetail = async (id: number) => {
    setOpenId(id); setDetail(null);
    try {
      const res = await fetch(`/api/member/harambees/${id}`);
      if (res.ok) setDetail(await res.json());
    } catch { /* the list still stands */ }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (title.trim().length < 3) { setError(sw ? 'Andika jina la mchango' : 'Give the collection a name'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/member/harambees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), kind, story: story.trim() || undefined,
          beneficiary: beneficiary.trim() || undefined,
          targetTzs: target ? Number(target) : undefined,
          deadline: deadline || undefined,
          groupId: groupId ? Number(groupId) : undefined,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setError(d?.error || (sw ? 'Imeshindikana' : 'That did not work')); return; }
      setCreating(false);
      setTitle(''); setStory(''); setBeneficiary(''); setTarget(''); setDeadline(''); setGroupId(''); setKind('other');
      await load();
    } catch { setError(sw ? 'Tatizo la mtandao' : 'Network error'); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: number, status: 'open' | 'closed') => {
    await fetch(`/api/member/harambees/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
    if (openId === id) openDetail(id);
  };

  const shareLink = async (code: string) => {
    const url = `${window.location.origin}/harambee/${code}`;
    if (navigator.share) {
      try { await navigator.share({ title: sw ? 'Mchango' : 'Collection', url }); return; } catch { /* fall through */ }
    }
    try { await navigator.clipboard.writeText(url); setCopied(code); setTimeout(() => setCopied(''), 2000); } catch { /* selectable on screen */ }
  };

  const field = 'mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-foreground';
  const kicker = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{sw ? 'Michango' : 'Collections'}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {sw
              ? 'Kusanya pesa kwa harusi, msiba, matibabu au jambo lolote la dharura — kisha sambaza kiungo.'
              : 'Pool money for a wedding, a funeral, hospital bills or anything urgent — then share the link.'}
          </p>
        </div>
        <button onClick={() => { setCreating((v) => !v); setError(''); }}
          className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">
          {creating ? (sw ? 'Ghairi' : 'Cancel') : (sw ? 'Anzisha mchango' : 'Start a collection')}
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <label className="block">
            <span className={kicker}>{sw ? 'Jina' : 'Name'}</span>
            <input value={title} onChange={(e) => { setTitle(e.target.value); setError(''); }}
              placeholder={sw ? 'Mfano: Msiba wa Mzee Juma' : 'e.g. Mzee Juma funeral'} className={field} />
          </label>
          <div>
            <span className={kicker}>{sw ? 'Ni kwa ajili ya nini?' : 'What is it for?'}</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {HARAMBEE_KINDS.map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium ${kind === k ? 'border-foreground bg-foreground/5 text-foreground' : 'border-border text-muted-foreground'}`}>
                  {(KIND_LABEL[k] ?? KIND_LABEL.other)[sw ? 0 : 1]}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={kicker}>{sw ? 'Mnufaika (si lazima)' : 'Who it is for (optional)'}</span>
            <input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={kicker}>{sw ? 'Maelezo' : 'The story'}</span>
            <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={4}
              placeholder={sw ? 'Eleza kwa kifupi kinachohitajika na kwa nini.' : 'Briefly: what is needed, and why.'}
              className={`${field} resize-y`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={kicker}>{sw ? 'Lengo (TZS)' : 'Target (TZS)'}</span>
              <input value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`${field} font-mono`} />
            </label>
            <label className="block">
              <span className={kicker}>{sw ? 'Mwisho' : 'Deadline'}</span>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={field} />
            </label>
          </div>
          {groups.length > 0 && (
            <label className="block">
              <span className={kicker}>{sw ? 'Pesa ziende kwa' : 'Money goes to'}</span>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={field}>
                <option value="">{sw ? 'Pochi yangu' : 'My wallet'}</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-gold py-3 text-sm font-bold text-ink disabled:opacity-40">
            {busy ? (sw ? 'Inaanzisha…' : 'Creating…') : (sw ? 'Anzisha' : 'Create')}
          </button>
        </form>
      )}

      {rows === null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{sw ? 'Inapakia…' : 'Loading…'}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {sw ? 'Bado hujaanzisha mchango wowote.' : 'You have not started a collection yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((h) => {
            const raised = Number(h.raised_tzs);
            const goal = h.target_tzs ? Number(h.target_tzs) : null;
            const pct = goal ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
            return (
              <div key={h.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-deep">
                      {(KIND_LABEL[h.kind] ?? KIND_LABEL.other)[sw ? 0 : 1]}
                      {h.group_name ? ` · ${h.group_name}` : ''}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{h.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{h.code} · {h.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold tabular-nums text-foreground">{tsh(raised)}</p>
                    {goal && <p className="text-[10px] text-muted-foreground">{sw ? 'lengo' : 'of'} {tsh(goal)} · {pct}%</p>}
                  </div>
                </div>

                {goal && (
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
                    <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => shareLink(h.code)} className="rounded-lg bg-foreground px-3 py-2 text-[11px] font-semibold text-background">
                    {copied === h.code ? (sw ? 'Imenakiliwa ✓' : 'Copied ✓') : (sw ? 'Sambaza kiungo' : 'Share link')}
                  </button>
                  <a href={`/harambee/${h.code}`} target="_blank" rel="noreferrer"
                    className="rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                    {sw ? 'Ona ukurasa' : 'View page'}
                  </a>
                  <button onClick={() => (openId === h.id ? setOpenId(null) : openDetail(h.id))}
                    className="rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                    {h.contributors} {sw ? 'wamechangia' : 'given'}
                  </button>
                  <button onClick={() => setStatus(h.id, h.status === 'open' ? 'closed' : 'open')}
                    className="rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                    {h.status === 'open' ? (sw ? 'Funga' : 'Close') : (sw ? 'Fungua' : 'Reopen')}
                  </button>
                </div>

                {openId === h.id && (
                  <div className="mt-4 border-t border-border pt-3">
                    {!detail ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">{sw ? 'Inapakia…' : 'Loading…'}</p>
                    ) : detail.contributions.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">{sw ? 'Bado hakuna mchango.' : 'No contributions yet.'}</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {detail.contributions.map((c) => (
                          <li key={c.id} className="flex items-start justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-foreground">
                                {c.contributor_name}
                                {c.anonymous && <span className="ml-1.5 text-[10px] text-muted-foreground">({sw ? 'hadharani: asiyetajwa' : 'public: anonymous'})</span>}
                              </p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {c.phone || c.method} · {new Date(c.created_at).toLocaleDateString()}
                              </p>
                              {c.message && <p className="mt-0.5 text-[11px] text-muted-foreground">{c.message}</p>}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[13px] font-semibold tabular-nums text-foreground">{tsh(c.amount_tzs)}</p>
                              <p className={`text-[10px] ${c.status === 'settled' ? 'text-emerald-500' : c.status === 'failed' ? 'text-destructive' : 'text-gold-deep'}`}>
                                {c.status}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
