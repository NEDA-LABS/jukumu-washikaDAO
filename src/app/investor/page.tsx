'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface NetworkStats {
  totalMembers: number;
  totalGroups: number;
  totalInvestment: number;
  activeRegions: number;
}

export default function InvestorPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);

  useEffect(() => {
    fetch('/api/investor/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setStats(data))
      .catch(() => null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ── Hero ── */}
      <section className="relative min-h-[90vh] overflow-hidden bg-black flex items-end">
        <Image
          src="/PXL_20250618_112718098.PORTRAIT.jpg"
          alt="Washika DAU community"
          fill
          className="object-cover object-center opacity-60"
          priority
        />
        {/* gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 45%, transparent 75%), ' +
              'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pb-20 pt-32">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">
            Wekeza
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight max-w-3xl mb-6">
            Kujenga Kesho,<br />
            <span className="text-white/75 font-normal text-3xl sm:text-4xl lg:text-5xl">
              Pamoja na Jamii
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-white/70 max-w-xl leading-relaxed mb-10">
            Washika DAU inaunganisha wawekezaji na makundi ya wajasiriamali wa Tanzania ambao
            wanajua biashara zao na jamii zao.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="mailto:invest@jukumufund.co.tz"
              className="inline-flex items-center justify-center px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors"
            >
              Wasiliana nasi
            </a>
            <Link
              href="/#about"
              className="inline-flex items-center justify-center px-8 py-4 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors"
            >
              Jinsi Washika DAU inavyofanya kazi
            </Link>
          </div>
        </div>

        {/* scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse" />
          </div>
        </div>
      </section>

      {/* ── Live Network Stats ── */}
      {stats && (
        <section className="bg-muted border-b border-border py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
              {[
                { label: 'Wanachama', value: stats.totalMembers?.toLocaleString() || '—' },
                { label: 'Makundi', value: stats.totalGroups?.toLocaleString() || '—' },
                {
                  label: 'Uwekezaji',
                  value: stats.totalInvestment > 0
                    ? `TSH ${(stats.totalInvestment / 1_000_000).toFixed(1)}M`
                    : '—',
                },
                { label: 'Mikoa', value: stats.activeRegions?.toLocaleString() || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-3xl sm:text-4xl font-bold text-foreground">{value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── How the model works ── */}
      <section className="bg-background py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">
            Mfumo
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground max-w-2xl leading-tight mb-16">
            Jinsi uwekezaji unavyofanya kazi
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Photo */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
              <Image
                src="/PXL_20250805_160021888.PORTRAIT.jpg"
                alt="Washika DAU kundi"
                fill
                className="object-cover"
              />
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-10">
              {[
                {
                  num: '01',
                  title: 'Unachagua kundi',
                  body: 'Kila kundi lina waanzilishi wanaojulikana, biashara inayofanya kazi, na rekodi ya mauzo inayoonekana kwenye dashibodi yetu.',
                },
                {
                  num: '02',
                  title: 'Unaingia kwa mkataba wa hisa',
                  body: 'Mkataba wazi unaoeleza mgawanyo wa mapato, haki za mkutano, na utaratibu wa kutoa pesa wakati wowote.',
                },
                {
                  num: '03',
                  title: 'Unafuatilia kwa wakati halisi',
                  body: 'Kila muamala, mkutano, na taarifa ya kila mwezi inaonekana moja kwa moja. Hakuna siri.',
                },
              ].map(({ num, title, body }) => (
                <div key={num} className="flex gap-6">
                  <span className="text-5xl font-bold text-border leading-none select-none">
                    {num}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Principles ── */}
      <section className="bg-muted py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">
            Misingi yetu
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground max-w-2xl leading-tight mb-16">
            Tunaamini nini
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Uwazi',
                body: 'Hakuna takwimu zilizofichwa. Kila mwekezaji anaona data ile ile ambayo makundi yanaona — mapato, gharama, na shughuli zote.',
              },
              {
                title: 'Heshima ya Jamii',
                body: 'Tunakataa mfumo ambao unawaambia wajasiriamali wadogo nini cha kufanya. Badala yake, tunasikiliza na kuunga mkono maamuzi yao.',
              },
              {
                title: 'Ukweli wa Takwimu',
                body: 'Hatuweki ahadi za mapato. Tunakuonyesha data halisi ya makundi yanayofanya kazi — wewe unaamua.',
              },
            ].map(({ title, body }) => (
              <div key={title} className="bg-card rounded-2xl p-8 border border-border">
                <h3 className="text-xl font-semibold text-foreground mb-4">{title}</h3>
                <p className="text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Community photo strip ── */}
      <section className="bg-background py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              '/PXL_20250531_114540969.PORTRAIT.jpg',
              '/PXL_20250618_114941185.MP.jpg',
              '/PXL_20250731_150045170.PORTRAIT.jpg',
              '/PXL_20250815_151019991.PORTRAIT.jpg',
            ].map((src, i) => (
              <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden">
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-foreground py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-background mb-6">
            Uko tayari kuanza?
          </h2>
          <p className="text-lg text-background/60 max-w-xl mx-auto mb-10">
            Wasiliana nasi — tutakuunganisha na kundi linalolingana na malengo yako.
          </p>
          <a
            href="mailto:invest@jukumufund.co.tz"
            className="inline-flex items-center justify-center px-10 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors text-lg"
          >
            invest@jukumufund.co.tz
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
