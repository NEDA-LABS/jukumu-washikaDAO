import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId } from '@/lib/wallet/ledger';
import { getActor } from '@/lib/wallet/authorize';

/**
 * On-ramp: mobile money → master wallet. Funds mint into the single master
 * nTZS wallet; the member's database balance is credited on confirmation
 * (webhook/sync), not here — so a never-confirmed deposit never credits.
 */
export async function POST(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    // Identity comes from the signed cookie, never the request body.
    const userId = actor.userId;
    const { amountTzs, phone } = await request.json();

    if (!userId || !amountTzs || !phone) {
      return NextResponse.json({ error: 'userId, amountTzs, and phone are required' }, { status: 400 });
    }
    if (amountTzs < 100) {
      return NextResponse.json({ error: 'Minimum deposit is 100 TZS' }, { status: 400 });
    }
    if (!process.env.NTZS_API_KEY) {
      console.error('NTZS_API_KEY not configured');
      return NextResponse.json({ error: 'Wallet service is not configured. Contact admin.' }, { status: 503 });
    }

    await ensureNtzsSchema(client);

    const memberRes = await client.query(
      `SELECT m.id, m.full_name FROM members m JOIN users u ON u.id = m.user_id WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    const member = memberRes.rows[0] as { id: number; full_name: string };

    // Normalize phone to 255XXXXXXXXX
    let normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length === 10 && normalizedPhone.startsWith('0')) {
      normalizedPhone = `255${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.length === 9) {
      normalizedPhone = `255${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('255')) {
      return NextResponse.json({ error: 'Invalid phone number format. Use 07XX XXX XXX or 255 7XX XXX XXX' }, { status: 400 });
    }

    const masterUserId = await getMasterNtzsUserId(client);

    // Mint into the master wallet via mobile money STK push.
    const deposit = await ntzs.deposits.create({
      userId: masterUserId,
      amountTzs,
      phoneNumber: normalizedPhone,
    });

    // Pending ledger row — balance is credited on settlement, not now.
    await recordTransaction(client, {
      ntzsId: deposit.id,
      type: 'deposit',
      status: deposit.status,
      toMemberId: member.id,
      amountTzs,
      netTzs: amountTzs,
      phone: normalizedPhone,
      purpose: 'deposit',
      note: `Mobile money deposit by ${member.full_name}`,
      posted: false,
    });

    return NextResponse.json({
      depositId: deposit.id,
      status: deposit.status,
      amountTzs,
      message: 'Mobile top-up request sent. Please confirm on your phone.',
    });
  } catch (error) {
    if (error instanceof NtzsApiError) {
      console.error('nTZS deposit error:', error.status, error.body);
      return NextResponse.json({
        error: error.body.message || error.body.error || 'Deposit failed',
        details: error.body,
        ntzsStatus: error.status,
      }, { status: error.status });
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Deposit error:', errMsg, error);
    return NextResponse.json({ error: errMsg || 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
