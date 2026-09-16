'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * What the platform actually does, in one place.
 *
 * The page had grown around the savings group and stopped there, so a visitor
 * could read the whole thing and never learn that money moves on real rails,
 * that anyone can be paid without an account, or that a collection can be
 * opened for one occasion. Each of those had been built; none of them were
 * said.
 *
 * Deliberately plain rows rather than illustrated cards. Every claim here is
 * something the product does today, and a claim that has to be decorated to
 * seem substantial usually is not.
 */
export default function CapabilitiesSection() {
  const { language } = useLanguage();
  const sw = language === 'sw';

  const items: { k: string; t: string; d: string }[] = sw ? [
    { k: 'Akiba ya kikundi', t: 'Ukuta unaoonekana',
      d: 'Kila mchango ni tofali. Kila mwanachama anaona nani amelipa na nani hajalipa, bila kuuliza.' },
    { k: 'Utawala', t: 'Pesa hazitoki bila kura',
      d: 'Matumizi yanapendekezwa, yanapigiwa kura, na ndipo yanalipwa. Hakuna mtu mmoja anayeamua peke yake.' },
    { k: 'Michango ya pamoja', t: 'Harambee kwa tukio moja',
      d: 'Harusi, msiba, matibabu. Fungua mchango, sambaza kiungo, na wachangiaji hawahitaji akaunti.' },
    { k: 'Pochi', t: 'Simu na benki',
      d: 'Weka na toa pesa kwa M-Pesa, Airtel, Tigo au benki. Salio ni nTZS — shilingi ya kidijitali.' },
    { k: 'Kwa wafadhili', t: 'Miradi inayoonekana',
      d: 'Vikundi vinawasilisha miradi, wafadhili wanaona kilichokusanywa na kilichobaki, senti kwa senti.' },
    { k: 'Mafunzo', t: 'Elimu ya fedha',
      d: 'Masomo mafupi kwa Kiswahili, ndani ya programu ile ile inayoshikilia pesa.' },
  ] : [
    { k: 'Group savings', t: 'A wall everyone can see',
      d: 'Every contribution is a brick. Each member sees who has paid and who has not, without having to ask.' },
    { k: 'Governance', t: 'No money leaves without a vote',
      d: 'Spending is proposed, voted on, and only then paid out. No one person decides alone.' },
    { k: 'Pooled collections', t: 'A harambee for one occasion',
      d: 'A wedding, a funeral, hospital bills. Open it, share the link — whoever gives needs no account.' },
    { k: 'Wallet', t: 'Mobile money and bank',
      d: 'Pay in and cash out through M-Pesa, Airtel, Tigo or a bank transfer. Balances are nTZS, the digital shilling.' },
    { k: 'For funders', t: 'Projects you can watch',
      d: 'Groups put up projects; funders see what has been raised and what is left, to the shilling.' },
    { k: 'Learning', t: 'Financial training',
      d: 'Short lessons in Swahili, inside the same app that holds the money.' },
  ];

  return (
    <section id="what-it-does" className="border-t border-rule py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-[52ch]">
          <span className="wd-kicker wd-kicker-gold">{sw ? 'Yote kwa pamoja' : 'All of it'}</span>
          <h2 className="mt-3 font-display text-[clamp(28px,4.4vw,52px)] font-bold leading-[1.06] tracking-[-0.03em]">
            {sw ? 'Si akiba tu.' : 'Not only savings.'}<br />
            <span className="italic">{sw ? 'Ni pesa za kikundi, zote.' : 'A group’s whole money life.'}</span>
          </h2>
        </div>

        <div className="mt-12 grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.k} className="bg-background p-6 sm:p-7">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-gold-deep">{it.k}</span>
              <h3 className="mt-3 font-display text-[18px] font-bold leading-tight">{it.t}</h3>
              <p className="mt-2.5 text-[12.5px] leading-[1.6] text-muted-foreground">{it.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
