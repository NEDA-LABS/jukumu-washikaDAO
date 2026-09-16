import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureHarambeeSchema } from '@/lib/harambee';

export const runtime = 'nodejs';

/**
 * Every collection on the platform, for oversight.
 *
 * Money raised is settled money only; what is still in flight is reported
 * beside it rather than inside it. Contributor phone numbers are not returned
 * — an administrator needs to see that a collection is real and where its
 * money goes, not the personal details of everyone who gave to it.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = await pool.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [auth.userId]);
  if ((role.rows[0] as { role?: string } | undefined)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureHarambeeSchema();
  try {
    const res = await pool.query(`
      SELECT h.id, h.code, h.title, h.kind, h.beneficiary, h.target_tzs, h.deadline,
             h.status, h.created_at, h.closed_at,
             m.full_name AS organiser_name, g.name AS group_name,
             COALESCE((SELECT SUM(c.amount_tzs) FILTER (WHERE c.status = 'settled')
                         FROM harambee_contributions c WHERE c.harambee_id = h.id), 0)::bigint AS raised_tzs,
             COALESCE((SELECT SUM(c.amount_tzs) FILTER (WHERE c.status NOT IN ('settled','failed'))
                         FROM harambee_contributions c WHERE c.harambee_id = h.id), 0)::bigint AS pending_tzs,
             (SELECT count(*) FILTER (WHERE c.status = 'settled')
                FROM harambee_contributions c WHERE c.harambee_id = h.id)::int AS contributors
        FROM harambees h
        LEFT JOIN members m ON m.id = h.organiser_member_id
        LEFT JOIN groups g ON g.id = h.group_id
       ORDER BY h.created_at DESC
       LIMIT 300
    `);
    const totals = await pool.query(`
      SELECT COUNT(*)::int AS pools,
             COUNT(*) FILTER (WHERE status = 'open')::int AS open_pools,
             COALESCE((SELECT SUM(amount_tzs) FROM harambee_contributions WHERE status = 'settled'), 0)::bigint AS raised,
             (SELECT count(*) FROM harambee_contributions WHERE status = 'settled')::int AS contributions
        FROM harambees
    `);
    const t = totals.rows[0] as { pools: number; open_pools: number; raised: string; contributions: number };
    return NextResponse.json({
      harambees: res.rows,
      totals: {
        pools: t.pools, openPools: t.open_pools,
        raisedTzs: Number(t.raised), contributions: t.contributions,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[admin/harambees]', error);
    return NextResponse.json({ error: 'Could not load collections' }, { status: 500 });
  }
}
