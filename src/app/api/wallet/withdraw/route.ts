import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId, debit, LedgerError } from '@/lib/wallet/ledger';

/**
 * Off-ramp: member balance → mobile money. The member's database balance is
 * debited up front (reserved); the master wallet burns nTZS out to their phone.
 * Any failure before COMMIT rolls the debit back; an async failure is refunded
 * by the webhook.
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();
  let inTx = false;

  try {
    const { userId, amountTzs, phone } = await request.json();

    if (!userId || !amountTzs || !phone) {
      return NextResponse.json({ error: 'userId, amountTzs, and phone are required' }, { status: 400 });
    }
    if (amountTzs < 100) {
      return NextResponse.json({ error: 'Minimum withdrawal is 100 TZS' }, { status: 400 });
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

    let normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length === 10 && normalizedPhone.startsWith('0')) {
      normalizedPhone = `255${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.length === 9) {
      normalizedPhone = `255${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('255')) {
      return NextResponse.json({ error: 'Invalid phone number format. Use 07XX XXX XXX or 255 7XX XXX XXX' }, { status: 400 });
    }

    const masterUserId = await getMasterNtzsUserId(client);

    await client.query('BEGIN');
    inTx = true;

    // Reserve funds first — throws insufficient_balance if the member can't cover it.
    const newBalance = await debit(client, { ownerType: 'member', ownerId: member.id }, amountTzs);

    // Burn from the master wallet out to mobile money. If this throws, the
    // ROLLBACK below undoes the debit.
    const withdrawal = await ntzs.withdrawals.create({
      userId: masterUserId,
      amountTzs,
      phoneNumber: normalizedPhone,
    });

    await recordTransaction(client, {
      ntzsId: withdrawal.id,
      type: 'withdrawal',
      status: withdrawal.status,
      fromMemberId: member.id,
      amountTzs,
      netTzs: amountTzs,
      phone: normalizedPhone,
      purpose: 'withdrawal',
      note: `Mobile money withdrawal by ${member.full_name}`,
      posted: true,
    });

    await client.query('COMMIT');
    inTx = false;

    return NextResponse.json({
      withdrawalId: withdrawal.id,
      status: withdrawal.status,
      amountTzs,
      balanceTzs: newBalance,
      message: 'Withdrawal initiated. TZS will be sent to your mobile money.',
    });
  } catch (error) {
    if (inTx) await client.query('ROLLBACK').catch(() => {});
    if (error instanceof LedgerError) {
      const msg = error.code === 'insufficient_balance'
        ? 'Salio haitoshi (Insufficient balance)'
        : error.message;
      return NextResponse.json({ error: msg, code: error.code }, { status: 400 });
    }
    if (error instanceof NtzsApiError) {
      console.error('nTZS withdrawal error:', error.status, error.body);
      const msg = error.body.error === 'insufficient_balance'
        ? 'Huduma ya pesa haipatikani kwa sasa (Service temporarily unavailable)'
        : error.body.message || error.body.error || 'Withdrawal failed';
      return NextResponse.json({ error: msg, details: error.body, ntzsStatus: error.status }, { status: error.status });
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Withdrawal error:', errMsg, error);
    return NextResponse.json({ error: errMsg || 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
