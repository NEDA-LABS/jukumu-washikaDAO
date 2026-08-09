'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import GroupScreen, { type GroupScreenData, type GroupMemberRow, type GroupSummary } from './GroupScreen';
import UkutaWall from '@/components/UkutaWall';

/**
 * The whole of a group, in one place.
 *
 * Everything a chama does used to live on a separate route with its own
 * sidebar and its own visual language — you opened a group in the app shell,
 * then tapped again to land somewhere that looked like a different product.
 * These are the same sections, rebuilt in the editorial grammar and hung off
 * one horizontal nav, so the tab bar never moves and there is a single way
 * back out.
 *
 * Each section fetches only when first opened. Most visits are somebody
 * checking whether people have paid, and that answer is already on Overview.
 */

export type GroupSection =
  | 'overview' | 'members' | 'requests' | 'leadership' | 'finances' | 'decisions' | 'settings';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Only the fields the group sections read off a proposal. */
interface ProposalRef {
  id: number; title: string; yes?: number; no?: number;
  amountTzs?: number; paymentStatus?: string | null; requiredYes?: number;
}

interface JoinRequest {
  id: number; member_id: number; message: string | null; status: string;
  created_at: string; full_name: string; phone: string | null;
  location: string | null; business_name: string | null;
}

interface LeaderRow {
  id: number; role: string; full_name: string; email: string | null;
  joined_date: string | null; status: string;
}

interface PaymentRow {
  reference?: string; amount_tzs?: string | number; status?: string;
  payment_type?: string; customer_name?: string; created_at?: string;
}

interface FeedItem {
  key: string; kind: string; date: string; status?: string;
  amount_tzs: number | null; title_sw: string; title_en: string; href: string | null;
}

interface PaymentsPayload {
  payments: PaymentRow[];
  summary: {
    total_collected: number; total_disbursed: number;
    this_month_collected: number; this_month_payers: number;
  };
  memberPayments: { member_id: number; full_name: string; phone: string | null; paid_this_month: boolean }[];
  isLeader: boolean;
}

