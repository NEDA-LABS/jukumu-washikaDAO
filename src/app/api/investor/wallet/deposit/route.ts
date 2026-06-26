import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ntzs } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId } from '@/lib/wallet/ledger';

export const runtime = 'nodejs';

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const amountTzs = body?.amountTzs ? Number(body.amountTzs) : 0;
  const phone = typeof body?.phone === 'string' ? normalizePhone(body.phone) : '';

  if (!amountTzs || amountTzs <= 0) {
    return NextResponse.json({ error: 'Kiasi halisi kinahitajika' }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: 'Nambari ya simu inahitajika' }, { status: 400 });
  }

  let client;
  try {
    client = await pool.connect();
    await ensureNtzsSchema(client);

    const profileRes = await client.query(
      `SELECT user_id FROM investor_profiles WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    ) as { rows: { user_id: number }[] };
    if (profileRes.rows.length === 0) {
      return NextResponse.json({ error: 'Wasifu wa mwekezaji haujapatikana' }, { status: 404 });
    }

    const masterUserId = await getMasterNtzsUserId(client);
    const deposit = await ntzs.deposits.create({ userId: masterUserId, amountTzs, phoneNumber: phone });

    // Pending — investor balance is credited on settlement (webhook/sync).
    await recordTransaction(client, {
      ntzsId: deposit.id,
      type: 'deposit',
      status: deposit.status,
      amountTzs: deposit.amountTzs ?? amountTzs,
      netTzs: deposit.amountTzs ?? amountTzs,
      phone,
      purpose: 'deposit',
      note: 'Investor deposit',
      metadata: { investor_id: auth.userId },
      posted: false,
    });

    return NextResponse.json({
      success: true,
      depositId: deposit.id,
      status: deposit.status,
      amountTzs: deposit.amountTzs ?? amountTzs,
      message: 'Ombi la amana limetumwa. Angalia simu yako kukamilisha.',
    });
  } catch (error) {
    console.error('Investor deposit error:', error);
    return NextResponse.json({ error: 'Imeshindwa kuwasilisha ombi la amana' }, { status: 500 });
  } finally {
    client?.release();
  }
}
