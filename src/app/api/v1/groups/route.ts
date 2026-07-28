import pool from '@/lib/db';
import { handle, ok, fail, pageMeta } from '@/lib/api/http';
import { serializeGroup } from '@/lib/api/serialize';
import { generateUniqueGroupCode } from '@/lib/group-code';
import { owned, stamp } from '@/lib/api/scope';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/groups
 * List savings groups.
 *
 * Query: status, q (name search), limit, offset
 */
export const GET = handle('read', async (_req, { scope, limit, offset, searchParams }) => {
  const status = searchParams.get('status');
  const q = searchParams.get('q');

  const values: unknown[] = [];
  const where: string[] = [owned(scope, 'g', values)];
  if (status) { values.push(status); where.push(`g.status = $${values.length}`); }
  if (q) { values.push(`%${q}%`); where.push(`g.name ILIKE $${values.length}`); }
  const clause = `WHERE ${where.join(' AND ')}`;

  const client = await pool.connect();
  try {
    const countRes = await client.query(`SELECT COUNT(*)::int AS n FROM groups g ${clause}`, values);
    const total = (countRes.rows[0] as { n: number }).n;

    const rows = await client.query(
      `SELECT g.*,
              u.full_name AS leader_name,
              (SELECT COUNT(*)::int FROM group_members gm
                WHERE gm.group_id = g.id AND gm.status = 'active') AS member_count,
              COALESCE((SELECT wa.balance_tzs FROM wallet_accounts wa
                         WHERE wa.owner_type = 'group' AND wa.owner_id = g.id), 0) AS treasury_balance_tzs
         FROM groups g
         LEFT JOIN users u ON u.id = g.leader_id
         ${clause}
        ORDER BY g.created_at DESC NULLS LAST, g.id DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    return ok(rows.rows.map(g => serializeGroup(g, { compact: true })), pageMeta(total, limit, offset));
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/groups
 * Create a savings group. Requires the `write` scope.
 *
 * Identify the leader with `leader_member_id` (a member you created through
 * POST /api/v1/members/create) or, for members who also hold a WashikaDAU
 * login, `leader_user_id`. Either way the member must be one of yours.
 *
 * Body: { name, monthly_contribution_tzs, leader_member_id | leader_user_id,
 *         contribution_frequency?, voting_numerator?, voting_denominator? }
 */
export const POST = handle('write', async (request, { scope }) => {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const amount = Number(body?.monthly_contribution_tzs);
  const leaderMemberId = body?.leader_member_id != null ? Number(body.leader_member_id) : null;
  const leaderUserId = body?.leader_user_id != null ? Number(body.leader_user_id) : null;
  const frequency = body?.contribution_frequency ?? 'monthly';
  const num = Number(body?.voting_numerator ?? 3);
  const den = Number(body?.voting_denominator ?? 5);

  if (!name) return fail(422, 'invalid_request', '`name` is required.');
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail(422, 'invalid_request', '`monthly_contribution_tzs` must be a positive number.');
  }
  if (!Number.isFinite(leaderMemberId) && !Number.isFinite(leaderUserId)) {
    return fail(422, 'invalid_request', 'Provide `leader_member_id` (or `leader_user_id`).');
  }
  if (!['monthly', 'weekly'].includes(frequency)) {
    return fail(422, 'invalid_request', '`contribution_frequency` must be "monthly" or "weekly".');
  }
  if (!Number.isFinite(num) || !Number.isFinite(den) || num < 1 || den < 1 || num > den) {
    return fail(422, 'invalid_request', 'Voting threshold must satisfy 1 <= numerator <= denominator.');
  }

  const client = await pool.connect();
  try {
    // The leader must be one of the caller's own members — a partner cannot
    // put someone else's person in charge of a group they created.
    const byMember = Number.isFinite(leaderMemberId);
    const leaderValues: unknown[] = [byMember ? leaderMemberId : leaderUserId];
    const memberRes = await client.query(
      `SELECT id, user_id FROM members
        WHERE ${byMember ? 'id' : 'user_id'} = $1
          AND ${owned(scope, 'members', leaderValues)} LIMIT 1`,
      leaderValues,
    );
    if (memberRes.rows.length === 0) {
      return fail(404, 'leader_not_found',
        `No member you own matches that ${byMember ? 'leader_member_id' : 'leader_user_id'}.`);
    }
    const leader = memberRes.rows[0] as { id: number; user_id: number | null };
    const memberId = leader.id;
    // groups.leader_id points at a platform login; members onboarded purely
    // through the API have none, and the group_members row below is what
    // actually records leadership.
    const leaderLoginId = leader.user_id;

    // Name collisions only matter inside a tenant; two partners may each have
    // a "Umoja" group, and neither should learn the other exists.
    const dupeValues: unknown[] = [name];
    const dupe = await client.query(
      `SELECT id FROM groups
        WHERE lower(name) = lower($1) AND ${owned(scope, 'groups', dupeValues)} LIMIT 1`,
      dupeValues,
    );
    if (dupe.rows.length > 0) {
      return fail(409, 'group_exists', 'A group with that name already exists.');
    }

    const code = await generateUniqueGroupCode(client);

    await client.query('BEGIN');
    const created = await client.query(
      `INSERT INTO groups (name, leader_id, founded_date, monthly_contribution, status,
                           voting_threshold_numerator, voting_threshold_denominator,
                           group_code, join_policy, contribution_frequency, partner_id)
       VALUES ($1, $2, CURRENT_DATE, $3, 'active', $4, $5, $6, 'invite_only', $7, $8)
       RETURNING *`,
      [name, leaderLoginId, Math.round(amount), num, den, code, frequency, stamp(scope)],
    );
    const group = created.rows[0] as { id: number };

    await client.query(
      `INSERT INTO group_members (group_id, member_id, joined_date, role, status)
       VALUES ($1, $2, CURRENT_DATE, 'leader', 'active')`,
      [group.id, memberId],
    );
    await client.query('COMMIT');

    return ok(serializeGroup({ ...created.rows[0], member_count: 1 }), undefined, { status: 201 });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});
