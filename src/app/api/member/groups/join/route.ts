import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { groupCode, message } = body || {};

  if (!groupCode) {
    return NextResponse.json({ error: 'groupCode ni lazima.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Resolve member
    const memberRes = await client.query(
      `SELECT id FROM members WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Wasifu wa mwanachama haujapatikana.' }, { status: 404 });
    }
    const memberId = (memberRes.rows[0] as { id: number }).id;

    // Resolve group by code
    const groupRes = await client.query(
      `SELECT id, name, join_policy FROM groups WHERE group_code = $1 AND status = 'active' LIMIT 1`,
      [String(groupCode).trim().toUpperCase()]
    );
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Hakuna kundi lenye nambari hiyo.' }, { status: 404 });
    }
    const group = groupRes.rows[0] as { id: number; name: string; join_policy: string };

    // Check if already an active member
    const existingMembership = await client.query(
      `SELECT status FROM group_members WHERE group_id = $1 AND member_id = $2 LIMIT 1`,
      [group.id, memberId]
    );
    if (existingMembership.rows.length > 0) {
      const st = (existingMembership.rows[0] as { status: string }).status;
      if (st === 'active') {
        return NextResponse.json({ error: 'Tayari wewe ni mwanachama wa kundi hili.' }, { status: 400 });
      }
    }

    // Check for existing pending join request
    const existingRequest = await client.query(
      `SELECT id FROM join_requests WHERE group_id = $1 AND member_id = $2 AND status = 'pending' LIMIT 1`,
      [group.id, memberId]
    );
    if (existingRequest.rows.length > 0) {
      return NextResponse.json({ error: 'Ombi lako la kujiunga tayari lipo na linasubiri idhini.' }, { status: 400 });
    }

    if (group.join_policy === 'open') {
      // Auto-join immediately
      await client.query(
        `INSERT INTO group_members (group_id, member_id, joined_date, role, status)
         VALUES ($1, $2, CURRENT_DATE, 'member', 'active')
         ON CONFLICT DO NOTHING`,
        [group.id, memberId]
      );
      return NextResponse.json({
        success: true,
        joined: true,
        message: `Umejiunga na kundi "${group.name}" kwa mafanikio!`,
        groupId: group.id,
      });
    }

    // invite_only: create a join request
    await client.query(
      `INSERT INTO join_requests (group_id, member_id, message, status, created_at)
       VALUES ($1, $2, $3, 'pending', NOW())`,
      [group.id, memberId, message || null]
    );
    return NextResponse.json({
      success: true,
      joined: false,
      message: `Ombi lako la kujiunga kundi "${group.name}" limetumwa. Subiri idhini ya kiongozi.`,
      groupId: group.id,
    });
  } finally {
    client.release();
  }
}
