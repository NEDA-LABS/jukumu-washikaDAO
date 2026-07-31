'use client';

import React, { useState } from 'react';

export default function PartnerRegister({ onDone }: { onDone: () => void }) {
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [useCase, setUseCase] = useState('');
  const [wantsWrite, setWantsWrite] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const res = await fetch('/api/developer/partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name: orgName, contact_email: email, website,
          use_case: useCase, wants_write: wantsWrite,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not complete registration.'); return; }
      onDone();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';
  const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground';

  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Step 1 of 2
        </span>
        <h2 className="mt-4 font-display text-2xl text-foreground">Register as a partner</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          API keys are issued to organisations, not individual logins. Tell us who you are and what
          you&rsquo;re building — this is what every key on the platform is traced back to.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Organisation *</label>
              <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className={input} placeholder="Acme Fintech Ltd" required maxLength={160} />
            </div>
            <div>
              <label className={label}>Contact email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="dev@acme.co.tz" required maxLength={200} />
            </div>
          </div>

          <div>
            <label className={label}>Website</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className={input} placeholder="https://acme.co.tz" maxLength={300} />
          </div>

          <div>
            <label className={label}>What are you building? *</label>
            <textarea
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              className={`${input} resize-none`}
              rows={4}
              placeholder="e.g. A reporting tool that shows SACCO leaders who has paid their monthly contribution, pulling group rosters and the contribution ledger."
              required
              minLength={20}
              maxLength={2000}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {useCase.length < 20 ? `${20 - useCase.length} more characters needed` : `${useCase.length}/2000`}
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3.5">
            <input type="checkbox" checked={wantsWrite} onChange={(e) => setWantsWrite(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span>
              <span className="block text-sm font-medium text-foreground">I need write access</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                Write endpoints move real money — deposits, withdrawals and transfers. Requesting it
                flags your account for review; read-only keys work immediately in the meantime.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" required />
            <span className="text-xs leading-relaxed text-muted-foreground">
              I understand that API keys act on behalf of my organisation, that member and financial
              data must be handled lawfully, and that keys may be revoked for misuse.
            </span>
          </label>

          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !agreed}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
          >
            {busy ? 'Registering…' : 'Register and continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
