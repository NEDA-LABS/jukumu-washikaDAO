import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId } from '@/lib/wallet/ledger';
import { ntzs, NtzsApiError } from '@/lib/ntzs';

export const runtime = 'nodejs';

/**
 * Fund the master treasury (admin only).
 *
 * Fires a mobile-money STK push and mints the amount straight into the master
 * wallet — raising the treasury's on-chain backing WITHOUT crediting any
 * member. Used to cover the small shortfall left by sweep/transfer fees so
 * every member's minted deposit can be fully backed.
 *
 * The recorded row carries no owner and is marked posted=true, so no settlement
 * path (webhook / self-sync / settle / repair) ever credits it to anyone.
 *
 *   POST { amountTzs, phone }
 */
export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NTZS_API_KEY) return NextResponse.json({ error: 'Wallet service not configured (NTZS_API_KEY missing).' }, { status: 503 });

  const client = await pool.connect();
  try {
    const { amountTzs, phone } = await request.json();
    if (!amountTzs || !phone) {
      return NextResponse.json({ error: 'amountTzs and phone are required' }, { status: 400 });
    }
    if (amountTzs < 100) {
      return NextResponse.json({ error: 'Minimum is 100 TZS' }, { status: 400 });
    }

    // Normalize phone to 255XXXXXXXXX
    let normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length === 10 && normalizedPhone.startsWith('0')) {
      normalizedPhone = `255${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.length === 9) {
      normalizedPhone = `255${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('255')) {
      return NextResponse.json({ error: 'Invalid phone number format. Use 07XX XXX XXX or 255 7XX XXX XXX' }, { status: 400 });
    }

    await ensureNtzsSchema(client);
    const masterUserId = await getMasterNtzsUserId(client);

    // Mint straight into the master via mobile money STK push.
    const deposit = await ntzs.deposits.create({
      userId: masterUserId,
      amountTzs,
      phoneNumber: normalizedPhone,
    });

    // Audit row only — no owner, posted=true so nothing ever credits it.
    await recordTransaction(client, {
      ntzsId: deposit.id,
      type: 'deposit',
      status: deposit.status,
      amountTzs,
      netTzs: amountTzs,
      phone: normalizedPhone,
      purpose: 'funding',
      note: 'Treasury reserve top-up (covers sweep/transfer fees)',
      posted: true,
      metadata: { treasury_funding: true },
    });

    return NextResponse.json({
      success: true,
      depositId: deposit.id,
      status: deposit.status,
      amountTzs,
      phone: normalizedPhone,
      message: 'STK push sent. Approve it on the phone; once it mints, the treasury backing rises. Then re-run the deposit repair.',
    });
  } catch (error) {
    if (error instanceof NtzsApiError) {
      console.error('Treasury fund error:', error.status, error.body);
      return NextResponse.json({ error: error.body.message || error.body.error || 'Funding failed', ntzsStatus: error.status }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Treasury fund error:', msg);
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
