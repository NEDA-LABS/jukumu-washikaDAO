import pool from '@/lib/db';
import { handle, ok, fail, pageMeta } from '@/lib/api/http';
import { serializeTransaction } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

const TYPES = new Set(['deposit', 'withdrawal', 'transfer', 'disbursement']);

/**
 * GET /api/v1/transactions
 * The nTZS money ledger across the platform.
 *
 * Query:
 *   group_id, member_id   filter to one party (either side of the transfer)
 *   type=deposit|withdrawal|transfer|disbursement
 *   purpose=deposit|withdrawal|contribution|disbursement|p2p|fee
 *   status
 *   since, until          ISO dates, filter on created_at
 *   limit, offset
 */
export const GET = handle('read', async (_req, { limit, offset, searchParams }) => {
  const groupId = searchParams.get('group_id');
  const memberId = searchParams.get('member_id');
  const type = searchParams.get('type');
  const purpose = searchParams.get('purpose');
  const status = searchParams.get('status');
  const since = searchParams.get('since');
  const until = searchParams.get('until');

  if (type && !TYPES.has(type)) {
    return fail(422, 'invalid_request', `\`type\` must be one of: ${[...TYPES].join(', ')}.`);
  }
  for (const [label, v] of [['since', since], ['until', until]] as const) {
    if (v && Number.isNaN(Date.parse(v))) {
      return fail(422, 'invalid_request', `\`${label}\` must be an ISO-8601 date.`);
    }
  }

  const where: string[] = [];
  const values: unknown[] = [];
  if (groupId) {
    values.push(Number(groupId));
    where.push(`(t.from_group_id = $${values.length} OR t.to_group_id = $${values.length})`);
  }
  if (memberId) {
    values.push(Number(memberId));
    where.push(`(t.from_member_id = $${values.length} OR t.to_member_id = $${values.length})`);
  }
  if (type) { values.push(type); where.push(`t.type = $${values.length}`); }
  if (purpose) { values.push(purpose); where.push(`t.purpose = $${values.length}`); }
  if (status) { values.push(status); where.push(`t.status = $${values.length}`); }
  if (since) { values.push(since); where.push(`t.created_at >= $${values.length}`); }
  if (until) { values.push(until); where.push(`t.created_at <= $${values.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const client = await pool.connect();
  try {
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS n FROM ntzs_transactions t ${clause}`, values,
    );
    const total = (countRes.rows[0] as { n: number }).n;

    const rows = await client.query(
      `SELECT t.*,
              fm.full_name AS from_member_name, tm.full_name AS to_member_name,
              fg.name AS from_group_name,       tg.name AS to_group_name
         FROM ntzs_transactions t
         LEFT JOIN members fm ON fm.id = t.from_member_id
         LEFT JOIN members tm ON tm.id = t.to_member_id
         LEFT JOIN groups  fg ON fg.id = t.from_group_id
         LEFT JOIN groups  tg ON tg.id = t.to_group_id
         ${clause}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    return ok(rows.rows.map(serializeTransaction), pageMeta(total, limit, offset));
  } finally {
    client.release();
  }
});
