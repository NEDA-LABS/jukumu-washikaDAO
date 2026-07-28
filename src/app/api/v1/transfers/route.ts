import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api/http';
import { ownsGroup, ownsMember } from '@/lib/api/scope';
import { amountTzs } from '@/lib/api/money';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { internalTransfer, LedgerError } from '@/lib/wallet/ledger';
import { serializeTransaction } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/transfers
 * Move money inside the platform. Nothing touches the chain — these are
 * atomic database transfers between two wallet accounts.
 *
 * Body:
 *   { from_member_id, to_group_id, amount_tzs, purpose: "contribution" }
 *   { from_member_id, to_member_id, amount_tzs, purpose: "p2p" }
 *   { from_group_id,  to_member_id, amount_tzs, purpose: "disbursement" }
 */
const PURPOSES = ['contribution', 'p2p', 'disbursement'] as const;
type Purpose = (typeof PURPOSES)[number];

export const POST = handle('write', async (request, { scope }) => {
  const body = await request.json().catch(() => null);

  const amount = amountTzs(body?.amount_tzs, 1);
  const purpose = body?.purpose as Purpose;
  const fromMemberId = body?.from_member_id != null ? Number(body.from_member_id) : null;
  const fromGroupId = body?.from_group_id != null ? Number(body.from_group_id) : null;
  const toMemberId = body?.to_member_id != null ? Number(body.to_member_id) : null;
  const toGroupId = body?.to_group_id != null ? Number(body.to_group_id) : null;

  if (amount === null) return fail(422, 'invalid_request', '`amount_tzs` must be a positive whole number.');
  if (!PURPOSES.includes(purpose)) {
    return fail(422, 'invalid_request', `\`purpose\` must be one of: ${PURPOSES.join(', ')}.`);
  }

  const fromCount = [fromMemberId, fromGroupId].filter((v) => v != null).length;
  const toCount = [toMemberId, toGroupId].filter((v) => v != null).length;
  if (fromCount !== 1) return fail(422, 'invalid_request', 'Provide exactly one of `from_member_id` or `from_group_id`.');
  if (toCount !== 1) return fail(422, 'invalid_request', 'Provide exactly one of `to_member_id` or `to_group_id`.');

  const from = fromMemberId != null
    ? { ownerType: 'member' as const, ownerId: fromMemberId }
    : { ownerType: 'group' as const, ownerId: fromGroupId! };
  const to = toMemberId != null
    ? { ownerType: 'member' as const, ownerId: toMemberId }
    : { ownerType: 'group' as const, ownerId: toGroupId! };

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    // Verify both parties exist AND belong to the caller before touching
    // balances. This is the check that stops a partner moving money into or
    // out of an account that isn't theirs; a typo or a probe both return 404.
    for (const side of [from, to]) {
      const ownsIt = side.ownerType === 'member'
        ? await ownsMember(client, scope, side.ownerId)
        : await ownsGroup(client, scope, side.ownerId);
      if (!ownsIt) {
        return fail(404, 'not_found', `No ${side.ownerType} with id ${side.ownerId}.`);
      }
    }

    let journalId: number;
    let fromBalance: number;
    try {
      await client.query('BEGIN');
      const result = await internalTransfer(client, {
        from, to, amountTzs: amount, purpose,
        note: `API transfer (${purpose})`,
        metadata: { channel: 'api' },
      });
      await client.query('COMMIT');
      journalId = result.journalId;
      fromBalance = result.fromBalanceTzs;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      if (e instanceof LedgerError) {
        if (e.code === 'insufficient_balance') {
          return fail(402, 'insufficient_balance', 'The sender does not have enough balance.');
        }
        if (e.code === 'same_account') {
          return fail(422, 'invalid_request', 'Sender and recipient must be different accounts.');
        }
        return fail(422, e.code, e.message);
      }
      throw e;
    }

    const row = await client.query(
      `SELECT t.*,
              fm.full_name AS from_member_name, tm.full_name AS to_member_name,
              fg.name AS from_group_name,       tg.name AS to_group_name
         FROM ntzs_transactions t
         LEFT JOIN members fm ON fm.id = t.from_member_id
         LEFT JOIN members tm ON tm.id = t.to_member_id
         LEFT JOIN groups  fg ON fg.id = t.from_group_id
         LEFT JOIN groups  tg ON tg.id = t.to_group_id
        WHERE t.id = $1`,
      [journalId],
    );

    return ok({
      ...serializeTransaction(row.rows[0]),
      sender_balance_tzs: fromBalance,
    }, undefined, { status: 201 });
  } finally {
    client.release();
  }
});
