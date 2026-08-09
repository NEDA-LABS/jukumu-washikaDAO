'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * One-time username claim for members who registered before usernames existed.
 *
 * Shown once per member, on sign-in. It is skippable on purpose: a username is
 * a convenience for being paid by name, not a requirement to use your own
 * money, and a hard gate on the way into the app would be the wrong trade. The
 * "later" choice is remembered locally so it does not become a nag; Settings
 * carries the same field for anyone who dismisses it.
 */

const STORAGE_KEY = 'wd-username-prompt-dismissed';

export default function ClaimUsernameModal({
  onClose, onClaimed,
}: {
  onClose: () => void;
  onClaimed: (username: string) => void;
}) {
  const { t } = useLanguage();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Availability check, debounced so a keystroke is not a request.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!value) { setStatus('idle'); return; }
    if (!/^[a-z0-9_]{3,30}$/.test(value)) { setStatus('invalid'); return; }
    setStatus('checking');
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/member/username?check=${encodeURIComponent(value)}`);
        const d = await res.json().catch(() => ({}));
        setStatus(d?.available ? 'available' : 'taken');
      } catch {
        setStatus('idle');
      }
    }, 400);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [value]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* private mode */ }
    onClose();
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/member/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: value }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || t('user.claim.failed')); return; }
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* private mode */ }
      onClaimed(d.username || value);
    } catch {
      setError(t('user.claim.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-username-title"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div className="w-full max-w-sm border-2 border-rule bg-card p-6">
        <span className="wd-kicker wd-kicker-gold">{t('user.claim.kicker')}</span>
        <h2 id="claim-username-title" className="mt-2 font-display text-[20px] font-bold leading-tight">
          {t('user.claim.title')}
        </h2>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t('user.claim.body')}</p>

        <label className="mt-4 block">
          <span className="wd-kicker">{t('set.field.username')}</span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30))}
            placeholder="juma_ally"
            className="mt-1.5 w-full border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-foreground"
          />
        </label>

        <p className="mt-1.5 min-h-[16px] text-[11px] leading-none" aria-live="polite">
          {status === 'checking' && <span className="text-muted-foreground">{t('user.claim.checking')}</span>}
          {status === 'available' && <span className="text-success">{t('user.claim.available')}</span>}
          {status === 'taken' && <span className="text-destructive">{t('user.claim.taken')}</span>}
          {status === 'invalid' && <span className="text-destructive">{t('user.claim.invalid')}</span>}
          {error && <span className="text-destructive">{error}</span>}
        </p>

        <button
          onClick={save}
          disabled={saving || status !== 'available'}
          className="wd-press mt-3 w-full bg-gold py-3 text-[13px] font-semibold text-[#1a1714] disabled:opacity-40"
        >
          {saving ? t('user.claim.saving') : t('user.claim.save')}
        </button>
        <button
          onClick={dismiss}
          className="mt-2 w-full border border-border py-2.5 text-[12px] text-muted-foreground"
        >
          {t('user.claim.later')}
        </button>
      </div>
    </div>
  );
}

/** Whether this member should be offered the one-time prompt. */
export function shouldPromptForUsername(currentUsername: string | null | undefined): boolean {
  if (currentUsername) return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    // Private mode or storage disabled: skip rather than prompt on every load.
    return false;
  }
}
