import pool from '@/lib/db';
import { handleWithParams, ok, fail, pageMeta } from '@/lib/api/http';
import { serializeMember } from '@/lib/api/serialize';
import { ownsGroup } from '@/lib/api/scope';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/groups/{id}/members
 * Members of a group with their role and membership status.
 *
 * Query: role, status, limit, offset
 */
export const GET = handleWithParams<{ id: string }>('read', async (_req, { params, scope, limit, offset, searchParams }) => {
  const groupId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(groupId)) return fail(422, 'invalid_request', 'Group id must be numeric.');

  const role = searchParams.get('role');
  const status = searchParams.get('status');

  const where = ['gm.group_id = $1'];
  const values: unknown[] = [groupId];
  if (role) { values.push(role); where.push(`gm.role = $${values.length}`); }
  if (status) { values.push(status); where.push(`gm.status = $${values.length}`); }
  const clause = `WHERE ${where.join(' AND ')}`;

  const client = await pool.connect();
  try {
    // A group the caller does not own is indistinguishable from one that does
    // not exist — 404 rather than 403, so ids cannot be probed.
    if (!(await ownsGroup(client, scope, groupId))) {
      return fail(404, 'not_found', 'No group with that id.');
    }

    const countRes = await client.query(
      `SELECT COUNT(*)::int AS n FROM group_members gm ${clause}`, values,
    );
    const total = (countRes.rows[0] as { n: number }).n;

    const rows = await client.query(
      `SELECT m.id, m.full_name, m.username, m.avatar_url, m.location, m.status,
              m.business_name, m.business_type, m.created_at,
              gm.role, gm.status AS membership_status, gm.joined_date
         FROM group_members gm
         JOIN members m ON m.id = gm.member_id
         ${clause}
        ORDER BY gm.joined_date DESC NULLS LAST, m.id DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    return ok(rows.rows.map(m => serializeMember(m, { compact: true })), pageMeta(total, limit, offset));
  } finally {
    client.release();
  }
});
