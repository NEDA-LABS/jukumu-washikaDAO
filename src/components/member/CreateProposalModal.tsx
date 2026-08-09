'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { readAttachmentAsDataUrl, type AttachmentPayload } from '@/lib/imageResize';

/**
 * Putting something to the group, in the shell's own grammar.
 *
 * Four kinds of proposal, each asking for only what it needs: a plain motion
 * carries a title and a case; a request or a spend adds the amount being
 * voted on; a prodcast adds what investors are being asked to fund. The type
 * switcher is first because it changes the rest of the form.
 *
 * Everything can carry an attachment — a quote, a receipt, a photo of the
 * thing. That is often the whole argument.
 */

export type ProposalType = 'general' | 'ask' | 'spend' | 'prodcast';

export default function CreateProposalModal({
  groupId, groupName, onClose, onCreated,
}: {
  groupId: number;
  groupName: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useLanguage();
  const [type, setType] = useState<ProposalType>('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [file, setFile] = useState<AttachmentPayload | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const setM = (k: string, v: string) => setMeta((p) => ({ ...p, [k]: v }));

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setFileBusy(true); setError('');
    try {
      setFile(await readAttachmentAsDataUrl(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('prop.err.genericFailed'));
    } finally {
      setFileBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ttl = title.trim();
    const desc = description.trim();
    if (!ttl) { setError(t('prop.err.titleRequired')); return; }

    const payload: Record<string, unknown> = { title: ttl, description: desc, proposalType: type };

    if (type === 'ask' || type === 'spend') {
      const amt = Number(amount);
      if (!amt || amt <= 0) { setError(t('prop.err.amountInvalid')); return; }
      payload.paymentAmountTzs = amt;
      if (type === 'ask') {
        payload.metadata = { business_purpose: desc };
      } else {
        // A spend has to say who is being paid — the vote is meaningless
        // otherwise, and the disbursement later needs a destination.
        if (!phone.trim() && !meta.vendor_name) { setError(t('prop.err.phoneRequired')); return; }
        payload.recipientPhone = phone.trim() || null;
        payload.metadata = {
          vendor_name: meta.vendor_name || '',
          expense_category: meta.expense_category || '',
        };
      }
    } else if (type === 'prodcast') {
      const goal = Number(meta.funding_goal_tzs);
      if (!goal || goal <= 0) { setError(t('prop.err.goalInvalid')); return; }
      payload.metadata = {
        funding_goal_tzs: goal,
        project_description: meta.project_description || desc,
        timeline: meta.timeline || '',
        expected_impact: meta.expected_impact || '',
      };
    }

    if (file) {
      payload.metadata = { ...((payload.metadata as Record<string, unknown>) || {}), attachment: file };
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/member/groups/${groupId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.error || t('prop.err.createFailed')); return; }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('prop.err.genericFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const types: { id: ProposalType; label: string }[] = [
    { id: 'general', label: t('prop.type.general') },
    { id: 'ask', label: t('prop.type.ask') },
    { id: 'spend', label: t('prop.type.spend') },
    { id: 'prodcast', label: t('prop.type.prodcast') },
  ];

  const field = 'mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-ink-3 focus:border-foreground';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-proposal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex w-full max-w-md flex-col border-2 border-rule bg-card"
        style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 1rem)' }}
      >
        <div className="flex flex-none items-start justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <span className="wd-kicker wd-kicker-gold">{t('grp.newProposalTitle')}</span>
            <h2 id="new-proposal-title" className="mt-1 truncate font-display text-[17px] font-bold leading-tight">
              {groupName}
            </h2>
          </div>
          <button onClick={onClose} aria-label={t('img.remove')} className="wd-press ml-3 flex-none border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground">
            ✕
          </button>
        </div>

        {/* Type first: it decides which fields below exist. */}
        <div className="scrollbar-none flex flex-none gap-3 overflow-x-auto border-b border-border px-5">
          {types.map((ty) => {
            const active = ty.id === type;
            return (
              <button
                key={ty.id}
                type="button"
                onClick={() => { setType(ty.id); setError(''); }}
                aria-pressed={active}
                className={`wd-press relative flex-none whitespace-nowrap py-2.5 text-[11px] font-semibold leading-none ${
                  active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {ty.label}
                {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" />}
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="wd-kicker">{t('grp.propTitle')} *</span>
            <input
              autoFocus required value={title}
              onChange={(e) => { setTitle(e.target.value); setError(''); }}
              placeholder={t(`prop.title.ph.${type}`)}
              className={field}
            />
          </label>

          {(type === 'ask' || type === 'spend') && (
            <label className="block">
              <span className="wd-kicker">{t('prop.amount')} *</span>
              <input
                type="number" min="1" inputMode="numeric" value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(''); }}
                placeholder={t('prop.amount.ph')}
                className={`${field} font-mono`}
              />
            </label>
          )}

          {type === 'spend' && (
            <>
              <label className="block">
                <span className="wd-kicker">{t('grp.vendorName')}</span>
                <input value={meta.vendor_name || ''} onChange={(e) => setM('vendor_name', e.target.value)} placeholder={t('prop.vendorName.ph')} className={field} />
              </label>
              <label className="block">
                <span className="wd-kicker">{t('grp.recipientPhone')}</span>
                <input
                  value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }}
                  placeholder={t('prop.recipientPhone.ph')}
                  className={`${field} font-mono`}
                />
              </label>
              <label className="block">
                <span className="wd-kicker">{t('prop.expenseCategory')}</span>
                <input value={meta.expense_category || ''} onChange={(e) => setM('expense_category', e.target.value)} placeholder={t('prop.expenseCategory.ph')} className={field} />
              </label>
            </>
          )}

          {type === 'prodcast' && (
            <>
              <label className="block">
                <span className="wd-kicker">{t('prop.fundingGoal')} *</span>
                <input
                  type="number" min="1" inputMode="numeric"
                  value={meta.funding_goal_tzs || ''}
                  onChange={(e) => { setM('funding_goal_tzs', e.target.value); setError(''); }}
                  placeholder={t('prop.fundingGoal.ph')}
                  className={`${field} font-mono`}
                />
              </label>
              <label className="block">
                <span className="wd-kicker">{t('grp.projectDuration')}</span>
                <input value={meta.timeline || ''} onChange={(e) => setM('timeline', e.target.value)} placeholder={t('prop.timeline.ph')} className={field} />
              </label>
              <label className="block">
                <span className="wd-kicker">{t('prop.impact')}</span>
                <textarea
                  rows={3} value={meta.expected_impact || ''}
                  onChange={(e) => setM('expected_impact', e.target.value)}
                  placeholder={t('prop.impact.ph')}
                  className={`${field} resize-none`}
                />
              </label>
            </>
          )}

          <label className="block">
            <span className="wd-kicker">
              {t('prop.desc.label')} {type === 'general' && <span className="normal-case">{t('prop.desc.optional')}</span>}
            </span>
            <textarea
              rows={4} value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${field} resize-none`}
            />
          </label>

          {/* A quote or a receipt is usually the argument itself. */}
          <div>
            <span className="wd-kicker">{t('prop.attachment')}</span>
            <div className="mt-1.5 flex items-center gap-2">
              <label className="wd-press flex-1 cursor-pointer border border-border px-3 py-2.5 text-center text-[11px] font-semibold text-muted-foreground">
                {fileBusy ? t('prop.attachment.helper') : file ? file.name : t('prop.attachment.add')}
                <input
                  type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </label>
              {file && (
                <button type="button" onClick={() => setFile(null)} className="wd-press flex-none border border-border px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  ✕
                </button>
              )}
            </div>
          </div>

          {error && <p className="text-[11px] leading-snug text-destructive" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={submitting || fileBusy}
            className="wd-press w-full bg-gold py-3 text-[13px] font-semibold text-[#1a1714] disabled:opacity-40"
          >
            {submitting ? t('grp.creating') : t('grp.createProposal')}
          </button>
        </form>
      </div>
    </div>
  );
}
