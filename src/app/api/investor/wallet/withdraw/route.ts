import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId, debit, LedgerError } from '@/lib/wallet/ledger';

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

  const client = await pool.connect();
  let inTx = false;
  try {
    await ensureNtzsSchema(client);

    const profileRes = await client.query(
      `SELECT user_id FROM investor_profiles WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    ) as { rows: { user_id: number }[] };
    if (profileRes.rows.length === 0) {
      return NextResponse.json({ error: 'Wasifu wa mwekezaji haujapatikana' }, { status: 404 });
    }

    const masterUserId = await getMasterNtzsUserId(client);

    await client.query('BEGIN');
    inTx = true;

    const newBalance = await debit(client, { ownerType: 'investor', ownerId: auth.userId }, amountTzs);
    const withdrawal = await ntzs.withdrawals.create({ userId: masterUserId, amountTzs, phoneNumber: phone });

    await recordTransaction(client, {
      ntzsId: withdrawal.id,
      type: 'withdrawal',
      status: withdrawal.status,
      amountTzs,
      netTzs: amountTzs,
      phone,
      purpose: 'withdrawal',
      note: 'Investor withdrawal',
      metadata: { investor_id: auth.userId },
      posted: true,
    });

    await client.query('COMMIT');
    inTx = false;

    return NextResponse.json({
      success: true,
      withdrawalId: withdrawal.id,
      status: withdrawal.status,
      amountTzs,
      balanceTzs: newBalance,
      message: 'Ombi la kutoa limetumwa. Fedha zitafika hivi karibuni.',
    });
  } catch (error) {
    if (inTx) await client.query('ROLLBACK').catch(() => {});
    if (error instanceof LedgerError) {
      const msg = error.code === 'insufficient_balance' ? 'Salio haitoshi' : error.message;
      return NextResponse.json({ error: msg, code: error.code }, { status: 400 });
    }
    if (error instanceof NtzsApiError) {
      console.error('Investor withdrawal nTZS error:', error.status, error.body);
      return NextResponse.json({ error: error.body?.message || 'Imeshindwa kuwasilisha ombi la kutoa' }, { status: 400 });
    }
    console.error('Investor withdrawal error:', error);
    return NextResponse.json({ error: 'Imeshindwa kuwasilisha ombi la kutoa' }, { status: 500 });
  } finally {
    client.release();
  }
}
