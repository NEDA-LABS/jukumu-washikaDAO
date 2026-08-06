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

/** WashikaDAU support line. */
const WASHIKA_SUPPORT_TEL = '+255744277496';
const WASHIKA_SUPPORT_DISPLAY = '+255 744 277 496';

interface FundingRequest {
  id: number;
  group_id: number;
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
  const [contactTarget, setContactTarget] = useState<FundingRequest | null>(null);

  // Tell the group it was approached. This page is public, so an anonymous
  // visitor simply gets a 401 here and nothing is sent — we will not fan
  // notifications out to a whole chama on the word of unauthenticated traffic.
  const notifyGroupOfContact = (r: FundingRequest, channel: 'email' | 'support') => {
    fetch('/api/investor/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: r.group_id, projectTitle: r.title, channel }),
      keepalive: true,
    }).catch(() => {});
  };

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
        {/* A real savings group mid-meeting, phones out with the app open —
            the investor page should show the thing being invested in, not a
            posed portrait. Chosen over a sharper alternative that had a third
            party bank's branding across it, which would imply a partnership on
            a page about who funds these groups. */}
        <Image
          src="/PXL_20250606_102256087.LONG_EXPOSURE-01.COVER.jpg"
          alt="A savings group meeting in Dar es Salaam, members recording contributions on their phones"
          fill
          sizes="100vw"
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
              <span className="inline-block px-3 py-1 rounded-full bg-gold-tint text-gold-deep text-xs font-semibold uppercase tracking-widest mb-4">Prodcast</span>
              <h2 className="text-3xl font-bold text-foreground mb-3">Projects Seeking Investors</h2>
              <p className="text-foreground/50 max-w-xl mx-auto">Groups that have passed a vote and are seeking investment partnerships. Each project invites investors to co-fund together.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {fundingRequests.map(req => (
                <div key={req.id} className="rounded-2xl bg-card border border-border p-6 flex flex-col gap-4 hover:border-gold/40 transition-colors">
                  {/* Group + members */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gold-deep bg-gold-tint px-2.5 py-1">{req.group_name}</span>
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

                  {/* CTA — opens the contact sheet. It was a bare mailto with
                      no subject and no project reference, so it produced an
                      empty draft the group could never be told about. */}
                  <button
                    onClick={() => setContactTarget(req)}
                    className="wd-press mt-auto w-full bg-gold py-3 text-xs font-semibold text-[#1a1714] transition-colors hover:bg-gold-deep hover:text-background"
                  >
                    Contact about this project
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Contact sheet ─────────────────────────────
          Deliberately does NOT show the group's own phone number. This page is
          public, so publishing a chama member's line here exposes it to anyone
          on the internet — savings groups are a standing target for scam calls.
          The direct line stays on the signed-in investor dashboard, where the
          person asking has registered and is identifiable. ── */}
      {contactTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Contact about this project"
          onClick={(e) => { if (e.target === e.currentTarget) setContactTarget(null); }}
        >
          <div className="w-full max-w-md border-2 border-rule bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="wd-kicker wd-kicker-gold">Contact request</span>
                <h3 className="mt-2 font-display text-lg font-bold leading-tight">{contactTarget.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{contactTarget.group_name}</p>
              </div>
              <button onClick={() => setContactTarget(null)} aria-label="Close" className="p-1 text-muted-foreground">✕</button>
            </div>

            {contactTarget.metadata?.funding_goal_tzs && (
              <p className="mt-4 border border-border bg-gold-tint px-3 py-2 text-xs text-gold-deep">
                Funding goal:{' '}
                <span className="font-mono font-bold">
                  TSH {Number(contactTarget.metadata.funding_goal_tzs).toLocaleString()}
                </span>
              </p>
            )}

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Send us the details and the Washika team will introduce you to{' '}
              <span className="font-semibold text-foreground">{contactTarget.group_name}</span>.
              The group is notified that you got in touch.
            </p>

            <div className="mt-5 space-y-2">
              <a
                href={`mailto:invest@jukumufund.co.tz?subject=${encodeURIComponent(`Interest in: ${contactTarget.title} (${contactTarget.group_name})`)}&body=${encodeURIComponent(`Hello,\n\nI would like to learn more about the project "${contactTarget.title}" from the group ${contactTarget.group_name}.\n\nMy name:\nCompany:\n\nThank you.`)}`}
                onClick={() => notifyGroupOfContact(contactTarget, 'email')}
                className="wd-press block w-full bg-gold py-3 text-center text-sm font-semibold text-[#1a1714]"
              >
                Email the Washika team →
              </a>
              <a
                href={`tel:${WASHIKA_SUPPORT_TEL}`}
                onClick={() => notifyGroupOfContact(contactTarget, 'support')}
                className="wd-press block w-full border-2 border-foreground py-3 text-center text-sm font-semibold"
              >
                Call support · {WASHIKA_SUPPORT_DISPLAY}
              </a>
              <button
                onClick={() => setContactTarget(null)}
                className="w-full border border-border py-2.5 text-sm text-muted-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
