import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId, debit, credit, LedgerError } from '@/lib/wallet/ledger';
import { withdrawalFeeTzs } from '@/lib/wallet/fees';

export const runtime = 'nodejs';

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}

/**
 * Investor off-ramp. Same fee + ordering model as the member withdrawal:
 * the investor is debited `amount + fee`, the recipient receives `amount`, and
 * the debit + a pending record are committed before the nTZS payout so a later
 * failure can never un-charge money that already left.
 */
export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const amount = body?.amountTzs ? Math.round(Number(body.amountTzs)) : 0;
  const phone = typeof body?.phone === 'string' ? normalizePhone(body.phone) : '';

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Kiasi halisi kinahitajika' }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: 'Nambari ya simu inahitajika' }, { status: 400 });
  }
  if (!process.env.NTZS_API_KEY) {
    return NextResponse.json({ error: 'Huduma ya pochi haijawekwa. Wasiliana na msimamizi.' }, { status: 503 });
  }

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const profileRes = await client.query(
      `SELECT user_id FROM investor_profiles WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    ) as { rows: { user_id: number }[] };
    if (profileRes.rows.length === 0) {
      return NextResponse.json({ error: 'Wasifu wa mwekezaji haujapatikana' }, { status: 404 });
    }

    const fee = withdrawalFeeTzs(amount);
    const totalDebit = amount + fee;
    const owner = { ownerType: 'investor' as const, ownerId: auth.userId };
    const masterUserId = await getMasterNtzsUserId(client);

    // ── Phase 1: reserve + pending record (committed up front) ──
    let intentId: number;
    let newBalance: number;
    try {
      await client.query('BEGIN');
      newBalance = await debit(client, owner, totalDebit);
      intentId = await recordTransaction(client, {
        ntzsId: null,
        type: 'withdrawal',
        status: 'pending',
        amountTzs: amount,
        feeTzs: fee,
        netTzs: amount,
        phone,
        purpose: 'withdrawal',
        note: 'Investor withdrawal',
        posted: true,
        metadata: { investor_id: auth.userId, feeTzs: fee, totalDebitTzs: totalDebit, channel: 'investor' },
      });
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    }

    // ── Phase 2: payout (money leaves the master) ──
    let withdrawal;
    try {
      withdrawal = await ntzs.withdrawals.create({ userId: masterUserId, amountTzs: amount, phoneNumber: phone });
    } catch (err) {
      try {
        await client.query('BEGIN');
        await credit(client, owner, totalDebit);
        await client.query(
          `UPDATE ntzs_transactions SET status = 'failed', posted = false, updated_at = NOW() WHERE id = $1`,
          [intentId]
        );
        await client.query('COMMIT');
      } catch (refundErr) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Investor withdrawal refund failed; reconcile intent', intentId, refundErr);
      }
      throw err;
    }

    // ── Phase 3: finalize (money already gone) ──
    try {
      await client.query(
        `UPDATE ntzs_transactions SET ntzs_id = $1, status = $2, updated_at = NOW() WHERE id = $3`,
        [withdrawal.id, withdrawal.status, intentId]
      );
    } catch (finErr) {
      console.error('Investor withdrawal sent but finalize failed; reconcile intent', intentId, withdrawal.id, finErr);
    }

    return NextResponse.json({
      success: true,
      withdrawalId: withdrawal.id,
      status: withdrawal.status,
      amountTzs: amount,
      feeTzs: fee,
      totalDebitedTzs: totalDebit,
      balanceTzs: newBalance,
      message: 'Ombi la kutoa limetumwa. Fedha zitafika hivi karibuni.',
    });
  } catch (error) {
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
