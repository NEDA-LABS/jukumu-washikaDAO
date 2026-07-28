import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api/http';
import { normalizePhone, amountTzs } from '@/lib/api/money';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId, debit, credit, LedgerError } from '@/lib/wallet/ledger';
import { withdrawalFeeTzs } from '@/lib/wallet/fees';
import { serializeTransaction } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/withdrawals
 * Off-ramp: nTZS -> mobile money. Requires a `quote_id` from
 * POST /api/v1/withdrawals/quote (the provider enforces this).
 *
 * Ordering matters and mirrors the in-app flow: the member is debited and a
 * pending row is committed BEFORE the payout call. If the payout fails we
 * refund and mark it failed. If it succeeds we never roll the debit back,
 * because the money has already left.
 *
 * Body: { member_id, amount_tzs, phone, quote_id }
 */
export const POST = handle('write', async (request) => {
  const body = await request.json().catch(() => null);

  const memberId = Number(body?.member_id);
  const amount = amountTzs(body?.amount_tzs);
  const phone = normalizePhone(body?.phone);
  const quoteId = typeof body?.quote_id === 'string' ? body.quote_id : '';

  if (!Number.isFinite(memberId)) return fail(422, 'invalid_request', '`member_id` is required.');
  if (amount === null) return fail(422, 'invalid_request', '`amount_tzs` must be a whole number of at least 100.');
  if (!phone) return fail(422, 'invalid_request', '`phone` must be a Tanzanian number.');
  if (!quoteId) {
    return fail(422, 'quote_required', 'A `quote_id` from POST /api/v1/withdrawals/quote is required.');
  }
  if (!process.env.NTZS_API_KEY) {
    return fail(503, 'wallet_unavailable', 'The wallet provider is not configured.');
  }

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const memberRes = await client.query(
      `SELECT id, full_name FROM members WHERE id = $1 LIMIT 1`, [memberId],
    );
    if (memberRes.rows.length === 0) return fail(404, 'not_found', 'No member with that id.');
    const member = memberRes.rows[0] as { id: number; full_name: string };

    const fee = withdrawalFeeTzs(amount);
    const totalDebit = amount + fee;
    const owner = { ownerType: 'member' as const, ownerId: member.id };
    const masterUserId = await getMasterNtzsUserId(client);

    // Phase 1 — reserve funds and commit a pending row.
    let intentId: number;
    let newBalance: number;
    try {
      await client.query('BEGIN');
      newBalance = await debit(client, owner, totalDebit);
      intentId = await recordTransaction(client, {
        ntzsId: null,
        type: 'withdrawal',
        status: 'pending',
        fromMemberId: member.id,
        amountTzs: amount,
        feeTzs: fee,
        netTzs: amount,
        phone,
        purpose: 'withdrawal',
        note: `API withdrawal for ${member.full_name}`,
        posted: true,
        metadata: { feeTzs: fee, totalDebitTzs: totalDebit, channel: 'api' },
      });
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      if (e instanceof LedgerError && e.code === 'insufficient_balance') {
        return fail(402, 'insufficient_balance', 'The member does not have enough balance for this withdrawal.');
      }
      throw e;
    }

    // Phase 2 — the payout itself.
    let withdrawal;
    try {
      withdrawal = await ntzs.withdrawals.create({
        userId: masterUserId, amountTzs: amount, phoneNumber: phone, quoteId,
      });
    } catch (err) {
      try {
        await client.query('BEGIN');
        await credit(client, owner, totalDebit);
        await client.query(
          `UPDATE ntzs_transactions SET status = 'failed', posted = false, updated_at = NOW() WHERE id = $1`,
          [intentId],
        );
        await client.query('COMMIT');
      } catch (refundErr) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[api/v1] withdrawal refund failed; reconcile intent', intentId, refundErr);
      }
      if (err instanceof NtzsApiError) {
        const code = String(err.body.error || '');
        const status = ['invalid_quote', 'quote_stale', 'quote_mismatch', 'quote_required'].includes(code) ? 409 : 502;
        return fail(status, code || 'provider_error', err.body.message || 'The payout was rejected. Fetch a fresh quote and retry.', err.body);
      }
      throw err;
    }

    // Phase 3 — finalize. Never roll the debit back here.
    await client.query(
      `UPDATE ntzs_transactions SET ntzs_id = $1, status = $2, updated_at = NOW() WHERE id = $3`,
      [withdrawal.id, withdrawal.status, intentId],
    ).catch((e) => console.error('[api/v1] withdrawal finalize failed; reconcile', intentId, e));

    const row = await client.query(
      `SELECT t.*, fm.full_name AS from_member_name
         FROM ntzs_transactions t
         LEFT JOIN members fm ON fm.id = t.from_member_id
        WHERE t.id = $1`,
      [intentId],
    );

    return ok({
      ...serializeTransaction(row.rows[0]),
      total_debited_tzs: totalDebit,
      member_balance_tzs: newBalance,
    }, undefined, { status: 202 });
  } finally {
    client.release();
  }
});
