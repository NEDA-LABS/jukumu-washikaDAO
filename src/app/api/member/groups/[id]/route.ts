import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const membershipRes = await client.query(
      `
      SELECT gm.member_id, gm.role, gm.status
      FROM group_members gm
      JOIN members m ON m.id = gm.member_id
      WHERE m.user_id = $1
        AND gm.group_id = $2
      LIMIT 1
      `,
      [auth.userId, groupId]
    );

    if (membershipRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const membership = membershipRes.rows[0] as {
      member_id: number;
      role: string;
      status: string;
    };

    const groupRes = await client.query(
      `
      SELECT
        g.id,
        g.name,
        g.founded_date,
        g.total_investment,
        g.monthly_contribution,
        g.status,
        g.created_at,
        g.group_code,
        g.join_policy,
        u.full_name AS leader_name,
        (SELECT COUNT(*)::int FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.status = 'active') AS member_count
      FROM groups g
      LEFT JOIN users u ON u.id = g.leader_id
      WHERE g.id = $1
      LIMIT 1
      `,
      [groupId]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      membership,
      group: groupRes.rows[0]
    });
  } catch (error) {
    console.error('Member group details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
