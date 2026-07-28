import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api/http';
import { owned } from '@/lib/api/scope';
import { normalizePhone, amountTzs } from '@/lib/api/money';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { getMasterNtzsUserId, getBalanceTzs } from '@/lib/wallet/ledger';
import { withdrawalFeeTzs } from '@/lib/wallet/fees';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/withdrawals/quote
 * Price a cash-out. Mandatory: the provider rejects any withdrawal sent
 * without a fresh `quote_id`. Quotes expire after about 5 minutes.
 *
 * Body: { member_id, amount_tzs, phone }
 */
export const POST = handle('write', async (request, { scope }) => {
  const body = await request.json().catch(() => null);

  const memberId = Number(body?.member_id);
  const amount = amountTzs(body?.amount_tzs);
  const phone = normalizePhone(body?.phone);

  if (!Number.isFinite(memberId)) return fail(422, 'invalid_request', '`member_id` is required.');
  if (amount === null) return fail(422, 'invalid_request', '`amount_tzs` must be a whole number of at least 100.');
  if (!phone) return fail(422, 'invalid_request', '`phone` must be a Tanzanian number.');
  if (!process.env.NTZS_API_KEY) {
    return fail(503, 'wallet_unavailable', 'The wallet provider is not configured.');
  }

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const memberValues: unknown[] = [memberId];
    const memberRes = await client.query(
      `SELECT id FROM members m WHERE m.id = $1 AND ${owned(scope, 'm', memberValues)} LIMIT 1`,
      memberValues,
    );
    if (memberRes.rows.length === 0) return fail(404, 'not_found', 'No member with that id.');

    const platformFee = withdrawalFeeTzs(amount);
    const totalDebit = amount + platformFee;
    const balance = await getBalanceTzs(client, { ownerType: 'member', ownerId: memberId });

    const masterUserId = await getMasterNtzsUserId(client);
    let quote;
    try {
      quote = await ntzs.withdrawals.quote({ userId: masterUserId, amountTzs: amount, phoneNumber: phone });
    } catch (err) {
      if (err instanceof NtzsApiError) {
        return fail(502, 'provider_error', err.body.message || err.body.error || 'Could not price this withdrawal.', err.body);
      }
      throw err;
    }

    return ok({
      quote_id: quote.quoteId,
      expires_at: quote.expiresAt,
      recipient_name: quote.recipientName,
      receive_amount_tzs: Math.round(quote.receiveAmountTzs),
      provider_fee_tzs: Math.round(Number(quote.fees?.totalFeeTzs ?? 0)),
      platform_fee_tzs: platformFee,
      total_debit_tzs: totalDebit,
      member_balance_tzs: balance,
      sufficient_funds: balance >= totalDebit,
      phone,
    });
  } finally {
    client.release();
  }
});
