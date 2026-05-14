import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

/**
 * GET /api/investor/groups
 * Authenticated — returns all active groups with financial and member stats.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let client;
  try {
    client = await pool.connect();

    const res = await client.query(`
      SELECT
        g.id,
        g.name,
        g.founded_date,
        g.total_investment,
        g.monthly_contribution,
        g.status,
        g.created_at,
        u.full_name AS leader_name,
        (
          SELECT COUNT(*)
          FROM group_members gm
          WHERE gm.group_id = g.id AND gm.status = 'active'
        ) AS member_count,
        (
          SELECT COUNT(*)
          FROM group_proposals p
          WHERE p.group_id = g.id AND p.proposal_type = 'prodast' AND p.funded_at IS NOT NULL
        ) AS prodast_count,
        (
          SELECT COALESCE(SUM(i.amount), 0)
          FROM investments i
          WHERE i.group_id = g.id AND i.status = 'active'
        ) AS total_funded
      FROM groups g
      LEFT JOIN users u ON u.id = g.leader_id
      WHERE g.status = 'active'
      ORDER BY g.created_at DESC
      LIMIT 200
    `);

    return NextResponse.json({ success: true, groups: res.rows });
  } catch (error) {
    console.error('Investor groups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client?.release();
  }
}
