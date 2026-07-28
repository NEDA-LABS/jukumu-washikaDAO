'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

const SNIPPETS: { id: string; label: string; code: string }[] = [
  {
    id: 'groups',
    label: 'List groups',
    code: `curl -H "Authorization: Bearer $WD_KEY" \\
  "https://washikadau.com/api/v1/groups?status=active"

{
  "data": [{
    "id": 32,
    "name": "THE BOYS FC",
    "code": "JKM-ZK79KQ",
    "contribution": { "amount_tzs": 10000, "frequency": "weekly" },
    "member_count": 1,
    "treasury_balance_tzs": 0
  }],
  "meta": { "total": 23, "limit": 25, "has_more": false }
}`,
  },
  {
    id: 'paid',
    label: 'Who paid',
    code: `curl -H "Authorization: Bearer $WD_KEY" \\
  ".../api/v1/groups/30/contributions?period=2026-07&include_unpaid=true"

{
  "meta": {
    "summary": { "paid_tzs": 240000, "paid_count": 12, "unpaid_count": 3 },
    "unpaid_members": [
      { "id": 127, "full_name": "Fefe Republic" }
    ]
  }
}`,
  },
  {
    id: 'wallet',
    label: 'Wallet',
    code: `curl -H "Authorization: Bearer $WD_KEY" \\
  "https://washikadau.com/api/v1/wallets/group/30"

{
  "data": {
    "owner_name": "Ali & Vic Admi",
    "balance_tzs": 5000,
    "last_30_days": {
      "money_in_tzs": 0,
      "money_out_tzs": 6000,
      "transaction_count": 1
    }
  }
}`,
  },
];

export default function DevelopersSection() {
  const { t } = useLanguage();
  const [active, setActive] = useState(SNIPPETS[0].id);
  const snippet = SNIPPETS.find((s) => s.id === active) ?? SNIPPETS[0];

  const capabilities = [
    { icon: '◉', title: t('dev.cap.groups'), body: t('dev.cap.groups.body') },
    { icon: '✓', title: t('dev.cap.paid'), body: t('dev.cap.paid.body') },
    { icon: '⇄', title: t('dev.cap.money'), body: t('dev.cap.money.body') },
    { icon: '✎', title: t('dev.cap.gov'), body: t('dev.cap.gov.body') },
  ];

  return (
    <section id="developers" className="relative overflow-hidden bg-background py-24 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute -right-40 top-1/4 h-96 w-96 rounded-full bg-[#e4a233]/10 blur-[120px]" />

      <div className="wd-container relative">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Copy */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t('dev.badge')}
            </span>

            <h2 className="mt-5 font-display text-3xl sm:text-4xl lg:text-5xl leading-tight text-foreground">
              {t('dev.title')} <span className="text-gold">API</span>
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              {t('dev.subtitle')}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {capabilities.map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-gold/40"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                    {c.icon}
                  </span>
                  <p className="mt-2.5 text-sm font-semibold text-foreground">{c.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/developers"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5"
              >
                {t('dev.cta.docs')}
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href="/developers/dashboard"
                className="inline-flex items-center rounded-full border border-border bg-card/70 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur-sm transition-all hover:-translate-y-0.5"
              >
                {t('dev.cta.key')}
              </Link>
            </div>
          </div>

          {/* Terminal */}
          <div className="rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">washikadau · api v1</span>
            </div>

            <div className="flex gap-1 border-b border-border px-3 pt-3">
              {SNIPPETS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    active === s.id
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed">
              <code className="font-mono text-foreground/90">{snippet.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
