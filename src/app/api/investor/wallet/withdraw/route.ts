import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ntzs } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';

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
      `SELECT ntzs_user_id FROM investor_profiles WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    ) as { rows: { ntzs_user_id: string | null }[] };

    const ntzsUserId = profileRes.rows[0]?.ntzs_user_id;
    if (!ntzsUserId) {
      return NextResponse.json({ error: 'Pochi haijasanidiwa bado' }, { status: 400 });
    }

    const withdrawal = await ntzs.withdrawals.create({ userId: ntzsUserId, amountTzs, phoneNumber: phone });

    await recordTransaction(client, {
      ntzsId: withdrawal.id,
      type: 'withdrawal',
      status: withdrawal.status,
      amountTzs: withdrawal.amountTzs,
      phone,
      purpose: 'withdrawal',
      note: 'Investor withdrawal',
      metadata: { investor_id: auth.userId },
    });

    return NextResponse.json({
      success: true,
      withdrawalId: withdrawal.id,
      status: withdrawal.status,
      amountTzs: withdrawal.amountTzs,
      message: 'Ombi la kutoa limetumwa. Fedha zitafika hivi karibuni.',
    });
  } catch (error) {
    console.error('Investor withdrawal error:', error);
    return NextResponse.json({ error: 'Imeshindwa kuwasilisha ombi la kutoa' }, { status: 500 });
  } finally {
    client?.release();
  }
}
