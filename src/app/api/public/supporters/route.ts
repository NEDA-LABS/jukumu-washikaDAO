import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureDonationsSchema } from '@/lib/donations';

export const runtime = 'nodejs';

/**
 * GET /api/public/supporters — the most recent confirmed gifts, for the ticker.
 *
 * Only donations that actually settled. A pending payment is not a supporter
 * yet, and putting one on a public wall would be announcing money that may
 * never arrive.
 *
 * The SELECT is deliberately narrow. The donations row carries a phone number
 * and, for a crypto gift, the donor's wallet address and transaction hash —
 * none of which anyone needs to see a name on a wall, and all of which would
 * be a real disclosure. The name is here because it is the one field the donor
 * was asked to write for display; the message they wrote is not, because it
 * was addressed to us rather than to the public.
 *
 * No session: the raised total and supporter count on the same section are
 * already public, and this is the same fact told a different way.
 */

const MAX = 12;

export async function GET() {
  try {
    await ensureDonationsSchema();
    const res = await pool.query(
      `SELECT donor_name, amount_tzs, token, token_amount, method,
              COALESCE(settled_at, created_at) AS at
         FROM donations
        WHERE status = 'completed'
        ORDER BY COALESCE(settled_at, created_at) DESC
        LIMIT $1`,
      [MAX]
    );

    const supporters = res.rows.map((r: {
      donor_name: string; amount_tzs: string; token: string | null;
      token_amount: string | null; method: string; at: string;
    }) => ({
      name: r.donor_name,
      amountTzs: Number(r.amount_tzs),
      token: r.token,
      tokenAmount: r.token_amount != null ? Number(r.token_amount) : null,
      method: r.method,
      at: r.at,
    }));

    // Never cached at the edge: a ticker whose whole claim is that it is
    // current cannot be served from a copy made before the last gift landed.
    return NextResponse.json({ supporters }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[public/supporters]', error);
    // An empty list renders as nothing at all, which is the right failure for
    // a decorative strip — better than an error where a name should be.
    return NextResponse.json({ supporters: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
