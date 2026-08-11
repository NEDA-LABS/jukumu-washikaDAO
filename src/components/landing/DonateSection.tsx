'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import TokenMark, { TOKENS, type TokenId } from '@/components/TokenMark';

/**
 * Support for the platform itself, on the public page.
 *
 * Kept deliberately small in ambition: a name, a number, an amount. No account,
 * no login, no card. The prompt lands on the donor's phone and the certificate
 * arrives when they approve it — not before, because a certificate for a
 * payment nobody made is worse than no certificate at all.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const PRESETS = [5000, 20000, 50000, 200000];

type Stage = 'form' | 'waiting' | 'review' | 'done' | 'failed';
type Method = 'mobile' | 'crypto';

export default function DonateSection() {
  const { t, language } = useLanguage();
  const sw = language === 'sw';

  const [totals, setTotals] = useState<{ totalTzs: number; supporters: number } | null>(null);
  const [treasury, setTreasury] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('form');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('20000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [waited, setWaited] = useState(0);
  const [copied, setCopied] = useState(false);

  // Mobile money or a token sent on chain — the two have different evidence,
  // so they ask for different things.
  const [method, setMethod] = useState<Method>('mobile');
  const [token, setToken] = useState<TokenId>('ntzs');
  const [txHash, setTxHash] = useState('');
  const [addrCopied, setAddrCopied] = useState(false);

  // Resolved after mount, not during render: reading window while rendering
  // makes the server and the first client render disagree.
  const [shareUrl, setShareUrl] = useState('https://washikadau.com/#changia');
  useEffect(() => { setShareUrl(`${window.location.origin}/#changia`); }, []);

  const loadTotals = useCallback(async () => {
    try {
      const res = await fetch('/api/public/donate');
      if (res.ok) {
        const d = await res.json();
        setTotals({ totalTzs: d.totalTzs, supporters: d.supporters });
        setTreasury(d.treasuryAddress ?? null);
      }
    } catch {
      // The section reads fine without a figure; better blank than invented.
    }
  }, []);

  useEffect(() => { loadTotals(); }, [loadTotals]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && stage !== 'waiting') setOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, stage]);

  // Poll until the donor approves the prompt on their handset.
  useEffect(() => {
    if (stage !== 'waiting' || !reference) return;
    let alive = true;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!alive) return;
      setWaited(Math.round((Date.now() - started) / 1000));
      try {
        const res = await fetch(`/api/public/donate/status?reference=${encodeURIComponent(reference)}`);
        const d = await res.json().catch(() => null);
        if (!alive) return;
        if (d?.settled) { setStage('done'); loadTotals(); return; }
        if (d?.failed) { setStage('failed'); return; }
      } catch {
        // Keep waiting — a network blip is not a failed payment.
      }
      if (alive) timer = setTimeout(tick, 3000);
    };

    timer = setTimeout(tick, 2500);
    return () => { alive = false; clearTimeout(timer); };
  }, [stage, reference, loadTotals]);

  const reset = () => {
    setStage('form'); setName(''); setPhone(''); setAmount('20000');
    setError(''); setReference(''); setWaited(0);
    setMethod('mobile'); setToken('ntzs'); setTxHash('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) { setError(sw ? 'Andika jina lako' : 'Enter your name'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError(sw ? 'Weka kiasi' : 'Enter an amount'); return; }
    if (method === 'mobile' && amt < 1000) {
      setError(sw ? 'Kiasi cha chini ni TSh 1,000' : 'Minimum is TSh 1,000'); return;
    }
    if (method === 'crypto' && !/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) {
      setError(sw ? 'Weka namba ya muamala (0x…)' : 'Enter the transaction hash (0x…)'); return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/public/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          method === 'crypto'
            ? { donorName: name.trim(), amountTzs: amt, method: 'crypto', token, txHash: txHash.trim() }
            : { donorName: name.trim(), phone, amountTzs: amt }
        ),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) { setError(d?.error || (sw ? 'Imeshindikana' : 'That did not work')); return; }
      setReference(d.reference);
      setWaited(0);
      // A crypto gift has nothing to poll — it waits on a person.
      setStage(d.pendingReview ? 'review' : 'waiting');
    } catch {
      setError(sw ? 'Tatizo la mtandao' : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is selectable on screen.
    }
  };

  const field = 'mt-1.5 w-full border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-foreground';

  return (
    <section id="changia" className="border-t-2 border-rule bg-card">
      <div className="mx-auto max-w-[1240px] px-[clamp(20px,4vw,44px)] py-[clamp(50px,7vw,104px)]">
        <div data-r className="grid gap-[clamp(28px,5vw,72px)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div>
            <span className="wd-kicker wd-kicker-gold">{sw ? 'Changia' : 'Support us'}</span>
            <h2 className="mt-3 font-display text-[clamp(30px,4.6vw,60px)] font-bold leading-[1.04] tracking-[-0.03em]">
              {sw ? 'Saidia vikundi' : 'Help chamas'}<br />
              <span className="italic">{sw ? 'kujenga vyao' : 'build what they own'}</span>
            </h2>
            <p className="mt-6 max-w-[46ch] text-[13.5px] leading-[1.65] text-muted-foreground">
              {sw
                ? 'WashikaDAU ni bure kwa vikundi. Michango husaidia mafunzo, msaada na gharama za mfumo — si faida ya mtu.'
                : 'WashikaDAU is free for the groups that use it. Donations cover training, support and the cost of running the platform — not anyone’s profit.'}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <button
                onClick={() => { reset(); setOpen(true); }}
                className="wl-cta bg-foreground px-6 py-[17px] text-[13px] font-semibold text-background"
              >
                {sw ? 'Changia sasa' : 'Donate now'}
              </button>
              <button
                onClick={copyShare}
                className="wd-press border-2 border-foreground px-6 py-4 text-[13px] font-semibold"
              >
                {copied ? (sw ? 'Imenakiliwa ✓' : 'Copied ✓') : (sw ? 'Nakili kiungo' : 'Copy share link')}
              </button>
            </div>

            <p className="mt-4 break-all font-mono text-[10.5px] text-ink-3">{shareUrl}</p>
          </div>

          {/* Raised so far. Real figures only — nothing is invented when the
              request fails, because a made-up total on a donation page is a
              lie about other people's generosity. */}
          <div className="self-start border-2 border-rule">
            <div className="border-b border-border px-6 py-6">
              <span className="wd-kicker">{sw ? 'Imechangwa hadi sasa' : 'Raised so far'}</span>
              <p className="mt-2.5 wd-figure text-[clamp(36px,6vw,60px)] leading-none">
                {totals ? fmt(totals.totalTzs) : '—'}
              </p>
              <p className="mt-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-gold-deep">TZS</p>
            </div>
            <div className="flex">
              <div className="flex-1 border-r border-border px-6 py-5">
                <span className="wd-kicker">{sw ? 'Wafadhili' : 'Supporters'}</span>
                <p className="mt-2 wd-figure text-[26px] leading-none">{totals ? totals.supporters : '—'}</p>
              </div>
              <div className="flex-1 px-6 py-5">
                <span className="wd-kicker">{sw ? 'Cheti' : 'Certificate'}</span>
                <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
                  {sw ? 'Kwa kila mchango' : 'For every gift'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="donate-title"
          onClick={(e) => { if (e.target === e.currentTarget && stage !== 'waiting') setOpen(false); }}
        >
          <div
            className="flex w-full max-w-md flex-col border-2 border-rule bg-card"
            style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 1rem)' }}
          >
            <div className="flex flex-none items-start justify-between border-b border-border px-5 py-4">
              <div className="min-w-0">
                <span className="wd-kicker wd-kicker-gold">
                  {method === 'crypto'
                    ? (sw ? 'Kwa sarafu' : 'Stablecoin')
                    : (sw ? 'Kwa simu' : 'Mobile money')}
                </span>
                <h3 id="donate-title" className="mt-1 font-display text-[19px] font-bold leading-tight">
                  {stage === 'done'
                    ? (sw ? 'Asante!' : 'Thank you!')
                    : (sw ? 'Changia WashikaDAU' : 'Support WashikaDAU')}
                </h3>
              </div>
              {stage !== 'waiting' && (
                <button
                  onClick={() => setOpen(false)}
                  aria-label={sw ? 'Funga' : 'Close'}
                  className="wd-press ml-3 flex-none border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {stage === 'form' && (
              <form onSubmit={submit} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {/* How the gift arrives. It changes what we can ask for as
                    proof, so it comes before everything else. */}
                <div className="grid grid-cols-2 gap-2">
                  {([['mobile', sw ? 'Kwa simu' : 'Mobile money'], ['crypto', sw ? 'Kwa sarafu' : 'Stablecoin']] as const).map(([m, lbl]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setMethod(m); setError(''); }}
                      aria-pressed={method === m}
                      className={`wd-press border py-2.5 text-[11.5px] font-semibold ${
                        method === m ? 'border-foreground bg-gold-tint' : 'border-border text-muted-foreground'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <label className="block">
                  <span className="wd-kicker">{sw ? 'Jina lako au biashara' : 'Your name or business'}</span>
                  <input
                    autoFocus required value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }}
                    placeholder={sw ? 'Jina litakaloonekana kwenye cheti' : 'As it should appear on the certificate'}
                    className={field}
                  />
                </label>

                {method === 'mobile' ? (
                  <label className="block">
                    <span className="wd-kicker">{sw ? 'Nambari ya simu' : 'Phone number'}</span>
                    <input
                      required type="tel" value={phone}
                      onChange={(e) => { setPhone(e.target.value); setError(''); }}
                      placeholder="07xx xxx xxx"
                      className={`${field} font-mono`}
                    />
                  </label>
                ) : (
                  <>
                    <div>
                      <span className="wd-kicker">{sw ? 'Sarafu' : 'Token'}</span>
                      <div className="mt-1.5 grid grid-cols-3 gap-2">
                        {TOKENS.map((tk) => (
                          <button
                            key={tk.id}
                            type="button"
                            onClick={() => { setToken(tk.id); setError(''); }}
                            aria-pressed={token === tk.id}
                            className={`wd-press flex flex-col items-center gap-1.5 border px-2 py-3 ${
                              token === tk.id ? 'border-foreground bg-gold-tint' : 'border-border'
                            }`}
                          >
                            <TokenMark token={tk.id} size={26} />
                            <span className={`text-[11px] font-semibold leading-none ${
                              token === tk.id ? '' : 'text-muted-foreground'
                            }`}>{tk.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Where to send it. One address takes all three. */}
                    <div className="border border-border bg-background px-3.5 py-3">
                      <span className="wd-kicker">{sw ? 'Tuma kwenye anwani hii' : 'Send to this address'}</span>
                      <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-foreground">
                        {treasury || '…'}
                      </p>
                      {treasury && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(treasury);
                              setAddrCopied(true);
                              setTimeout(() => setAddrCopied(false), 2000);
                            } catch { /* selectable above */ }
                          }}
                          className="wd-press mt-2 border border-border px-3 py-1.5 text-[10px] font-semibold text-muted-foreground"
                        >
                          {addrCopied ? (sw ? 'Imenakiliwa ✓' : 'Copied ✓') : (sw ? 'Nakili anwani' : 'Copy address')}
                        </button>
                      )}
                    </div>

                    <label className="block">
                      <span className="wd-kicker">{sw ? 'Namba ya muamala' : 'Transaction hash'}</span>
                      <input
                        required value={txHash}
                        onChange={(e) => { setTxHash(e.target.value); setError(''); }}
                        placeholder="0x…"
                        className={`${field} font-mono`}
                      />
                      <span className="mt-1.5 block text-[10.5px] leading-snug text-muted-foreground">
                        {sw
                          ? 'Tuma sarafu kwanza, kisha weka namba ya muamala hapa.'
                          : 'Send the tokens first, then paste the hash your wallet shows.'}
                      </span>
                    </label>
                  </>
                )}

                <div>
                  <span className="wd-kicker">
                    {method === 'crypto'
                      ? `${sw ? 'Kiasi' : 'Amount'} (${TOKENS.find((x) => x.id === token)?.label})`
                      : (sw ? 'Kiasi' : 'Amount')}
                  </span>
                  {method === 'mobile' && (
                  <div className="mt-1.5 grid grid-cols-4 gap-2">
                    {PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => { setAmount(String(p)); setError(''); }}
                        aria-pressed={Number(amount) === p}
                        className={`wd-press border py-2.5 font-mono text-[11px] font-semibold ${
                          Number(amount) === p ? 'border-foreground bg-gold-tint' : 'border-border text-muted-foreground'
                        }`}
                      >
                        {p >= 1000 ? `${p / 1000}K` : p}
                      </button>
                    ))}
                  </div>
                  )}
                  <input
                    type="number" min={method === 'crypto' ? '0' : '1000'} step="any"
                    inputMode="decimal" value={amount}
                    onChange={(e) => { setAmount(e.target.value); setError(''); }}
                    className={`${field} font-mono`}
                  />
                </div>

                {error && <p className="text-[11.5px] leading-snug text-destructive" role="alert">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="wd-press w-full bg-gold py-3.5 text-[13px] font-semibold text-[#1a1714] disabled:opacity-40"
                >
                  {busy ? (sw ? 'Inatuma...' : 'Sending...') : (sw ? 'Changia' : 'Donate')}
                </button>
                <p className="text-center text-[10.5px] leading-snug text-muted-foreground">
                  {method === 'crypto'
                    ? (sw
                      ? 'Cheti kitakuwa tayari baada ya kuthibitisha muamala.'
                      : 'Your certificate is ready once we confirm the transfer arrived.')
                    : (sw ? 'Utapokea ombi la malipo kwenye simu yako.' : 'You will get a payment request on your phone.')}
                </p>
              </form>
            )}

            {stage === 'waiting' && (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
                <div className="wd-round h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                <p className="mt-5 font-display text-[17px] font-bold leading-tight">
                  {sw ? 'Inasubiri malipo' : 'Waiting for payment'}
                </p>
                <p className="mt-2 max-w-[280px] text-[12px] leading-relaxed text-muted-foreground">
                  {sw
                    ? 'Angalia simu yako na thibitisha. Cheti chako kitakuwa tayari mara baada ya malipo.'
                    : 'Check your phone and approve. Your certificate is ready the moment it goes through.'}
                </p>
                <p className="mt-5 wd-figure text-[24px]">{fmt(Number(amount) || 0)}</p>
                <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">{waited}s</p>
                {waited >= 45 && (
                  <button
                    onClick={() => setOpen(false)}
                    className="wd-press mt-6 border border-border px-4 py-2.5 text-[11px] font-semibold text-muted-foreground"
                  >
                    {sw ? 'Funga' : 'Close'}
                  </button>
                )}
              </div>
            )}

            {stage === 'review' && (
              <div className="flex-1 px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center border-2 border-gold">
                  <TokenMark token={token} size={26} />
                </div>
                <p className="mt-5 font-display text-[17px] font-bold leading-tight">
                  {sw ? 'Imepokelewa' : 'Recorded'}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  {sw
                    ? 'Tutathibitisha muamala kwenye pochi ya hazina. Cheti chako kitapatikana kwenye kiungo hiki.'
                    : 'We will confirm the transfer reached the treasury. Your certificate will appear at this link.'}
                </p>
                <a
                  href={`/shukrani/${encodeURIComponent(reference)}`}
                  className="wd-press mt-5 block w-full border-2 border-foreground py-3 text-[12px] font-semibold"
                >
                  {sw ? 'Ukurasa wa cheti' : 'Certificate page'}
                </a>
                <p className="mt-4 font-mono text-[10px] text-ink-3">{reference}</p>
              </div>
            )}

            {stage === 'done' && (
              <div className="flex-1 overflow-y-auto px-5 py-6 text-center">
                <p className="wd-figure text-[34px] leading-none">{fmt(Number(amount) || 0)}</p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-gold-deep">TZS</p>
                <p className="mt-5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {sw
                    ? 'Mchango wako umepokelewa. Pakua cheti chako cha shukrani.'
                    : 'Your gift has arrived. Download your certificate of support.'}
                </p>

                {/* A look at the certificate before saving it. */}
                <div className="mt-5 border border-border bg-background p-2">
                  <img
                    src={`/api/public/certificate/${encodeURIComponent(reference)}?inline=1`}
                    alt={sw ? 'Cheti cha shukrani' : 'Certificate of support'}
                    className="w-full"
                  />
                </div>

                <a
                  href={`/api/public/certificate/${encodeURIComponent(reference)}`}
                  download
                  className="wd-press mt-4 block w-full bg-gold py-3.5 text-[13px] font-semibold text-[#1a1714]"
                >
                  {sw ? 'Pakua cheti' : 'Download certificate'}
                </a>
                <a
                  href={`/shukrani/${encodeURIComponent(reference)}`}
                  className="mt-2.5 block text-[11.5px] font-semibold text-gold-deep underline underline-offset-4"
                >
                  {sw ? 'Ukurasa wa cheti' : 'Certificate page'}
                </a>
                <p className="mt-4 font-mono text-[10px] text-ink-3">{reference}</p>
              </div>
            )}

            {stage === 'failed' && (
              <div className="flex-1 px-5 py-10 text-center">
                <p className="font-display text-[17px] font-bold">{sw ? 'Malipo hayakukamilika' : 'The payment did not go through'}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  {sw ? 'Hakuna kilichokatwa. Unaweza kujaribu tena.' : 'Nothing was charged. You can try again.'}
                </p>
                <button
                  onClick={reset}
                  className="wd-press mt-6 w-full border-2 border-foreground py-3 text-[12px] font-semibold"
                >
                  {sw ? 'Jaribu tena' : 'Try again'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
