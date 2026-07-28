import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api/http';
import { owned } from '@/lib/api/scope';
import { normalizePhone, amountTzs } from '@/lib/api/money';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId } from '@/lib/wallet/ledger';
import { serializeTransaction } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/deposits
 * On-ramp: mobile money -> nTZS. Triggers an STK push to the payer's phone.
 *
 * The member's balance is NOT credited here — it is credited when the
 * provider confirms settlement (webhook / sync), so a push that is never
 * completed can never create money.
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
  if (!phone) return fail(422, 'invalid_request', '`phone` must be a Tanzanian number (07XXXXXXXX or 2557XXXXXXXX).');

  if (!process.env.NTZS_API_KEY) {
    return fail(503, 'wallet_unavailable', 'The wallet provider is not configured.');
  }

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const memberValues: unknown[] = [memberId];
    const memberRes = await client.query(
      `SELECT id, full_name FROM members m WHERE m.id = $1 AND ${owned(scope, 'm', memberValues)} LIMIT 1`,
      memberValues,
    );
    if (memberRes.rows.length === 0) return fail(404, 'not_found', 'No member with that id.');
    const member = memberRes.rows[0] as { id: number; full_name: string };

    const masterUserId = await getMasterNtzsUserId(client);

    let deposit;
    try {
      deposit = await ntzs.deposits.create({ userId: masterUserId, amountTzs: amount, phoneNumber: phone });
    } catch (err) {
      if (err instanceof NtzsApiError) {
        return fail(502, 'provider_error', err.body.message || err.body.error || 'The wallet provider rejected the deposit.', err.body);
      }
      throw err;
    }

    const txId = await recordTransaction(client, {
      ntzsId: deposit.id,
      type: 'deposit',
      status: deposit.status,
      toMemberId: member.id,
      amountTzs: amount,
      netTzs: amount,
      phone,
      purpose: 'deposit',
      note: `API deposit for ${member.full_name}`,
      posted: false,
      metadata: { channel: 'api' },
    });

    const row = await client.query(
      `SELECT t.*, tm.full_name AS to_member_name
         FROM ntzs_transactions t
         LEFT JOIN members tm ON tm.id = t.to_member_id
        WHERE t.id = $1`,
      [txId],
    );

    return ok(
      {
        ...serializeTransaction(row.rows[0]),
        // The push is in flight — poll GET /api/v1/transactions/{id} for the
        // settled status rather than assuming success here.
        settled: false,
      },
      undefined,
      { status: 202 },
    );
  } finally {
    client.release();
  }
});
