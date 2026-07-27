import pool from '@/lib/db';
import { handle, ok, fail, pageMeta } from '@/lib/api/http';
import { serializeGroup } from '@/lib/api/serialize';
import { generateUniqueGroupCode } from '@/lib/group-code';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/groups
 * List savings groups.
 *
 * Query: status, q (name search), limit, offset
 */
export const GET = handle('read', async (_req, { limit, offset, searchParams }) => {
  const status = searchParams.get('status');
  const q = searchParams.get('q');

  const where: string[] = [];
  const values: unknown[] = [];
  if (status) { values.push(status); where.push(`g.status = $${values.length}`); }
  if (q) { values.push(`%${q}%`); where.push(`g.name ILIKE $${values.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

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
 * Body: { name, monthly_contribution_tzs, leader_user_id,
 *         contribution_frequency?, voting_numerator?, voting_denominator? }
 */
export const POST = handle('write', async (request) => {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const amount = Number(body?.monthly_contribution_tzs);
  const leaderUserId = Number(body?.leader_user_id);
  const frequency = body?.contribution_frequency ?? 'monthly';
  const num = Number(body?.voting_numerator ?? 3);
  const den = Number(body?.voting_denominator ?? 5);

  if (!name) return fail(422, 'invalid_request', '`name` is required.');
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail(422, 'invalid_request', '`monthly_contribution_tzs` must be a positive number.');
  }
  if (!Number.isFinite(leaderUserId)) {
    return fail(422, 'invalid_request', '`leader_user_id` is required and must be a user id.');
  }
  if (!['monthly', 'weekly'].includes(frequency)) {
    return fail(422, 'invalid_request', '`contribution_frequency` must be "monthly" or "weekly".');
  }
  if (!Number.isFinite(num) || !Number.isFinite(den) || num < 1 || den < 1 || num > den) {
    return fail(422, 'invalid_request', 'Voting threshold must satisfy 1 <= numerator <= denominator.');
  }

  const client = await pool.connect();
  try {
    const memberRes = await client.query(
      `SELECT id FROM members WHERE user_id = $1 LIMIT 1`, [leaderUserId],
    );
    if (memberRes.rows.length === 0) {
      return fail(404, 'leader_not_found', 'No member profile exists for that leader_user_id.');
    }
    const memberId = (memberRes.rows[0] as { id: number }).id;

    const dupe = await client.query(`SELECT id FROM groups WHERE lower(name) = lower($1) LIMIT 1`, [name]);
    if (dupe.rows.length > 0) {
      return fail(409, 'group_exists', 'A group with that name already exists.');
    }

    const code = await generateUniqueGroupCode(client);

    await client.query('BEGIN');
    const created = await client.query(
      `INSERT INTO groups (name, leader_id, founded_date, monthly_contribution, status,
                           voting_threshold_numerator, voting_threshold_denominator,
                           group_code, join_policy, contribution_frequency)
       VALUES ($1, $2, CURRENT_DATE, $3, 'active', $4, $5, $6, 'invite_only', $7)
       RETURNING *`,
      [name, leaderUserId, Math.round(amount), num, den, code, frequency],
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
