'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * A collection, as the people asked to give see it.
 *
 * The order is deliberate: what it is for, how far along it is, then the form,
 * then who has already given. Someone arriving from a forwarded link is
 * deciding whether this is real before deciding whether to pay, and the names
 * of neighbours who have already contributed answer that better than any
 * amount of reassuring copy.
 */

const KIND_LABEL: Record<string, [string, string]> = {
  wedding:   ['Harusi', 'Wedding'],
  funeral:   ['Msiba', 'Funeral'],
  medical:   ['Matibabu', 'Medical'],
  education: ['Elimu', 'Education'],
  emergency: ['Dharura', 'Emergency'],
  community: ['Jamii', 'Community'],
  other:     ['Mchango', 'Collection'],
};

type Contribution = { name: string | null; amountTzs: number; message: string | null; anonymous: boolean; at: string };
type Data = {
  harambee: {
    code: string; title: string; kind: string; story: string | null; beneficiary: string | null;
    targetTzs: number | null; deadline: string | null; status: string;
    groupName: string | null; organiserName: string | null; hasCover?: boolean;
  };
  totals: { raisedTzs: number; contributors: number; pendingTzs: number };
  emailEnabled?: boolean;
  contributions: Contribution[];
};

const tsh = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`;
const PRESETS = [2000, 5000, 20000, 50000];

export default function HarambeeView({ code, initial }: { code: string; initial: Data }) {
  const { language } = useLanguage();
  const sw = language === 'sw';
  const [data, setData] = useState<Data>(initial);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('5000');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<'mobile' | 'bank'>('mobile');
  const [payerAccount, setPayerAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<'form' | 'waiting' | 'bank' | 'done' | 'failed'>('form');
  const [reference, setReference] = useState('');
  const [bank, setBank] = useState<{ institution: string; accountNumber: string; accountName: string; reference: string; note?: string } | null>(null);

  const h = data.harambee;
  const pct = h.targetTzs ? Math.min(100, Math.round((data.totals.raisedTzs / h.targetTzs) * 100)) : 0;
  const shareUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/harambee/${code}` : `https://washikadau.com/harambee/${code}`),
    [code]
  );

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/harambee/${encodeURIComponent(code)}`);
      if (res.ok) setData(await res.json());
    } catch { /* keep what is on screen */ }
  }, [code]);

  // Poll only while a payment is actually in flight.
  useEffect(() => {
    if (stage !== 'waiting' || !reference) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!alive) return;
      try {
        const res = await fetch(`/api/public/harambee/${encodeURIComponent(code)}/status?reference=${encodeURIComponent(reference)}`);
        const d = await res.json().catch(() => null);
        if (!alive) return;
        if (d?.settled) { setStage('done'); reload(); return; }
        if (d?.failed) { setStage('failed'); return; }
      } catch { /* a blip is not a failure */ }
      if (alive) timer = setTimeout(tick, 3000);
    };
    timer = setTimeout(tick, 2500);
    return () => { alive = false; clearTimeout(timer); };
  }, [stage, reference, code, reload]);

  const share = async () => {
    const text = sw ? `Naomba tuchangie: ${h.title}` : `Please help with: ${h.title}`;
    if (navigator.share) {
      try { await navigator.share({ title: h.title, text, url: shareUrl }); return; } catch { /* fell back below */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* the link is on screen to select */ }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) { setError(sw ? 'Andika jina lako' : 'Enter your name'); return; }
    const amt = Number(amount);
    if (!amt || amt < 500) { setError(sw ? 'Kiasi cha chini ni TSh 500' : 'The smallest amount is TSh 500'); return; }
    if (method === 'bank' && !/^[0-9]{6,24}$/.test(payerAccount.replace(/\s+/g, ''))) {
      setError(sw ? 'Weka namba ya akaunti utakayotumia' : 'Enter the account you will send from'); return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError(sw ? 'Barua pepe si sahihi' : 'That email address is not valid'); return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/public/harambee/${encodeURIComponent(code)}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), phone, amountTzs: amt, method, anonymous,
          email: email.trim() || undefined,
          message: message.trim() || undefined,
          payerAccountNumber: method === 'bank' ? payerAccount.trim() : undefined,
          lang: sw ? 'sw' : 'en',
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setError(d?.error || (sw ? 'Imeshindikana' : 'That did not work')); return; }
      setReference(d.reference);
      if (d.bank) { setBank(d.bank); setStage('bank'); } else { setStage('waiting'); }
    } catch {
      setError(sw ? 'Tatizo la mtandao' : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  const field = 'mt-1.5 w-full border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-foreground';
  const label = 'wd-kicker';
  const closed = h.status !== 'open';

  return (
    <div>
      <span className="wd-kicker wd-kicker-gold">
        {(KIND_LABEL[h.kind] ?? KIND_LABEL.other)[sw ? 0 : 1]}
        {h.groupName ? ` · ${h.groupName}` : ''}
      </span>
      <h1 className="mt-3 font-display text-[clamp(26px,5vw,44px)] font-bold leading-[1.08] tracking-[-0.02em]">
        {h.title}
      </h1>

      {/* eslint-disable-next-line @next/next/no-img-element -- served as raw
          bytes from our own route; the optimiser adds nothing here. */}
      {h.hasCover && (
        <img
          src={`/api/public/harambee/${encodeURIComponent(code)}/cover`}
          alt=""
          className="mt-5 w-full border border-border object-cover"
          style={{ maxHeight: 320 }}
        />
      )}
      {h.beneficiary && (
        <p className="mt-2 text-sm text-muted-foreground">
          {sw ? 'Kwa ajili ya' : 'For'} <span className="font-semibold text-foreground">{h.beneficiary}</span>
        </p>
      )}

      <div className="mt-7 border-2 border-rule p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="wd-figure text-[clamp(28px,5vw,40px)] leading-none">{tsh(data.totals.raisedTzs)}</p>
          {h.targetTzs && (
            <p className="font-mono text-[11px] text-muted-foreground">
              {sw ? 'lengo' : 'of'} {tsh(h.targetTzs)} · {pct}%
            </p>
          )}
        </div>
        {h.targetTzs && (
          <div className="mt-3 h-2.5 w-full overflow-hidden bg-foreground/10">
            <div className="h-full bg-gold transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        )}
        <p className="mt-3 text-[12px] text-muted-foreground">
          {data.totals.contributors} {sw ? 'wamechangia' : data.totals.contributors === 1 ? 'person has given' : 'people have given'}
          {data.totals.pendingTzs > 0 && (
            <> · {tsh(data.totals.pendingTzs)} {sw ? 'inasubiri' : 'on the way'}</>
          )}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => { setStage('form'); setOpen(true); }}
            disabled={closed}
            className="wl-cta bg-foreground px-6 py-[15px] text-[13px] font-semibold text-background disabled:opacity-40"
          >
            {closed ? (sw ? 'Imefungwa' : 'Closed') : (sw ? 'Changia sasa' : 'Contribute')}
          </button>
          <button onClick={share} className="wd-press border-2 border-foreground px-5 py-3 text-[13px] font-semibold">
            {copied ? (sw ? 'Imenakiliwa ✓' : 'Copied ✓') : (sw ? 'Sambaza' : 'Share')}
          </button>
        </div>
      </div>

      {h.story && (
        <div className="mt-8">
          <span className={label}>{sw ? 'Kuhusu' : 'About'}</span>
          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.7] text-muted-foreground">{h.story}</p>
        </div>
      )}

      <div className="mt-8">
        <span className={label}>{sw ? 'Waliochangia' : 'Who has given'}</span>
        {data.contributions.length === 0 ? (
          <p className="mt-3 border border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
            {sw ? 'Bado hakuna mchango. Kuwa wa kwanza.' : 'No contributions yet. Be the first.'}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {data.contributions.map((c, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-foreground">
                    {c.anonymous ? (sw ? 'Asiyetajwa' : 'Anonymous') : c.name}
                  </p>
                  {c.message && <p className="mt-0.5 text-[12px] text-muted-foreground">{c.message}</p>}
                </div>
                <p className="shrink-0 wd-figure text-[15px] text-gold-deep">{tsh(c.amountTzs)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-8 border-t border-border pt-4 text-[11px] leading-relaxed text-ink-3">
        {sw
          ? `Mchango unakwenda moja kwa moja kwa ${h.groupName || h.organiserName || 'mwandaaji'} kupitia WashikaDAU. Hakuna akaunti inayohitajika kuchangia.`
          : `Money goes to ${h.groupName || h.organiserName || 'the organiser'} through WashikaDAU. No account is needed to give.`}
      </p>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog" aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget && stage !== 'waiting') setOpen(false); }}
        >
          <div className="flex max-h-[92dvh] w-full max-w-md flex-col border-2 border-rule bg-card">
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div className="min-w-0">
                <span className="wd-kicker wd-kicker-gold">{sw ? 'Changia' : 'Contribute'}</span>
                <p className="mt-1 truncate font-display text-[17px] font-bold">{h.title}</p>
              </div>
              {stage !== 'waiting' && (
                <button onClick={() => setOpen(false)} aria-label="Close" className="ml-3 border border-border px-2.5 py-1 text-sm text-muted-foreground">×</button>
              )}
            </div>

            {stage === 'form' && (
              <form onSubmit={submit} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                <div className="grid grid-cols-2 gap-2">
                  {(['mobile', 'bank'] as const).map((m) => (
                    <button
                      key={m} type="button" onClick={() => { setMethod(m); setError(''); }}
                      className={`border-2 py-2.5 text-[13px] font-semibold ${method === m ? 'border-foreground bg-foreground/5' : 'border-border text-muted-foreground'}`}
                    >
                      {m === 'mobile' ? (sw ? 'Simu' : 'Mobile') : (sw ? 'Benki' : 'Bank')}
                    </button>
                  ))}
                </div>

                <label className="block">
                  <span className={label}>{sw ? 'Jina lako' : 'Your name'}</span>
                  <input value={name} onChange={(e) => { setName(e.target.value); setError(''); }} className={field} required />
                </label>

                {method === 'mobile' ? (
                  <label className="block">
                    <span className={label}>{sw ? 'Nambari ya simu' : 'Phone number'}</span>
                    <input value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }} placeholder="07xx xxx xxx" inputMode="tel" className={`${field} font-mono`} required />
                  </label>
                ) : (
                  <label className="block">
                    <span className={label}>{sw ? 'Akaunti utakayotumia' : 'Account you will send from'}</span>
                    <input value={payerAccount} onChange={(e) => { setPayerAccount(e.target.value); setError(''); }} placeholder="0150312345678" inputMode="numeric" className={`${field} font-mono`} required />
                  </label>
                )}

                <div>
                  <span className={label}>{sw ? 'Kiasi' : 'Amount'}</span>
                  <div className="mt-1.5 grid grid-cols-4 gap-2">
                    {PRESETS.map((p) => (
                      <button key={p} type="button" onClick={() => setAmount(String(p))}
                        className={`border py-2 text-[12px] font-semibold ${Number(amount) === p ? 'border-foreground bg-foreground/5' : 'border-border text-muted-foreground'}`}>
                        {p >= 1000 ? `${p / 1000}K` : p}
                      </button>
                    ))}
                  </div>
                  <input value={amount} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '')); setError(''); }} inputMode="numeric" className={`${field} font-mono`} />
                </div>

                <label className="block">
                  <span className={label}>{sw ? 'Ujumbe (si lazima)' : 'Message (optional)'}</span>
                  <input value={message} onChange={(e) => setMessage(e.target.value)} className={field} maxLength={280} />
                </label>

                {data.emailEnabled && (
                  <label className="block">
                    <span className={label}>{sw ? 'Barua pepe (si lazima)' : 'Email (optional)'}</span>
                    <input type="email" value={email} autoComplete="email"
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      placeholder={sw ? 'jina@mfano.com' : 'you@example.com'} className={field} />
                    <span className="mt-1.5 block text-[10.5px] leading-snug text-muted-foreground">
                      {sw
                        ? 'Tutakutumia uthibitisho mchango wako utakapofika.'
                        : 'We will confirm by email once your contribution arrives.'}
                    </span>
                  </label>
                )}

                <label className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
                  <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-current" />
                  {sw ? 'Usionyeshe jina langu kwenye orodha' : 'Do not show my name on the list'}
                </label>

                {error && <p className="text-[12px] font-medium text-destructive">{error}</p>}

                <button type="submit" disabled={busy} className="wl-cta w-full bg-gold py-3.5 text-[14px] font-bold text-ink disabled:opacity-40">
                  {busy ? (sw ? 'Inatuma…' : 'Sending…') : (sw ? 'Changia' : 'Give')}
                </button>
                <p className="text-center text-[11px] text-muted-foreground">
                  {method === 'mobile'
                    ? (sw ? 'Utapokea ombi la malipo kwenye simu yako.' : 'You will get a payment request on your phone.')
                    : (sw ? 'Utapata maelezo ya benki baada ya hapa.' : 'Bank details come next.')}
                </p>
              </form>
            )}

            {stage === 'waiting' && (
              <div className="flex-1 px-6 py-12 text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                <p className="mt-5 font-display text-[17px] font-bold">{sw ? 'Inasubiri malipo' : 'Waiting for payment'}</p>
                <p className="mx-auto mt-2 max-w-[280px] text-[12px] leading-relaxed text-muted-foreground">
                  {sw ? 'Angalia simu yako na thibitisha.' : 'Check your phone and approve the payment.'}
                </p>
                <p className="mt-4 font-mono text-[10px] text-ink-3">{reference}</p>
              </div>
            )}

            {stage === 'bank' && bank && (
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {sw ? 'Tuma kiasi kwa maelezo haya. Kumbukumbu lazima ionekane.' : 'Transfer the amount using these details. The reference must appear in the payment description.'}
                </p>
                <div className="mt-4 divide-y divide-border border border-border">
                  {[
                    [sw ? 'Benki' : 'Bank', bank.institution],
                    [sw ? 'Jina la akaunti' : 'Account name', bank.accountName],
                    [sw ? 'Namba ya akaunti' : 'Account number', bank.accountNumber],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <span className="wd-kicker">{k}</span>
                      <span className="font-mono text-[13px] font-semibold">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-2 border-gold-deep/50 bg-gold/10 px-3.5 py-3">
                  <span className="wd-kicker">{sw ? 'Kumbukumbu' : 'Reference'}</span>
                  <p className="mt-1 font-mono text-[16px] font-bold">{bank.reference}</p>
                </div>
                {bank.note && <p className="mt-3 border-l-2 border-border pl-3 text-[10.5px] leading-relaxed text-muted-foreground">{bank.note}</p>}
                {email.trim() && (
                  <p className="mt-3 flex items-start gap-2 border border-gold-deep/40 bg-gold/10 px-3 py-2.5 text-[11px] leading-relaxed text-foreground">
                    <span aria-hidden className="mt-px font-mono text-gold-deep">✉</span>
                    <span>
                      {sw ? 'Tutakuthibitishia kwa ' : 'We will confirm to '}
                      <span className="break-all font-mono font-semibold">{email.trim()}</span>
                      {sw ? ' pesa zitakapofika.' : ' once the money arrives.'}
                    </span>
                  </p>
                )}
                <button onClick={() => { setOpen(false); reload(); }} className="wd-press mt-4 w-full border-2 border-foreground py-3 text-[13px] font-semibold">
                  {sw ? 'Nimemaliza' : 'Done'}
                </button>
              </div>
            )}

            {stage === 'done' && (
              <div className="flex-1 px-6 py-12 text-center">
                <p className="font-display text-[22px] font-bold">{sw ? 'Asante!' : 'Thank you!'}</p>
                <p className="mx-auto mt-2 max-w-[280px] text-[13px] leading-relaxed text-muted-foreground">
                  {sw ? 'Mchango wako umefika.' : 'Your contribution has arrived.'}
                </p>
                <button onClick={() => { setOpen(false); reload(); }} className="wd-press mt-6 border-2 border-foreground px-5 py-2.5 text-[12px] font-semibold">
                  {sw ? 'Funga' : 'Close'}
                </button>
              </div>
            )}

            {stage === 'failed' && (
              <div className="flex-1 px-6 py-12 text-center">
                <p className="font-display text-[19px] font-bold">{sw ? 'Malipo hayakukamilika' : 'The payment did not go through'}</p>
                <button onClick={() => setStage('form')} className="wd-press mt-5 border-2 border-foreground px-5 py-2.5 text-[12px] font-semibold">
                  {sw ? 'Jaribu tena' : 'Try again'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
