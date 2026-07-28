import pool from '@/lib/db';
import { handleWithParams, ok, fail } from '@/lib/api/http';
import { serializeMember } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

const ROLES = new Set(['leader', 'mwenyekiti', 'katibu', 'mwekahazina', 'mwanachama']);

/**
 * POST /api/v1/groups/{id}/members/add
 * Add an existing member to a group.
 *
 * Body: { member_id, role?, status? }
 */
export const POST = handleWithParams<{ id: string }>('write', async (request, { params }) => {
  const groupId = Number.parseInt(params.id, 10);
  if (!Number.isFinite(groupId)) return fail(422, 'invalid_request', 'Group id must be numeric.');

  const body = await request.json().catch(() => null);
  const memberId = Number(body?.member_id);
  const role = body?.role ?? 'mwanachama';
  const status = body?.status ?? 'active';

  if (!Number.isFinite(memberId)) return fail(422, 'invalid_request', '`member_id` is required.');
  if (!ROLES.has(role)) return fail(422, 'invalid_request', `\`role\` must be one of: ${[...ROLES].join(', ')}.`);

  const client = await pool.connect();
  try {
    const group = await client.query(`SELECT 1 FROM groups WHERE id = $1`, [groupId]);
    if (group.rows.length === 0) return fail(404, 'not_found', 'No group with that id.');

    const member = await client.query(`SELECT 1 FROM members WHERE id = $1`, [memberId]);
    if (member.rows.length === 0) return fail(404, 'not_found', 'No member with that id.');

    const dupe = await client.query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND member_id = $2`, [groupId, memberId],
    );
    if (dupe.rows.length > 0) {
      return fail(409, 'already_member', 'That member already belongs to this group.');
    }

    await client.query(
      `INSERT INTO group_members (group_id, member_id, joined_date, role, status)
       VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
      [groupId, memberId, role, status],
    );

    const row = await client.query(
      `SELECT m.id, m.full_name, m.username, m.avatar_url, m.location, m.status,
              m.business_name, m.business_type, m.created_at,
              gm.role, gm.status AS membership_status, gm.joined_date
         FROM group_members gm JOIN members m ON m.id = gm.member_id
        WHERE gm.group_id = $1 AND gm.member_id = $2`,
      [groupId, memberId],
    );

    return ok(serializeMember(row.rows[0], { compact: true }), undefined, { status: 201 });
  } finally {
    client.release();
  }
});
