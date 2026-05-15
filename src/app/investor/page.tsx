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

interface FundingRequest {
  id: number;
  title: string;
  description?: string | null;
  metadata?: {
    funding_goal_tzs?: number;
    project_description?: string;
    timeline?: string;
    expected_impact?: string;
  } | null;
  funded_at: string;
  group_name: string;
  monthly_contribution?: number | null;
  member_count: number;
}

export default function InvestorPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [fundingRequests, setFundingRequests] = useState<FundingRequest[]>([]);

  useEffect(() => {
    fetch('/api/investor/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setStats(data))
      .catch(() => null);

    fetch('/api/investor/funding-requests')
      .then(r => r.ok ? r.json() : null)
      .then(data => data?.requests && setFundingRequests(data.requests))
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
            Invest
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight max-w-3xl mb-6">
            Building Tomorrow,<br />
            <span className="text-white/75 font-normal text-3xl sm:text-4xl lg:text-5xl">
              Together with Communities
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-white/70 max-w-xl leading-relaxed mb-10">
            Washika DAU connects investors with Tanzania&apos;s grassroots entrepreneur groups
            who know their businesses and communities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/investor/signup"
              className="inline-flex items-center justify-center px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors"
            >
              Start Investing →
            </Link>
            <Link
              href="/#about"
              className="inline-flex items-center justify-center px-8 py-4 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors"
            >
              How Washika DAU works
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
                { label: 'Members', value: stats.totalMembers?.toLocaleString() || '—' },
                { label: 'Groups', value: stats.totalGroups?.toLocaleString() || '—' },
                {
                  label: 'Investment',
                  value: stats.totalInvestment > 0
                    ? `TSH ${(stats.totalInvestment / 1_000_000).toFixed(1)}M`
                    : '—',
                },
                { label: 'Regions', value: stats.activeRegions?.toLocaleString() || '—' },
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
            The Model
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground max-w-2xl leading-tight mb-16">
            How the investment model works
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Photo */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
              <Image
                src="/PXL_20250805_160021888.PORTRAIT.jpg"
                alt="Washika DAU group"
                fill
                className="object-cover"
              />
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-10">
              {[
                {
                  num: '01',
                  title: 'Choose a group',
                  body: 'Each group has known founders, an operating business, and a sales record visible directly on our dashboard.',
                },
                {
                  num: '02',
                  title: 'Enter a revenue-share agreement',
                  body: 'A clear agreement outlining revenue split, meeting rights, and a withdrawal process at any time.',
                },
                {
                  num: '03',
                  title: 'Track in real time',
                  body: 'Every transaction, meeting, and monthly report is visible directly. No hidden details.',
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
            Our Principles
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground max-w-2xl leading-tight mb-16">
            What We Believe
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Transparency',
                body: 'No hidden data. Every investor sees the same figures the groups see — revenue, expenses, and all transactions.',
              },
              {
                title: 'Community Respect',
                body: 'We reject models that dictate to small entrepreneurs. Instead, we listen and support their decisions.',
              },
              {
                title: 'Data Integrity',
                body: "We make no return promises. We show you real data from operating groups — you decide.",
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
            Ready to get started?
          </h2>
          <p className="text-lg text-background/60 max-w-xl mx-auto mb-10">
            Reach out — we&apos;ll connect you with a group that matches your goals.
          </p>
          <a
            href="mailto:invest@jukumufund.co.tz"
            className="inline-flex items-center justify-center px-10 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors text-lg"
          >
            invest@jukumufund.co.tz
          </a>
        </div>
      </section>

      {/* ── Prodcast: Live Funding Requests ── */}
      {fundingRequests.length > 0 && (
        <section className="py-20 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 text-xs font-semibold uppercase tracking-widest mb-4">Prodcast</span>
              <h2 className="text-3xl font-bold text-foreground mb-3">Projects Seeking Investors</h2>
              <p className="text-foreground/50 max-w-xl mx-auto">Groups that have passed a vote and are seeking investment partnerships. Each project invites investors to co-fund together.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {fundingRequests.map(req => (
                <div key={req.id} className="rounded-2xl bg-card border border-border p-6 flex flex-col gap-4 hover:border-purple-500/30 transition-colors">
                  {/* Group + members */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-600 bg-purple-500/10 px-2.5 py-1 rounded-full">{req.group_name}</span>
                    <span className="text-[10px] text-muted-foreground">{req.member_count} members</span>
                  </div>

                  {/* Title */}
                  <div>
                    <h3 className="text-sm font-bold text-foreground leading-snug mb-1">{req.title}</h3>
                    {(req.metadata?.project_description || req.description) && (
                      <p className="text-xs text-foreground/50 line-clamp-3">
                        {req.metadata?.project_description || req.description}
                      </p>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-3 flex-wrap">
                    {req.metadata?.funding_goal_tzs && (
                      <div className="flex-1 min-w-0 rounded-xl bg-foreground/[0.03] border border-border px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Goal</p>
                        <p className="text-sm font-bold text-foreground">TSH {Number(req.metadata.funding_goal_tzs).toLocaleString()}</p>
                      </div>
                    )}
                    {req.metadata?.timeline && (
                      <div className="flex-1 min-w-0 rounded-xl bg-foreground/[0.03] border border-border px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">Timeline</p>
                        <p className="text-sm font-bold text-foreground">{req.metadata.timeline}</p>
                      </div>
                    )}
                  </div>

                  {req.metadata?.expected_impact && (
                    <p className="text-[11px] text-foreground/40 italic">&ldquo;{req.metadata.expected_impact}&rdquo;</p>
                  )}

                  {/* CTA */}
                  <a
                    href="mailto:invest@jukumufund.co.tz"
                    className="mt-auto w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold text-center transition-colors"
                  >
                    Contact Us
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
