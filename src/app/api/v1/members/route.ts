import pool from '@/lib/db';
import { handle, ok, pageMeta } from '@/lib/api/http';
import { serializeMember } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/members
 * Platform members.
 *
 * Query: q (name/username search), status, group_id, has_business=true,
 *        limit, offset
 *
 * Contact details (phone, email, national ID) are deliberately never
 * returned — the public API exposes directory data, not PII.
 */
export const GET = handle('read', async (_req, { limit, offset, searchParams }) => {
  const q = searchParams.get('q');
  const status = searchParams.get('status');
  const groupId = searchParams.get('group_id');
  const hasBusiness = searchParams.get('has_business') === 'true';

  const where: string[] = [];
  const values: unknown[] = [];
  const joins: string[] = [];

  if (q) {
    values.push(`%${q}%`);
    where.push(`(m.full_name ILIKE $${values.length} OR m.username ILIKE $${values.length})`);
  }
  if (status) { values.push(status); where.push(`m.status = $${values.length}`); }
  if (groupId) {
    values.push(Number(groupId));
    joins.push(`JOIN group_members gm ON gm.member_id = m.id AND gm.group_id = $${values.length}`);
  }
  if (hasBusiness) {
    where.push(`COALESCE(NULLIF(TRIM(m.business_name), ''), NULLIF(TRIM(m.business_type), '')) IS NOT NULL`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const joinSql = joins.join(' ');

  const client = await pool.connect();
  try {
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS n FROM members m ${joinSql} ${clause}`, values,
    );
    const total = (countRes.rows[0] as { n: number }).n;

    const rows = await client.query(
      `SELECT m.id, m.full_name, m.username, m.avatar_url, m.location, m.status,
              m.business_name, m.business_type, m.created_at
         FROM members m ${joinSql} ${clause}
        ORDER BY m.created_at DESC NULLS LAST, m.id DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    return ok(rows.rows.map(m => serializeMember(m, { compact: true })), pageMeta(total, limit, offset));
  } finally {
    client.release();
  }
});
