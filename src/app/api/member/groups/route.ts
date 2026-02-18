import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    // Map authenticated user -> member profile
    let memberRes = await client.query(
      `
      SELECT id
      FROM members
      WHERE user_id = $1
      LIMIT 1
      `,
      [auth.userId]
    );

    // Self-healing fallback: link by email if user_id not set
    if (memberRes.rows.length === 0) {
      const userRes = await client.query(
        'SELECT email FROM users WHERE id = $1 LIMIT 1',
        [auth.userId]
      );
      if (userRes.rows.length > 0) {
        const userEmail = (userRes.rows[0] as { email: string }).email;
        await client.query(
          `UPDATE members SET user_id = $1
           WHERE user_id IS NULL
             AND lower(email) = lower($2)
             AND NOT EXISTS (SELECT 1 FROM members m2 WHERE m2.user_id = $1)`,
          [auth.userId, userEmail]
        );
        memberRes = await client.query(
          `SELECT id FROM members WHERE user_id = $1 LIMIT 1`,
          [auth.userId]
        );
      }
    }

    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }

    const memberId = memberRes.rows[0].id as number;

    // List all active memberships for this member
    const groupsRes = await client.query(
      `
      SELECT
        g.id,
        g.name,
        g.founded_date,
        g.monthly_contribution,
        g.status,
        gm.role AS member_role,
        gm.joined_date,
        gm.status AS membership_status
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.member_id = $1
      ORDER BY g.created_at DESC NULLS LAST, g.id DESC
      `,
      [memberId]
    );

    return NextResponse.json({
      success: true,
      memberId,
      groups: groupsRes.rows
    });
  } catch (error) {
    console.error('Member groups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
