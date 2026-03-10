import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';

export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const { userId, amountTzs, phone } = await request.json();

    if (!userId || !amountTzs || !phone) {
      return NextResponse.json({ error: 'userId, amountTzs, and phone are required' }, { status: 400 });
    }

    if (amountTzs < 100) {
      return NextResponse.json({ error: 'Minimum withdrawal is 100 TZS' }, { status: 400 });
    }

    await ensureNtzsSchema(client);

    const memberRes = await client.query(
      `SELECT m.id, m.ntzs_user_id, m.full_name
       FROM members m JOIN users u ON u.id = m.user_id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );

    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const member = memberRes.rows[0] as { id: number; ntzs_user_id: string | null; full_name: string };

    if (!member.ntzs_user_id) {
      return NextResponse.json({ error: 'Wallet not provisioned' }, { status: 400 });
    }

    // Check API key before calling nTZS
    if (!process.env.NTZS_API_KEY) {
      console.error('NTZS_API_KEY not configured');
      return NextResponse.json({ error: 'Wallet service is not configured. Contact admin.' }, { status: 503 });
    }

    // Normalize phone to 255XXXXXXXXX format
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length === 10 && normalizedPhone.startsWith('0')) {
      normalizedPhone = `255${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.length === 9) {
      normalizedPhone = `255${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('255')) {
      return NextResponse.json({ error: 'Invalid phone number format. Use 07XX XXX XXX or 255 7XX XXX XXX' }, { status: 400 });
    }

    console.log(`[Withdrawal] User ${userId}, Amount: ${amountTzs}, Phone: ${normalizedPhone}`);

    const withdrawal = await ntzs.withdrawals.create({
      userId: member.ntzs_user_id,
      amountTzs,
      phoneNumber: normalizedPhone,
    });

    await recordTransaction(client, {
      ntzsId: withdrawal.id,
      type: 'withdrawal',
      status: withdrawal.status,
      fromMemberId: member.id,
      amountTzs,
      phone: normalizedPhone,
      purpose: 'withdrawal',
      note: `Mobile money withdrawal by ${member.full_name}`,
    });

    return NextResponse.json({
      withdrawalId: withdrawal.id,
      status: withdrawal.status,
      amountTzs,
      message: 'Withdrawal initiated. TZS will be sent to your mobile money.',
    });
  } catch (error) {
    if (error instanceof NtzsApiError) {
      console.error('nTZS withdrawal error:', error.status, error.body);
      const msg = error.body.error === 'insufficient_balance'
        ? 'Salio haitoshi (Insufficient balance)'
        : error.body.message || error.body.error || 'Withdrawal failed';
      return NextResponse.json({
        error: msg,
        details: error.body,
        ntzsStatus: error.status,
      }, { status: error.status });
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Withdrawal error:', errMsg, error);
    return NextResponse.json({ error: errMsg || 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
