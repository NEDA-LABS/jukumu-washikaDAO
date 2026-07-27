import pool from '@/lib/db';
import { handleWithParams, ok, fail } from '@/lib/api/http';
import { serializeGroup } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/groups/{id}
 * A single group, including treasury balance and aggregate contribution totals.
 * `{id}` accepts the numeric id or the human group code (e.g. JKM-A3F9K2).
 */
export const GET = handleWithParams<{ id: string }>('read', async (_req, { params }) => {
  const numeric = Number.parseInt(params.id, 10);
  const byCode = !Number.isFinite(numeric);

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT g.*,
              u.full_name AS leader_name,
              (SELECT COUNT(*)::int FROM group_members gm
                WHERE gm.group_id = g.id AND gm.status = 'active') AS member_count,
              COALESCE((SELECT wa.balance_tzs FROM wallet_accounts wa
                         WHERE wa.owner_type = 'group' AND wa.owner_id = g.id), 0) AS treasury_balance_tzs
         FROM groups g
         LEFT JOIN users u ON u.id = g.leader_id
        WHERE ${byCode ? 'upper(g.group_code) = upper($1)' : 'g.id = $1'}
        LIMIT 1`,
      [byCode ? params.id : numeric],
    );
    if (res.rows.length === 0) return fail(404, 'not_found', 'No group with that id or code.');

    const group = res.rows[0] as { id: number };

    const totals = await client.query(
      `SELECT
         COALESCE(SUM(amount_tzs) FILTER (
           WHERE to_group_id = $1 AND status IN ('completed','minted','success','successful')
         ), 0)::bigint AS collected,
         COALESCE(SUM(amount_tzs) FILTER (
           WHERE from_group_id = $1 AND status IN ('completed','minted','success','successful')
         ), 0)::bigint AS disbursed,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '90 days')::int AS tx_90d
       FROM ntzs_transactions
       WHERE to_group_id = $1 OR from_group_id = $1`,
      [group.id],
    );
    const t = totals.rows[0] as { collected: string; disbursed: string; tx_90d: number };

    const proposals = await client.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'open')::int AS open,
              COUNT(*) FILTER (WHERE funded_at IS NOT NULL)::int AS funded
         FROM group_proposals WHERE group_id = $1`,
      [group.id],
    ).catch(() => ({ rows: [{ total: 0, open: 0, funded: 0 }] }));

    return ok({
      ...serializeGroup(res.rows[0]),
      totals: {
        collected_tzs: Number(t.collected),
        disbursed_tzs: Number(t.disbursed),
        transactions_90d: t.tx_90d,
      },
      proposals: proposals.rows[0],
    });
  } finally {
    client.release();
  }
});