/** Shared shell for a section: a heading rule, then rows. */
function Panel({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="animate-[wdIn_.2s_ease_both] px-5 pb-8">
      <div className="flex items-baseline justify-between pb-2 pt-4">
        <h2 className="font-display text-[15px] font-bold leading-tight">{title}</h2>
        {meta && <span className="font-mono text-[9px] font-medium text-ink-3">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="border border-border px-4 py-6 text-center text-[11px] text-muted-foreground">{text}</p>;
}

function Loading() {
  return (
    <div className="flex h-28 items-center justify-center">
      <div className="wd-round h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
    </div>
  );
}

export default function GroupDetail({
  data, groups, section, onSection, onSelectGroup, onInvite, onRemind, onMember, onProposal, onNewProposal,
}: {
  data: GroupScreenData & {
    openProposals?: ProposalRef[];
    closedProposals?: ProposalRef[];
  };
  groups: GroupSummary[];
  section: GroupSection;
  onSection: (s: GroupSection) => void;
  onSelectGroup?: (id: number) => void;
  onInvite: () => void;
  onRemind: () => void;
  onMember: (m: GroupMemberRow) => void;
  onProposal: (id: number) => void;
  onNewProposal: () => void;
}) {
  const { t, language: lang } = useLanguage();
  const groupId = data.group.id;

  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [leaders, setLeaders] = useState<LeaderRow[] | null>(null);
  const [finances, setFinances] = useState<PaymentsPayload | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Disbursement, leader-only and gated on a passed proposal.
  const [dProposal, setDProposal] = useState('');
  const [dName, setDName] = useState('');
  const [dPhone, setDPhone] = useState('');
  const [dAmount, setDAmount] = useState('');
  const [dProvider, setDProvider] = useState('airtel');
  const [dBusy, setDBusy] = useState(false);
  const [dMsg, setDMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Group settings, leader-only.
  const [sAmount, setSAmount] = useState('');
  const [sFreq, setSFreq] = useState<'monthly' | 'weekly'>('monthly');
  const [sPhone, setSPhone] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sBusy, setSBusy] = useState(false);
  const [sMsg, setSMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [sLoaded, setSLoaded] = useState(false);

  // Switching group invalidates every section's data.
  useEffect(() => { setRequests(null); setLeaders(null); setFinances(null); setFeed(null); }, [groupId]);

  const load = useCallback(async (s: GroupSection) => {
    try {
      if (s === 'requests' && requests === null) {
        const r = await fetch(`/api/member/groups/${groupId}/join-requests`);
        setRequests(r.ok ? ((await r.json()).requests ?? []) : []);
      }
      if (s === 'leadership' && leaders === null) {
        const r = await fetch(`/api/member/groups/${groupId}/leadership`);
        setLeaders(r.ok ? ((await r.json()).leadership ?? []) : []);
      }
      if (s === 'finances' && finances === null) {
        const r = await fetch(`/api/member/groups/${groupId}/payments`);
        setFinances(r.ok ? await r.json() : null);
      }
      if (s === 'overview' && feed === null) {
        const r = await fetch(`/api/member/groups/${groupId}/feed?limit=8`);
        setFeed(r.ok ? ((await r.json()).items ?? []) : []);
      }
    } catch {
      // Leave the section empty rather than blank the whole group.
      if (s === 'requests') setRequests([]);
      if (s === 'leadership') setLeaders([]);
      if (s === 'overview') setFeed([]);
    }
  }, [groupId, requests, leaders, finances, feed]);

  useEffect(() => { load(section); }, [section, load]);

  const decide = async (id: number, action: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/member/groups/${groupId}/join-requests`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, action }),
      });
      if (res.ok) {
        setRequests((prev) =>
          (prev ?? []).map((r) => (r.id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r))
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { id: GroupSection; label: string }[] = [
    { id: 'overview', label: t('grp.tab.overview') },
    { id: 'members', label: t('grp.members') },
    { id: 'requests', label: t('grp.tab.requests') },
    { id: 'leadership', label: t('grp.tab.leadership') },
    { id: 'finances', label: t('grp.tab.finances') },
    { id: 'decisions', label: t('grp.tab.decisions') },
  ];

  const pendingCount = (requests ?? []).filter((r) => r.status === 'pending').length;

  const payable = (data.openProposals ?? [])
    .concat(data.closedProposals ?? [])
    .filter((p) => (p.amountTzs ?? 0) > 0 && p.paymentStatus !== 'completed'
      && (p.yes ?? 0) >= (p.requiredYes ?? Number.MAX_SAFE_INTEGER));

  const disburse = async () => {
    if (!dProposal) { setDMsg({ text: t('grp.disburse.needProposal'), ok: false }); return; }
    const amt = Number(dAmount);
    if (!amt || amt <= 0 || !dPhone.trim() || !dName.trim()) {
      setDMsg({ text: t('prop.err.amountInvalid'), ok: false }); return;
    }
    setDBusy(true); setDMsg(null);
    try {
      const res = await fetch(`/api/member/groups/${groupId}/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: dPhone.trim(), recipientName: dName.trim(),
          provider: dProvider, amount: amt, proposalId: Number(dProposal),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setDMsg({ text: d?.error || t('prop.err.genericFailed'), ok: false }); return; }
      setDMsg({ text: `${fmt(amt)} TZS → ${dName.trim()}`, ok: true });
      setDProposal(''); setDName(''); setDPhone(''); setDAmount('');
      setFinances(null);
    } catch {
      setDMsg({ text: t('prop.err.genericFailed'), ok: false });
    } finally {
      setDBusy(false);
    }
  };

  const saveSettings = async () => {
    const amt = Number(sAmount);
    if (!amt || amt <= 0) { setSMsg({ text: t('prop.err.invalidAmount'), ok: false }); return; }
    setSBusy(true); setSMsg(null);
    try {
      const res = await fetch(`/api/member/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyContribution: amt, contributionFrequency: sFreq,
          contactPhone: sPhone, contactEmail: sEmail,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setSMsg({ text: d?.error || t('grp.settings.leadershipOnly'), ok: false }); return; }
      setSMsg({ text: t('grp.settings.saved'), ok: true });
    } catch {
      setSMsg({ text: t('grp.err.loadFailed'), ok: false });
    } finally {
      setSBusy(false);
    }
  };

  return (
    <div>
      {/* Section nav. Scrolls horizontally rather than wrapping, so the group
          heading below never shifts down as labels change length. */}
      <nav className="scrollbar-none flex gap-4 overflow-x-auto border-b border-border px-5">
        {tabs.map((tb) => {
          const active = tb.id === section;
          return (
            <button
              key={tb.id}
              onClick={() => onSection(tb.id)}
              aria-current={active ? 'page' : undefined}
              className={`wd-press relative flex-none whitespace-nowrap py-2.5 text-[11px] font-semibold leading-none ${
                active ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {tb.label}
              {tb.id === 'requests' && pendingCount > 0 && (
                <span className="ml-1.5 font-mono text-[8.5px] text-gold-deep">{pendingCount}</span>
              )}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" />}
            </button>
          );
        })}
        {/* Settings sits apart from the sections — it is a destination, not a
            view of the group. */}
        <button
          onClick={() => onSection('settings')}
          aria-label={t('grp.settings.title')}
          aria-current={section === 'settings' ? 'page' : undefined}
          className={`wd-press relative ml-auto flex-none py-2.5 pl-3 text-[13px] leading-none ${
            section === 'settings' ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          ⚙
          {section === 'settings' && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-foreground" />}
        </button>
      </nav>

      {section === 'overview' && (
        <>
          <GroupScreen
            data={data}
            groups={groups}
            onSelectGroup={onSelectGroup}
            onInvite={onInvite}
            onRemind={onRemind}
            onMember={onMember}
            showRoster={false}
          />

          {/* The wall answers "who has paid" faster than any table. It carries
              its own heading and period toggle, so it gets no second one. */}
          <section className="border-b border-border px-5 py-[18px]">
            <UkutaWall groupId={groupId} />
          </section>

          <section className="px-5 pb-2 pt-4">
            <h2 className="font-display text-[15px] font-bold leading-tight">{t('grp.recentActivity')}</h2>
          </section>
          <section className="px-5 pb-6">
            {feed === null ? <Loading />
              : feed.length === 0 ? <Empty text={t('grp.noActivity')} />
              : feed.map((f) => {
                const out = f.kind === 'disbursement' || f.kind === 'transfer_out';
                const amt = Number(f.amount_tzs || 0);
                return (
                  <button
                    key={f.key}
                    onClick={() => {
                      // Proposal rows carry an href ending in the id; open it
                      // in place rather than routing away.
                      const m = f.href && f.href.match(/proposals\/(\d+)/);
                      if (m) onProposal(Number(m[1]));
                    }}
                    className="flex w-full items-center gap-3 border-b border-border py-2.5 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-medium leading-tight">
                        {lang === 'sw' ? f.title_sw : f.title_en}
                      </span>
                      <span className="mt-0.5 block font-mono text-[8.5px] leading-none text-ink-3">
                        {new Date(f.date).toLocaleDateString()}
                      </span>
                    </span>
                    {amt > 0 && (
                      <span className={`flex-none wd-figure text-[13px] ${out ? 'text-destructive' : 'text-success'}`}>
                        {out ? '−' : '+'}{fmt(amt)}
                      </span>
                    )}
                  </button>
                );
              })}
          </section>

          {/* The roster closes the overview, as it did before. */}
          <GroupScreen
            data={data}
            groups={[]}
            onInvite={onInvite}
            onRemind={onRemind}
            onMember={onMember}
            showHeader={false}
          />
        </>
      )}

      {section === 'members' && (
        <Panel title={t('grp.members')} meta={`${data.total}${data.group.code ? ` · ${data.group.code}` : ''}`}>
          {data.members.map((m) => (
            <button
              key={m.id}
              onClick={() => onMember(m)}
              className="flex w-full items-center gap-3 border-b border-border py-[11px] text-left"
            >
              <span className="flex h-[30px] w-[30px] flex-none items-center justify-center border border-border text-[10px] font-semibold text-muted-foreground">
                {m.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold leading-tight">
                  {m.name}
                  {m.isMe && <span className="ml-1.5 font-mono text-[9px] font-normal text-gold-deep">({t('wall.you')})</span>}
                </span>
                <span className="mt-1 block text-[9.5px] leading-none text-ink-3">
                  {m.isLeader ? t('grp.role.leader') : t('grp.role.member')} · {m.streak} {t('home.months')}
                </span>
              </span>
              <span className="wd-brick h-4 w-4 flex-none" data-paid={m.paid ? (m.isMe ? 'me' : '1') : '0'} />
            </button>
          ))}
        </Panel>
      )}

      {section === 'requests' && (
        <Panel title={t('grp.tab.requests')} meta={pendingCount ? `${pendingCount} ${t('grp.req.pending')}` : undefined}>
          {requests === null ? <Loading />
            : requests.length === 0 ? <Empty text={t('grp.req.none')} />
            : requests.map((r) => (
              <div key={r.id} className="border-b border-border py-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-[30px] w-[30px] flex-none items-center justify-center border border-border text-[10px] font-semibold text-muted-foreground">
                    {r.full_name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold leading-tight">{r.full_name}</p>
                    <p className="mt-1 font-mono text-[9px] leading-none text-ink-3">
                      {[r.phone, r.location].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {r.message && <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">{r.message}</p>}
                  </div>
                  {r.status !== 'pending' && (
                    <span className={`flex-none font-mono text-[9px] ${r.status === 'approved' ? 'text-success' : 'text-destructive'}`}>
                      {r.status === 'approved' ? t('grp.req.approved') : t('grp.req.rejected')}
                    </span>
                  )}
                </div>
                {/* Only leadership decides, and only on what is still open. */}
                {r.status === 'pending' && data.isLeader && (
                  <div className="mt-2.5 flex gap-2 pl-[42px]">
                    <button
                      onClick={() => decide(r.id, 'approve')}
                      disabled={busyId === r.id}
                      className="wd-press flex-1 bg-foreground py-2 text-[10.5px] font-semibold text-background disabled:opacity-40"
                    >
                      {t('grp.req.approve')}
                    </button>
                    <button
                      onClick={() => decide(r.id, 'reject')}
                      disabled={busyId === r.id}
                      className="wd-press flex-1 border border-border py-2 text-[10.5px] font-semibold text-muted-foreground disabled:opacity-40"
                    >
                      {t('grp.req.reject')}
                    </button>
                  </div>
                )}
              </div>
            ))}
        </Panel>
      )}

      {section === 'leadership' && (
        <Panel title={t('grp.tab.leadership')}>
          {leaders === null ? <Loading />
            : leaders.length === 0 ? <Empty text={t('grp.lead.none')} />
            : leaders.map((l) => (
              <div key={l.id} className="flex items-center gap-3 border-b border-border py-[11px]">
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center border border-border text-[10px] font-semibold text-muted-foreground">
                  {l.full_name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold leading-tight">{l.full_name}</span>
                  <span className="mt-1 block truncate font-mono text-[9px] leading-none text-ink-3">{l.email || '—'}</span>
                </span>
                <span className="wd-kicker wd-kicker-gold flex-none">{l.role}</span>
              </div>
            ))}

        </Panel>
      )}

      {section === 'settings' && (
        <Panel title={t('grp.settings.title')}>
          {/* The contact details here are what the Contact Us button on the
              public pages actually reaches. */}
          {!data.isLeader ? <Empty text={t('grp.settings.leadershipOnly')} /> : (
            <div>

              <label className="block">
                <span className="wd-kicker">{t('grp.freq.contribAmount')}</span>
                <input
                  type="number" min="1" inputMode="numeric"
                  value={sAmount || (sLoaded ? '' : String(data.group.monthlyContribution || ''))}
                  onFocus={() => { if (!sLoaded) { setSAmount(String(data.group.monthlyContribution || '')); setSLoaded(true); } }}
                  onChange={(e) => { setSAmount(e.target.value); setSLoaded(true); setSMsg(null); }}
                  className="mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-foreground  font-mono"
                />
              </label>

              <div className="mt-3">
                <span className="wd-kicker">{t('grp.freq.label')}</span>
                <div className="mt-1.5 flex gap-2">
                  {(['monthly', 'weekly'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => { setSFreq(f); setSMsg(null); }}
                      aria-pressed={sFreq === f}
                      className={`wd-press flex-1 border px-3 py-2.5 text-[11px] font-semibold ${
                        sFreq === f ? 'border-foreground bg-gold-tint' : 'border-border text-muted-foreground'
                      }`}
                    >
                      {f === 'monthly' ? t('grp.freq.monthly') : t('grp.freq.weekly')}
                    </button>
                  ))}
                </div>
              </div>

              <p className="wd-kicker mt-4">{t('grp.contact.title')}</p>
              <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{t('grp.contact.hint')}</p>
              <label className="mt-2 block">
                <span className="wd-kicker">{t('grp.contact.phone')}</span>
                <input value={sPhone} onChange={(e) => { setSPhone(e.target.value); setSMsg(null); }} className="mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-foreground  font-mono" />
              </label>
              <label className="mt-3 block">
                <span className="wd-kicker">{t('grp.contact.email')}</span>
                <input type="email" value={sEmail} onChange={(e) => { setSEmail(e.target.value); setSMsg(null); }} className="mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-foreground " />
              </label>

              {sMsg && (
                <p className={`mt-2 text-[11px] ${sMsg.ok ? 'text-success' : 'text-destructive'}`}>{sMsg.text}</p>
              )}
              <button
                onClick={saveSettings}
                disabled={sBusy}
                className="wd-press mt-3 w-full bg-foreground py-2.5 text-[11.5px] font-semibold text-background disabled:opacity-40"
              >
                {sBusy ? t('grp.creating') : t('set.username.save')}
              </button>
            </div>
          )}
        </Panel>
      )}

      {section === 'finances' && (
        <Panel title={t('grp.tab.finances')}>
          {finances === null ? <Loading /> : (
            <>
              <div className="flex border border-border">
                <div className="flex-1 border-r border-border px-3 py-2.5">
                  <span className="wd-kicker">{t('grp.stat.collected')}</span>
                  <p className="mt-1.5 wd-figure text-[18px]">{fmt(finances.summary.total_collected)}</p>
                  <p className="mt-1.5 font-mono text-[8px] font-medium text-gold-deep">TZS</p>
                </div>
                <div className="flex-1 px-3 py-2.5">
                  <span className="wd-kicker">{t('grp.stat.disbursed')}</span>
                  <p className="mt-1.5 wd-figure text-[18px]">{fmt(finances.summary.total_disbursed)}</p>
                  <p className="mt-1.5 font-mono text-[8px] font-medium text-ink-3">TZS</p>
                </div>
              </div>

              <h3 className="pb-1.5 pt-5 font-display text-[13px] font-bold">{t('grp.fin.thisMonth')}</h3>
              {finances.memberPayments.map((mp) => (
                <div key={mp.member_id} className="flex items-center gap-3 border-b border-border py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">{mp.full_name}</span>
                  <span className="flex-none font-mono text-[9px] text-muted-foreground">
                    {mp.paid_this_month ? t('grp.paid') : t('grp.unpaid')}
                  </span>
                  <span className="wd-brick h-4 w-4 flex-none" data-paid={mp.paid_this_month ? '1' : '0'} />
                </div>
              ))}

              {finances.payments.length > 0 && (
                <>
                  <h3 className="pb-1.5 pt-5 font-display text-[13px] font-bold">{t('grp.fin.history')}</h3>
                  {finances.payments.slice(0, 20).map((p, i) => {
                    const out = p.payment_type === 'disbursement';
                    return (
                      <div key={p.reference || i} className="flex items-center gap-3 border-b border-border py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11.5px] font-medium">{p.customer_name || '—'}</span>
                          <span className="mt-0.5 block font-mono text-[8.5px] text-ink-3">{p.status}</span>
                        </span>
                        <span className={`flex-none wd-figure text-[13px] ${out ? 'text-destructive' : 'text-success'}`}>
                          {out ? '−' : '+'}{fmt(Number(p.amount_tzs || 0))}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Money only leaves on a passed vote — the picker offers exactly
                  the proposals the server would accept, and nothing else. */}
              {finances.isLeader && (
                <div className="mt-6 border-t-2 border-rule pt-4">
                  <h3 className="font-display text-[13px] font-bold">{t('grp.sendToMember')}</h3>
                  <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{t('grp.disburse.desc')}</p>

                  {payable.length === 0 ? (
                    <div className="mt-3 border border-border px-4 py-4">
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{t('grp.disburse.noneApproved')}</p>
                      <button
                        onClick={() => onSection('decisions')}
                        className="wd-press mt-3 border border-border px-3 py-2 text-[11px] font-semibold"
                      >
                        {t('grp.disburse.goToProposals')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <label className="mt-3 block">
                        <span className="wd-kicker">{t('grp.disburse.proposal')}</span>
                        <select
                          value={dProposal}
                          onChange={(e) => {
                            setDProposal(e.target.value); setDMsg(null);
                            const pr = payable.find((x) => String(x.id) === e.target.value);
                            if (pr?.amountTzs) setDAmount(String(pr.amountTzs));
                          }}
                          className="mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-foreground  [&>option]:bg-card [&>option]:text-foreground"
                        >
                          <option value="">{t('grp.disburse.selectProposal')}</option>
                          {payable.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.title} — {fmt(pr.amountTzs || 0)} ({pr.yes}/{pr.requiredYes})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block">
                        <span className="wd-kicker">{t('grp.recipientName')}</span>
                        <input value={dName} onChange={(e) => { setDName(e.target.value); setDMsg(null); }} className="mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-foreground " />
                      </label>
                      <label className="mt-3 block">
                        <span className="wd-kicker">{t('grp.phone')}</span>
                        <input value={dPhone} onChange={(e) => { setDPhone(e.target.value); setDMsg(null); }} placeholder="255712345678" className="mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-foreground  font-mono" />
                      </label>
                      <label className="mt-3 block">
                        <span className="wd-kicker">{t('prop.amount')}</span>
                        <input type="number" min="1" inputMode="numeric" value={dAmount} onChange={(e) => { setDAmount(e.target.value); setDMsg(null); }} className="mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-foreground  font-mono" />
                      </label>
                      <label className="mt-3 block">
                        <span className="wd-kicker">{t('grp.network')}</span>
                        <select value={dProvider} onChange={(e) => setDProvider(e.target.value)} className="mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-foreground  [&>option]:bg-card [&>option]:text-foreground">
                          <option value="airtel">Airtel Money</option>
                          <option value="mpesa">Vodacom M-Pesa</option>
                          <option value="tigopesa">Tigo Pesa</option>
                          <option value="halopesa">Halo Pesa</option>
                        </select>
                      </label>

                      {dMsg && <p className={`mt-2 text-[11px] ${dMsg.ok ? 'text-success' : 'text-destructive'}`}>{dMsg.text}</p>}
                      <button
                        onClick={disburse}
                        disabled={dBusy || !dProposal}
                        className="wd-press mt-3 w-full bg-foreground py-2.5 text-[11.5px] font-semibold text-background disabled:opacity-40"
                      >
                        {dBusy ? t('grp.sending') : t('grp.send')}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </Panel>
      )}

      {section === 'decisions' && (
        <Panel title={t('grp.tab.decisions')}>
          <button
            onClick={onNewProposal}
            className="wd-press mb-3 w-full border-2 border-foreground py-2.5 text-[11px] font-semibold"
          >
            {t('grp.newProposal')}
          </button>
          {(data.openProposals ?? []).length === 0 && (data.closedProposals ?? []).length === 0
            ? <Empty text={t('gov.none')} />
            : (
              <>
                {(data.openProposals ?? []).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onProposal(p.id)}
                    className="flex w-full items-center gap-3 border-b border-border py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold leading-tight">{p.title}</span>
                      <span className="mt-1 block font-mono text-[9px] leading-none text-gold-deep">{t('gov.open')}</span>
                    </span>
                    <span className="flex-none font-mono text-[9px] text-muted-foreground">
                      {p.yes ?? 0} / {(p.yes ?? 0) + (p.no ?? 0)}
                    </span>
                  </button>
                ))}
                {(data.closedProposals ?? []).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onProposal(p.id)}
                    className="flex w-full items-center gap-3 border-b border-border py-3 text-left opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold leading-tight">{p.title}</span>
                      <span className="mt-1 block font-mono text-[9px] leading-none text-ink-3">{t('gov.closed')}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
        </Panel>
      )}
    </div>
  );
}
