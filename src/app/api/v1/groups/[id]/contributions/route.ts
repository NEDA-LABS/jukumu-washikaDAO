import pool from '@/lib/db';
import { handleWithParams, ok, fail, pageMeta } from '@/lib/api/http';
import { serializeContribution } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/groups/{id}/contributions
 * Who has paid, and who hasn't — the contribution ledger for a group.
 *
 * Query:
 *   period=YYYY-MM   restrict to one contribution month (default: all)
 *   status=paid|pending|overdue
 *   member_id
 *   include_unpaid=true   also return the roster of members with no
 *                         contribution row for `period` (requires period)
 *   limit, offset
 */
export const GET = handleWithParams<{ id: string }>('read', async (_req, { params, limit, offset, searchParams }) => {
  const groupId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(groupId)) return fail(422, 'invalid_request', 'Group id must be numeric.');

  const period = searchParams.get('period');
  const status = searchParams.get('status');
  const memberId = searchParams.get('member_id');
  const includeUnpaid = searchParams.get('include_unpaid') === 'true';

  if (period && !/^\d{4}-\d{2}$/.test(period)) {
    return fail(422, 'invalid_request', '`period` must look like YYYY-MM.');
  }
  if (includeUnpaid && !period) {
    return fail(422, 'invalid_request', '`include_unpaid=true` requires a `period`.');
  }

  const where = ['mc.group_id = $1'];
  const values: unknown[] = [groupId];
  if (period) { values.push(period); where.push(`to_char(mc.contribution_month, 'YYYY-MM') = $${values.length}`); }
  if (status) { values.push(status); where.push(`mc.status = $${values.length}`); }
  if (memberId) { values.push(Number(memberId)); where.push(`mc.member_id = $${values.length}`); }
  const clause = `WHERE ${where.join(' AND ')}`;

  const client = await pool.connect();
  try {
    const exists = await client.query(`SELECT 1 FROM groups WHERE id = $1`, [groupId]);
    if (exists.rows.length === 0) return fail(404, 'not_found', 'No group with that id.');

    const countRes = await client.query(
      `SELECT COUNT(*)::int AS n FROM monthly_contributions mc ${clause}`, values,
    );
    const total = (countRes.rows[0] as { n: number }).n;

    const rows = await client.query(
      `SELECT mc.*, m.full_name AS member_name
         FROM monthly_contributions mc
         LEFT JOIN members m ON m.id = mc.member_id
         ${clause}
        ORDER BY mc.payment_date DESC NULLS LAST, mc.id DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    const summary = await client.query(
      `SELECT COALESCE(SUM(mc.amount) FILTER (WHERE mc.status = 'paid'), 0)::bigint AS paid_tzs,
              COUNT(*) FILTER (WHERE mc.status = 'paid')::int AS paid_count,
              COUNT(*) FILTER (WHERE mc.status <> 'paid')::int AS unpaid_count
         FROM monthly_contributions mc ${clause}`,
      values,
    );
    const s = summary.rows[0] as { paid_tzs: string; paid_count: number; unpaid_count: number };

    // Roster of active members with no contribution row for this period.
    let unpaidMembers;
    if (includeUnpaid) {
      const res = await client.query(
        `SELECT m.id, m.full_name, m.username, m.avatar_url
           FROM group_members gm
           JOIN members m ON m.id = gm.member_id
          WHERE gm.group_id = $1 AND gm.status = 'active'
            AND NOT EXISTS (
              SELECT 1 FROM monthly_contributions mc
               WHERE mc.group_id = gm.group_id
                 AND mc.member_id = gm.member_id
                 AND to_char(mc.contribution_month, 'YYYY-MM') = $2
                 AND mc.status = 'paid'
            )
          ORDER BY m.full_name`,
        [groupId, period],
      );
      unpaidMembers = res.rows.map((r) => ({
        id: r.id as number,
        full_name: (r.full_name as string) ?? null,
        username: (r.username as string) ?? null,
        avatar_url: (r.avatar_url as string) ?? null,
      }));
    }

    return ok(rows.rows.map(serializeContribution), {
      ...pageMeta(total, limit, offset),
      period: period ?? null,
      summary: {
        paid_tzs: Number(s.paid_tzs),
        paid_count: s.paid_count,
        unpaid_count: s.unpaid_count,
      },
      ...(unpaidMembers ? { unpaid_members: unpaidMembers } : {}),
    });
  } finally {
    client.release();
  }
});
