import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import { ensureDonationsSchema } from '@/lib/donations';

export const dynamic = 'force-dynamic';

/**
 * A supporter's certificate, on a page of its own.
 *
 * Public and shareable — the whole point of a certificate is that it can be
 * shown to somebody. The code is unguessable, so having the link is the only
 * credential, and the page reveals nothing beyond the name the donor chose to
 * be thanked by and what they gave.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return {
    title: `Certificate of Support · ${code} · WashikaDAU`,
    description: 'A certificate of support for WashikaDAU — helping Tanzanian savings groups build what they own.',
  };
}

export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  await ensureDonationsSchema();
  type DonationRow = { donor_name: string; amount_tzs: string; status: string; settled_at: string | null };
  const client = await pool.connect();
  let donation: DonationRow | null = null;
  try {
    const res = await client.query(
      `SELECT donor_name, amount_tzs, status, settled_at
         FROM donations WHERE certificate_code = $1 LIMIT 1`,
      [code]
    );
    donation = (res.rows[0] as DonationRow | undefined) ?? null;
  } finally {
    client.release();
  }

  if (!donation) notFound();

  // A certificate exists only for a gift that actually arrived.
  if (donation.status !== 'completed') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md border-2 border-rule bg-card p-8 text-center">
          <span className="wd-kicker wd-kicker-gold">WashikaDAU</span>
          <h1 className="mt-3 font-display text-[22px] font-bold leading-tight">Not completed yet</h1>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
            This donation has not been confirmed, so there is no certificate for it yet.
          </p>
          <Link href="/#changia" className="wd-press mt-6 inline-block border-2 border-foreground px-5 py-3 text-[12px] font-semibold">
            Back to WashikaDAU
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[980px] px-[clamp(16px,4vw,44px)] py-[clamp(28px,5vw,64px)]">
        <div className="flex items-center justify-between border-b-2 border-rule pb-4">
          <div>
            <span className="wd-kicker wd-kicker-gold">Cheti cha shukrani</span>
            <h1 className="mt-1.5 font-display text-[clamp(22px,3.4vw,34px)] font-bold leading-tight">
              Certificate of Support
            </h1>
          </div>
          <Link href="/" className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
            WashikaDAU
          </Link>
        </div>

        {/* The artwork itself, served by the same endpoint that downloads it,
            so what is on screen is exactly what gets saved. */}
        <div className="mt-6 border-2 border-rule bg-card p-[clamp(8px,1.5vw,18px)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/public/certificate/${encodeURIComponent(code)}?inline=1`}
            alt={`Certificate of support for ${donation.donor_name}`}
            className="w-full"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a
            href={`/api/public/certificate/${encodeURIComponent(code)}`}
            download
            className="wd-press bg-gold px-6 py-3.5 text-[12.5px] font-semibold text-[#1a1714]"
          >
            Download certificate
          </a>
          <Link
            href="/#changia"
            className="wd-press border-2 border-foreground px-6 py-3 text-[12.5px] font-semibold"
          >
            Support WashikaDAU
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-border pt-5">
          {[
            ['Supporter', donation.donor_name],
            ['Gift', `TSh ${fmt(Number(donation.amount_tzs))}`],
            ['Reference', code],
          ].map(([k, v]) => (
            <div key={k}>
              <span className="wd-kicker">{k}</span>
              <p className="mt-1 text-[13px] font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
