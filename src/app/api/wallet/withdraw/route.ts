import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId, debit, credit, LedgerError } from '@/lib/wallet/ledger';
import { withdrawalFeeTzs } from '@/lib/wallet/fees';
import { notify } from '@/lib/notify';

/**
 * Off-ramp: member balance → mobile money.
 *
 * Fee model (on-top): the member is debited `amount + fee`; the recipient
 * receives the full `amount`. The fee accrues as master-wallet surplus, so the
 * reserve is never depleted by the payout. The rate is configurable (see
 * src/lib/wallet/fees.ts) and defaults to 0.
 *
 * Ordering (so a payout can never be un-charged): the debit + a `pending` ledger
 * row are committed BEFORE the nTZS call. If the call fails, we refund and mark
 * it failed (nothing left). If it succeeds, we finalize the row with the nTZS
 * id/status — and never roll the debit back, because the money has already left.
 * Async status changes are handled by the webhook via settleExternalTransaction.
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const { userId, amountTzs, phone, quoteId } = await request.json();

    if (!userId || !amountTzs || !phone) {
      return NextResponse.json({ error: 'userId, amountTzs, and phone are required' }, { status: 400 });
    }
    if (!quoteId || typeof quoteId !== 'string') {
      return NextResponse.json({
        error: 'A withdrawal quote is required. Fetch one from /api/wallet/withdraw/quote first.',
        code: 'quote_required',
      }, { status: 400 });
    }
    const amount = Math.round(Number(amountTzs));
    if (!Number.isFinite(amount) || amount < 100) {
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

    const fee = withdrawalFeeTzs(amount);
    const totalDebit = amount + fee;
    const owner = { ownerType: 'member' as const, ownerId: member.id };
    const masterUserId = await getMasterNtzsUserId(client);

    // ── Phase 1: reserve funds + write a pending record (committed up front) ──
    let intentId: number;
    let newBalance: number;
    try {
      await client.query('BEGIN');
      newBalance = await debit(client, owner, totalDebit); // throws insufficient_balance
      intentId = await recordTransaction(client, {
        ntzsId: null,
        type: 'withdrawal',
        status: 'pending',
        fromMemberId: member.id,
        amountTzs: amount,
        feeTzs: fee,
        netTzs: amount,
        phone: normalizedPhone,
        purpose: 'withdrawal',
        note: `Mobile money withdrawal by ${member.full_name}`,
        posted: true,
        metadata: { feeTzs: fee, totalDebitTzs: totalDebit, channel: 'member' },
      });
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    }

    // ── Phase 2: the actual payout (money leaves the master) ──
    let withdrawal;
    try {
      withdrawal = await ntzs.withdrawals.create({ userId: masterUserId, amountTzs: amount, phoneNumber: normalizedPhone, quoteId });
    } catch (err) {
      // The send failed → nothing left; refund the full debit and mark failed.
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
        console.error('Withdrawal refund failed; reconcile intent', intentId, refundErr);
      }
      throw err;
    }

    // ── Phase 3: finalize (money already gone — never roll the debit back) ──
    try {
      await client.query(
        `UPDATE ntzs_transactions SET ntzs_id = $1, status = $2, updated_at = NOW() WHERE id = $3`,
        [withdrawal.id, withdrawal.status, intentId]
      );
    } catch (finErr) {
      console.error('Withdrawal sent but finalize failed; reconcile intent', intentId, withdrawal.id, finErr);
    }

    try {
      const amt = amount.toLocaleString();
      await notify(client, Number(userId), {
        title: 'Umetoa Pesa',
        message: `Ombi la kutoa TSh ${amt} limeanzishwa. Utapokea kupitia mobile money.`,
        titleEn: 'Withdrawal Started',
        messageEn: `Your withdrawal of TSh ${amt} has been initiated to your mobile money.`,
        type: 'success', category: 'wallet',
        actionUrl: '/member-dashboard?section=wallet', actionText: 'Pochi',
        metadata: { amountTzs: amount, kind: 'withdrawal' },
      });
    } catch (e) { console.error('[withdraw] notify failed:', e); }

    return NextResponse.json({
      withdrawalId: withdrawal.id,
      status: withdrawal.status,
      amountTzs: amount,
      feeTzs: fee,
      totalDebitedTzs: totalDebit,
      balanceTzs: newBalance,
      message: fee > 0
        ? `Withdrawal initiated. TSh ${amount.toLocaleString()} to your mobile money (fee TSh ${fee.toLocaleString()}).`
        : 'Withdrawal initiated. TZS will be sent to your mobile money.',
    });
  } catch (error) {
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
