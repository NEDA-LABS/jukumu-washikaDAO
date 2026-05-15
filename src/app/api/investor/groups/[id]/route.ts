import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  let client;
  try {
    client = await pool.connect();

    const groupRes = await client.query(
      `SELECT
          g.id, g.name, g.description, g.status, g.founded_date,
          g.monthly_contribution, g.total_investment, g.created_at,
          g.voting_threshold_numerator, g.voting_threshold_denominator,
          g.ntzs_user_id,
          u.full_name AS leader_name,
          (
            SELECT COUNT(*) FROM group_members gm
            WHERE gm.group_id = g.id AND gm.status = 'active'
          ) AS member_count,
          (
            SELECT COUNT(*) FROM group_proposals p
            WHERE p.group_id = g.id
          ) AS total_proposals,
          (
            SELECT COUNT(*) FROM group_proposals p
            WHERE p.group_id = g.id AND p.status = 'closed'
              AND EXISTS (
                SELECT 1 FROM group_proposal_votes v
                WHERE v.proposal_id = p.id AND v.vote = 'yes'
              )
          ) AS passed_proposals,
          (
            SELECT COUNT(*) FROM group_proposals p
            WHERE p.group_id = g.id AND p.payment_status = 'completed'
          ) AS executed_proposals,
          (
            SELECT COUNT(*) FROM group_proposals p
            WHERE p.group_id = g.id AND p.status = 'open'
          ) AS open_proposals,
          (
            SELECT MAX(t.created_at) FROM ntzs_transactions t
            WHERE t.from_group_id = g.id OR t.to_group_id = g.id
          ) AS last_activity,
          (
            SELECT COUNT(*) FROM ntzs_transactions t
            WHERE (t.from_group_id = g.id OR t.to_group_id = g.id)
              AND t.created_at >= NOW() - INTERVAL '90 days'
          ) AS transactions_90d,
          (
            SELECT COALESCE(SUM(t.amount_tzs), 0) FROM ntzs_transactions t
            WHERE (t.from_group_id = g.id OR t.to_group_id = g.id)
              AND t.created_at >= NOW() - INTERVAL '90 days'
          ) AS volume_90d_tzs
        FROM groups g
        LEFT JOIN users u ON u.id = g.leader_id
        WHERE g.id = $1
        LIMIT 1`,
      [groupId]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const group = groupRes.rows[0] as Record<string, unknown>;

    // Prodcast projects from this group
    const projectsRes = await client.query(
      `SELECT p.id, p.title, p.description, p.metadata, p.funded_at, p.status
       FROM group_proposals p
       WHERE p.group_id = $1 AND p.proposal_type = 'prodcast'
       ORDER BY p.funded_at DESC NULLS LAST, p.created_at DESC
       LIMIT 10`,
      [groupId]
    );

    // Leadership roster
    const leadershipRes = await client.query(
      `SELECT m.full_name, gm.role
       FROM group_members gm
       JOIN members m ON m.id = gm.member_id
       WHERE gm.group_id = $1
         AND gm.status = 'active'
         AND gm.role IN ('leader','mwenyekiti','katibu','mwekahazina')
       ORDER BY gm.role
       LIMIT 6`,
      [groupId]
    );

    return NextResponse.json({
      success: true,
      group,
      projects: projectsRes.rows,
      leadership: leadershipRes.rows,
    });
  } catch (error) {
    console.error('Investor group detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client?.release();
  }
}
