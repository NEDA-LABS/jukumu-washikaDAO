'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Harambee, on the landing page.
 *
 * Placed as its own idea rather than a bullet under the savings product,
 * because it is the one thing here a visitor may already have done this month
 * — with a WhatsApp group and somebody's cousin holding the cash. The copy
 * names that, rather than explaining pooled funding to people who invented it.
 */
export default function LandingHarambeeSection() {
  const { language } = useLanguage();
  const sw = language === 'sw';

  /**
   * Four collections, cycling. One example makes the feature look like it is
   * for hospital bills; four make the point that it is for whatever the month
   * brings — which is the actual claim. Every figure is illustrative and the
   * card says so, because a made-up total presented as real would be the one
   * lie this page cannot afford.
   */
  const EXAMPLES = [
    {
      kind: sw ? 'Matibabu' : 'Medical',
      title: sw ? 'Matibabu ya Mama Neema' : 'Mama Neema’s treatment',
      raised: 1_840_000, target: 2_500_000, people: 37,
      givers: [['Asha R.', 50_000], ['Fatuma M.', 20_000], [sw ? 'Asiyetajwa' : 'Anonymous', 100_000]] as [string, number][],
    },
    {
      kind: sw ? 'Harusi' : 'Wedding',
      title: sw ? 'Harusi ya Neema na Juma' : 'Neema and Juma’s wedding',
      raised: 3_250_000, target: 4_000_000, people: 64,
      givers: [['Salma K.', 200_000], ['Baraka N.', 75_000], ['Grace M.', 50_000]] as [string, number][],
    },
    {
      kind: sw ? 'Msiba' : 'Funeral',
      title: sw ? 'Msiba wa Mzee Juma' : 'Mzee Juma’s funeral',
      raised: 920_000, target: 1_200_000, people: 48,
      givers: [[sw ? 'Asiyetajwa' : 'Anonymous', 150_000], ['Hamisi S.', 30_000], ['Rehema A.', 25_000]] as [string, number][],
    },
    {
      kind: sw ? 'Ada ya shule' : 'School fees',
      title: sw ? 'Ada ya Amina — kidato cha tano' : 'Amina’s school fees',
      raised: 610_000, target: 900_000, people: 22,
      givers: [['Neema P.', 100_000], ['Joseph M.', 40_000], ['Zainabu H.', 20_000]] as [string, number][],
    },
  ];

  const [i, setI] = useState(0);
  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((n) => (n + 1) % EXAMPLES.length), 4200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, EXAMPLES.length]);

  const ex = EXAMPLES[i];
  const pct = Math.round((ex.raised / ex.target) * 100);
  const tsh = (n: number) => `TSh ${n.toLocaleString('en-US')}`;

  const kinds = sw
    ? ['Harusi', 'Msiba', 'Matibabu', 'Ada ya shule', 'Dharura']
    : ['Wedding', 'Funeral', 'Medical', 'School fees', 'Emergency'];

  return (
    <section id="harambee" className="border-t border-rule py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="wd-kicker wd-kicker-gold">{sw ? 'Harambee' : 'Harambee'}</span>
            <h2 className="mt-3 font-display text-[clamp(28px,4.4vw,56px)] font-bold leading-[1.05] tracking-[-0.03em]">
              {sw ? 'Mnachanga tayari.' : 'You already do this.'}<br />
              <span className="italic">{sw ? 'Sasa kila mtu anaona.' : 'Now everyone can see it.'}</span>
            </h2>
            <p className="mt-6 max-w-[46ch] text-[13.5px] leading-[1.65] text-muted-foreground">
              {sw
                ? 'Msiba, harusi, bili ya hospitali — kundi la WhatsApp, mtu mmoja anashikilia pesa, na hakuna anayejua jumla imefika wapi. Fungua mchango hapa, sambaza kiungo, na kila mtu anaona kila senti inayoingia.'
                : 'A funeral, a wedding, a hospital bill — a WhatsApp group, one person holding the cash, and nobody quite sure what the total is. Open a collection here, share the link, and everyone sees every shilling as it lands.'}
            </p>
            <p className="mt-3 max-w-[46ch] text-[13.5px] leading-[1.65] text-muted-foreground">
              {sw
                ? 'Anayechangia hahitaji akaunti. Analipa kwa simu au benki, na jina lake linaonekana kwenye orodha papo hapo.'
                : 'Whoever gives needs no account. They pay by mobile money or bank, and their name appears on the list as soon as it clears.'}
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              {kinds.map((k) => (
                <span key={k} className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {k}
                </span>
              ))}
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/register" className="wl-cta bg-foreground px-6 py-[17px] text-[13px] font-semibold text-background">
                {sw ? 'Anzisha mchango' : 'Start a collection'}
              </Link>
            </div>
          </div>

          {/* A collection mid-flight, cycling through four. Fixed numbers and
              labelled as examples — a made-up total dressed as a real one
              would be the same lie the rest of this page refuses to tell. */}
          <div className="self-start border-2 border-rule">
            <div className="border-b border-border px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <span className="wd-kicker">{sw ? 'Mfano' : 'Example'}</span>
                <span className="flex gap-1.5" aria-hidden>
                  {EXAMPLES.map((_, n) => (
                    <button
                      key={n}
                      onClick={() => setI(n)}
                      aria-label={EXAMPLES[n].title}
                      className={`h-1.5 w-5 border transition-colors ${
                        n === i ? 'border-gold-deep bg-gold' : 'border-rule bg-transparent hover:border-gold-deep'
                      }`}
                    />
                  ))}
                </span>
              </div>
              <p key={`t-${i}`} className="mt-2 font-display text-[20px] font-bold leading-tight wd-brick-in">
                {ex.title}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-gold-deep">{ex.kind}</p>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-end justify-between gap-2">
                <p key={`a-${i}`} className="wd-figure text-[30px] leading-none wd-brick-in">{tsh(ex.raised)}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {sw ? 'lengo' : 'of'} {tsh(ex.target)} · {pct}%
                </p>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden bg-foreground/10">
                <div className="h-full bg-gold transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <ul key={`l-${i}`} className="mt-5 divide-y divide-border border-t border-border wd-brick-in">
                {ex.givers.map(([who, amt]) => (
                  <li key={who} className="flex items-center justify-between py-2.5">
                    <span className="text-[13px] text-foreground">{who}</span>
                    <span className="wd-figure text-[13px] text-gold-deep">{tsh(amt)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] leading-snug text-ink-3">
                {ex.people} {sw ? 'wamechangia · kiungo kimoja' : 'people · one shared link'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
