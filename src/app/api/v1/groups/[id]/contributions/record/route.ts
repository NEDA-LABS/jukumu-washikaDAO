import pool from '@/lib/db';
import { handleWithParams, ok, fail } from '@/lib/api/http';
import { amountTzs } from '@/lib/api/money';
import { serializeContribution } from '@/lib/api/serialize';
import { ownsGroup } from '@/lib/api/scope';

export const dynamic = 'force-dynamic';

const STATUSES = new Set(['paid', 'pending', 'overdue']);

/**
 * POST /api/v1/groups/{id}/contributions/record
 * Record that a member paid their contribution for a period. This writes the
 * contribution ledger only — it does not move money. To move money as well,
 * call POST /api/v1/transfers with purpose "contribution".
 *
 * Body: { member_id, amount_tzs, period (YYYY-MM), status?, payment_method?, reference? }
 */
export const POST = handleWithParams<{ id: string }>('write', async (request, { params, scope }) => {
  const groupId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(groupId)) return fail(422, 'invalid_request', 'Group id must be numeric.');

  const body = await request.json().catch(() => null);
  const memberId = Number(body?.member_id);
  const amount = amountTzs(body?.amount_tzs, 1);
  const period = typeof body?.period === 'string' ? body.period : '';
  const status = body?.status ?? 'paid';
  const method = typeof body?.payment_method === 'string' ? body.payment_method : 'api';
  const reference = typeof body?.reference === 'string' ? body.reference : null;

  if (!Number.isFinite(memberId)) return fail(422, 'invalid_request', '`member_id` is required.');
  if (amount === null) return fail(422, 'invalid_request', '`amount_tzs` must be a positive whole number.');
  if (!/^\d{4}-\d{2}$/.test(period)) return fail(422, 'invalid_request', '`period` must look like YYYY-MM.');
  if (!STATUSES.has(status)) return fail(422, 'invalid_request', `\`status\` must be one of: ${[...STATUSES].join(', ')}.`);

  const client = await pool.connect();
  try {
    if (!(await ownsGroup(client, scope, groupId))) {
      return fail(404, 'not_found', 'No group with that id.');
    }

    const membership = await client.query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND member_id = $2`, [groupId, memberId],
    );
    if (membership.rows.length === 0) {
      return fail(404, 'not_found', 'That member does not belong to this group.');
    }

    const monthStart = `${period}-01`;
    const dupe = await client.query(
      `SELECT id FROM monthly_contributions
        WHERE group_id = $1 AND member_id = $2
          AND to_char(contribution_month, 'YYYY-MM') = $3
        LIMIT 1`,
      [groupId, memberId, period],
    );
    if (dupe.rows.length > 0) {
      return fail(409, 'already_recorded', 'A contribution for that member and period already exists.');
    }

    const inserted = await client.query(
      `INSERT INTO monthly_contributions
         (member_id, group_id, amount, contribution_month, payment_date, status, payment_method, payment_reference)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8)
       RETURNING *`,
      [memberId, groupId, amount, monthStart, status === 'paid' ? new Date() : null, status, method, reference],
    );

    const row = await client.query(
      `SELECT mc.*, m.full_name AS member_name
         FROM monthly_contributions mc LEFT JOIN members m ON m.id = mc.member_id
        WHERE mc.id = $1`,
      [(inserted.rows[0] as { id: number }).id],
    );

    return ok(serializeContribution(row.rows[0]), undefined, { status: 201 });
  } finally {
    client.release();
  }
});
