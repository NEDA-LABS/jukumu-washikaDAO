'use client';

import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Contribute, per the prototype.
 *
 * The amount is the screen: one 46px figure, preset chips for the amounts a
 * member actually sends, and only then the method. Entering money should feel
 * like writing a number down, not filling in a form.
 */

export type PayMethod = 'wallet' | 'momo';

const fmt = (n: number) => (n > 0 ? Math.round(n).toLocaleString('en-US') : '0');

export default function ContributeScreen({
  monthlyContribution, walletBalanceTzs, groupName, submitting, error,
  onSubmit,
}: {
  monthlyContribution: number;
  walletBalanceTzs: number;
  groupName: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (v: { amountTzs: number; method: PayMethod; phone: string }) => void;
}) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState<number>(monthlyContribution || 0);
  const [method, setMethod] = useState<PayMethod>('wallet');
  const [phone, setPhone] = useState('');

  // The dues amount first, then round multiples of it — a member is usually
  // paying this month, catching up, or paying ahead.
  const presets = useMemo(() => {
    const base = monthlyContribution > 0 ? monthlyContribution : 10000;
    return [base, base * 2, base * 3, base * 6];
  }, [monthlyContribution]);

  const short = method === 'wallet' && amount > walletBalanceTzs;
  const invalid = amount <= 0 || submitting || short || (method === 'momo' && phone.trim().length < 9);

  return (
    <div className="animate-[wdIn_.22s_ease_both]">
      <section className="border-b border-border px-5 pb-[18px] pt-[22px]">
        <span className="wd-kicker">{t('pay.amount')}</span>
        <div className="mt-2.5 flex items-end gap-2">
          <span className="wd-figure text-[46px]">{fmt(amount)}</span>
          <span className="pb-1.5 font-mono text-[10px] font-medium leading-none text-gold-deep">TZS</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {presets.map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className={`wd-press border px-3 py-2.5 font-mono text-[11px] font-medium leading-none ${
                amount === v ? 'border-foreground bg-gold-tint' : 'border-border text-muted-foreground'
              }`}
            >
              {fmt(v)}
            </button>
          ))}
        </div>

        {/* Labelled as a custom entry, not a second amount field: unlabelled,
            it echoed the big figure above and read as a duplicate. */}
        <label className="mt-4 block">
          <span className="wd-kicker">{t('pay.other')}</span>
          <input
            type="number"
            inputMode="numeric"
            value={amount || ''}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            placeholder="0"
            className="mt-1.5 w-full border-b border-border bg-transparent pb-1.5 font-mono text-sm text-muted-foreground outline-none focus:border-foreground focus:text-foreground"
          />
        </label>

        <p className="mt-3 text-[10px] leading-[1.4] text-muted-foreground">
          {groupName ? `${t('pay.toGroup')} ${groupName}` : t('pay.noGroup')}
        </p>
      </section>

      <section className="border-b border-border px-5 py-[18px]">
        <span className="wd-kicker">{t('pay.method')}</span>

        <div className="mt-3 flex border border-border">
          {(['wallet', 'momo'] as PayMethod[]).map((m, i) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`wd-press flex-1 px-3 py-2.5 text-[11px] font-semibold leading-none ${
                i === 0 ? 'border-r border-border' : ''
              } ${method === m ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
            >
              {m === 'wallet' ? t('pay.fromWallet') : t('pay.momo')}
            </button>
          ))}
        </div>

        {method === 'wallet' ? (
          <p className={`mt-3 font-mono text-[10px] ${short ? 'text-destructive' : 'text-muted-foreground'}`}>
            {t('pay.balance')}: {fmt(walletBalanceTzs)} nTZS
            {short && ` · ${t('pay.insufficient')}`}
          </p>
        ) : (
          <div className="mt-3.5">
            <div className="flex items-end gap-2.5 border-b-2 border-rule pb-2">
              <span className="font-mono text-base font-medium leading-none text-muted-foreground">+255</span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
                placeholder="712 345 678"
                aria-label={t('pay.momo')}
                className="min-w-0 flex-1 bg-transparent font-mono text-base font-medium leading-none text-foreground outline-none"
              />
            </div>
            <p className="mt-2.5 text-[9.5px] leading-[1.6] text-muted-foreground">{t('pay.momoNote')}</p>
          </div>
        )}
      </section>

      <section className="px-5 pb-8 pt-[18px]">
        {error && (
          <p className="mb-3 border border-destructive/40 bg-destructive/5 p-3 text-[11px] text-destructive">{error}</p>
        )}
        <button
          onClick={() => onSubmit({ amountTzs: amount, method, phone })}
          disabled={invalid}
          className="wd-press flex w-full items-center justify-between bg-gold px-3.5 py-4 text-[#1a1714] disabled:opacity-40"
        >
          <span className="text-[13px] font-semibold leading-none">
            {submitting ? t('pay.sending') : `${t('home.contribute')} — ${fmt(amount)}`}
          </span>
          <span className="font-mono text-xs font-medium leading-none">→</span>
        </button>
      </section>
    </div>
  );
}
