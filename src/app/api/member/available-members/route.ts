import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

/**
 * GET /api/member/available-members
 * Returns all members from groups the authenticated user belongs to (excluding self)
 */
export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    // Get the calling member's record
    const memberRes = await client.query(
      `SELECT id FROM members WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }
    const myMemberId = (memberRes.rows[0] as { id: number }).id;

    // Find all members in groups that the current user is also a member of
    const membersRes = await client.query(
      `
      SELECT DISTINCT
        m.id,
        m.full_name,
        m.email,
        m.phone
      FROM members m
      JOIN group_members gm ON gm.member_id = m.id
      WHERE gm.group_id IN (
        SELECT group_id FROM group_members WHERE member_id = $1 AND status = 'active'
      )
      AND m.id != $1
      AND gm.status = 'active'
      ORDER BY m.full_name ASC
      `,
      [myMemberId]
    );

    return NextResponse.json({
      success: true,
      members: membersRes.rows,
    });
  } catch (error) {
    console.error('Available members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
