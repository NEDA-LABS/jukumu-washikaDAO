import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId } from '@/lib/wallet/ledger';
import {
  ensureDonationsSchema, newCertificateCode,
  normalizeDonorPhone, isValidDonorPhone, getDonationTotals,
} from '@/lib/donations';

export const runtime = 'nodejs';

const MIN_TZS = 1000;
const MAX_TZS = 20_000_000;

/**
 * GET  /api/public/donate — what has been raised so far.
 * POST /api/public/donate — start a donation: sends a mobile-money prompt to
 *      the donor's phone. Nothing is recorded as given until they approve it.
 *
 * Deliberately open, with no session: giving should not require an account.
 * That means the only thing a caller can do here is cause their own phone to
 * ring with a payment request for an amount they chose.
 */

export async function GET() {
  try {
    const totals = await getDonationTotals();
    return NextResponse.json(totals, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('[public/donate GET]', error);
    return NextResponse.json({ totalTzs: 0, supporters: 0 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const donorName = typeof body?.donorName === 'string' ? body.donorName.trim().slice(0, 160) : '';
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 280) : null;
  const amountTzs = Math.floor(Number(body?.amountTzs));
  const phone = normalizeDonorPhone(body?.phone ?? '');

  if (donorName.length < 2) {
    return NextResponse.json({ error: 'Tell us who to thank', field: 'donorName' }, { status: 400 });
  }
  if (!Number.isFinite(amountTzs) || amountTzs < MIN_TZS) {
    return NextResponse.json({ error: `Minimum donation is TSh ${MIN_TZS.toLocaleString()}`, field: 'amountTzs' }, { status: 400 });
  }
  if (amountTzs > MAX_TZS) {
    return NextResponse.json({ error: 'That amount is too large for mobile money', field: 'amountTzs' }, { status: 400 });
  }
  if (!isValidDonorPhone(phone)) {
    return NextResponse.json({ error: 'Enter a valid Tanzanian mobile number', field: 'phone' }, { status: 400 });
  }

  await ensureDonationsSchema();
  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    // One prompt at a time per number, so a double-tap cannot ring twice.
    const inFlight = await client.query(
      `SELECT certificate_code FROM donations
        WHERE phone = $1 AND status = 'pending' AND created_at > NOW() - INTERVAL '3 minutes'
        LIMIT 1`,
      [phone]
    );
    if (inFlight.rows.length > 0) {
      return NextResponse.json({
        reference: (inFlight.rows[0] as { certificate_code: string }).certificate_code,
        pending: true,
        message: 'A payment request is already on its way to that number.',
      });
    }

    const code = newCertificateCode();
    const masterUserId = await getMasterNtzsUserId(client);

    const deposit = await ntzs.deposits.create({
      userId: masterUserId,
      amountTzs,
      phoneNumber: phone,
    });

    await client.query(
      `INSERT INTO donations (donor_name, phone, amount_tzs, ntzs_id, status, certificate_code, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [donorName, phone, amountTzs, deposit.id, deposit.status || 'pending', code, message]
    );

    // Visible in the platform's own transaction history. No member or group is
    // credited — a donation is not held on anyone's behalf.
    await recordTransaction(client, {
      ntzsId: deposit.id,
      type: 'deposit',
      status: deposit.status,
      amountTzs,
      netTzs: amountTzs,
      phone,
      purpose: 'donation',
      note: `Donation from ${donorName}`,
      metadata: { kind: 'donation', certificate_code: code, donor_name: donorName },
      posted: false,
    });

    return NextResponse.json({
      reference: code,
      status: deposit.status,
      amountTzs,
      message: 'Check your phone and approve the payment.',
    });
  } catch (error) {
    if (error instanceof NtzsApiError) {
      console.error('[public/donate] nTZS', error.status, error.body);
      return NextResponse.json(
        { error: error.body.message || error.body.error || 'Could not start the payment' },
        { status: 502 }
      );
    }
    console.error('[public/donate]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
