import pool from '@/lib/db';
import { handleWithParams, ok, fail } from '@/lib/api/http';
import { serializeMember, serializeGroup } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/members/{id}
 * One member, with their group memberships and wallet balance.
 */
export const GET = handleWithParams<{ id: string }>('read', async (_req, { params }) => {
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id)) return fail(422, 'invalid_request', 'Member id must be numeric.');

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT m.id, m.full_name, m.username, m.avatar_url, m.location, m.status,
              m.business_name, m.business_type, m.business_description, m.created_at
         FROM members m WHERE m.id = $1 LIMIT 1`,
      [id],
    );
    if (res.rows.length === 0) return fail(404, 'not_found', 'No member with that id.');

    const groups = await client.query(
      `SELECT g.*, gm.role, gm.status AS membership_status, gm.joined_date,
              (SELECT COUNT(*)::int FROM group_members x
                WHERE x.group_id = g.id AND x.status = 'active') AS member_count
         FROM group_members gm
         JOIN groups g ON g.id = gm.group_id
        WHERE gm.member_id = $1
        ORDER BY gm.joined_date DESC NULLS LAST`,
      [id],
    );

    const wallet = await client.query(
      `SELECT balance_tzs FROM wallet_accounts
        WHERE owner_type = 'member' AND owner_id = $1 LIMIT 1`,
      [id],
    );

    const contributions = await client.query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::bigint AS paid_tzs,
              COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count
         FROM monthly_contributions WHERE member_id = $1`,
      [id],
    );
    const c = contributions.rows[0] as { paid_tzs: string; paid_count: number };

    return ok({
      ...serializeMember(res.rows[0]),
      business_description: (res.rows[0].business_description as string) ?? null,
      groups: groups.rows.map((g) => ({
        ...serializeGroup(g, { compact: true }),
        role: g.role as string,
        membership_status: g.membership_status as string,
      })),
      wallet: {
        balance_tzs: wallet.rows.length
          ? Math.round(Number((wallet.rows[0] as { balance_tzs: string }).balance_tzs))
          : 0,
        provisioned: wallet.rows.length > 0,
      },
      contributions: {
        total_paid_tzs: Number(c.paid_tzs),
        paid_count: c.paid_count,
      },
    });
  } finally {
    client.release();
  }
});
