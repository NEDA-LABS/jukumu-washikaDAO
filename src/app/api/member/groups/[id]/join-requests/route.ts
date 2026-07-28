import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const LEADERSHIP_ROLES = new Set(['leader', 'mwenyekiti', 'katibu', 'mwekahazina']);

/**
 * Join requests scoped to one group, reviewable by that group's own
 * leadership. Previously only a platform admin could action these, which
 * meant a group leader had to ask head office to let someone in.
 */
async function leadershipOf(client: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }, userId: number, groupId: number) {
  const res = await client.query(
    `SELECT gm.member_id, gm.role
       FROM group_members gm
       JOIN members m ON m.id = gm.member_id
      WHERE m.user_id = $1 AND gm.group_id = $2 AND gm.status = 'active'
      LIMIT 1`,
    [userId, groupId],
  );
  const row = res.rows[0] as { member_id: number; role: string } | undefined;
  if (!row) return null;
  return { ...row, isLeader: LEADERSHIP_ROLES.has(row.role) };
}

/** GET — pending (and recently reviewed) requests for this group. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });

  const client = await pool.connect();
  try {
    const membership = await leadershipOf(client, auth.userId, groupId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const res = await client.query(
      `SELECT jr.id, jr.member_id, jr.message, jr.status, jr.created_at, jr.reviewed_at,
              m.full_name, m.phone, m.location, m.business_name, m.avatar_url
         FROM join_requests jr
         JOIN members m ON m.id = jr.member_id
        WHERE jr.group_id = $1
        ORDER BY (jr.status = 'pending') DESC, jr.created_at DESC
        LIMIT 50`,
      [groupId],
    );

    return NextResponse.json({
      requests: res.rows,
      isLeader: membership.isLeader,
      pendingCount: res.rows.filter((r) => (r as { status: string }).status === 'pending').length,
    });
  } catch (error) {
    console.error('[group join-requests] list', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * PUT — approve or reject. Leadership only.
 * Body: { requestId, action: 'approve' | 'reject', notes? }
 */
export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const requestId = Number(body?.requestId);
  const action = body?.action;
  const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 500) : null;

  if (!Number.isFinite(requestId)) return NextResponse.json({ error: 'requestId is required.' }, { status: 400 });
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const membership = await leadershipOf(client, auth.userId, groupId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!membership.isLeader) {
      return NextResponse.json({ error: 'Only group leadership can review join requests.' }, { status: 403 });
    }

    // Scope the lookup to THIS group so a leader can never action a request
    // belonging to a group they don't lead.
    const reqRes = await client.query(
      `SELECT * FROM join_requests WHERE id = $1 AND group_id = $2 AND status = 'pending' LIMIT 1`,
      [requestId, groupId],
    );
    if (reqRes.rows.length === 0) {
      return NextResponse.json({ error: 'Request not found or already reviewed.' }, { status: 404 });
    }
    const jr = reqRes.rows[0] as { id: number; member_id: number; group_id: number };

    await client.query('BEGIN');
    try {
      if (action === 'approve') {
        const dupe = await client.query(
          `SELECT 1 FROM group_members WHERE group_id = $1 AND member_id = $2`,
          [groupId, jr.member_id],
        );
        if (dupe.rows.length === 0) {
          await client.query(
            `INSERT INTO group_members (group_id, member_id, joined_date, role, status)
             VALUES ($1, $2, CURRENT_DATE, 'member', 'active')`,
            [groupId, jr.member_id],
          );
        }
      }
      await client.query(
        `UPDATE join_requests
            SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, review_notes = $3
          WHERE id = $4`,
        [action === 'approve' ? 'approved' : 'rejected', auth.userId, notes, requestId],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }

    // Tell the applicant either way — best-effort, never blocks the decision.
    try {
      const g = await client.query(`SELECT name FROM groups WHERE id = $1`, [groupId]);
      const u = await client.query(`SELECT user_id FROM members WHERE id = $1`, [jr.member_id]);
      const groupName = (g.rows[0] as { name?: string } | undefined)?.name ?? 'the group';
      const applicantUserId = (u.rows[0] as { user_id?: number } | undefined)?.user_id;
      if (applicantUserId) {
        const approved = action === 'approve';
        await notify(client, applicantUserId, {
          title: approved ? 'Ombi lako limekubaliwa' : 'Ombi lako halikukubaliwa',
          message: approved
            ? `Karibu ${groupName}! Sasa wewe ni mwanachama.`
            : `Ombi lako la kujiunga na ${groupName} halikukubaliwa.`,
          titleEn: approved ? 'Join request approved' : 'Join request declined',
          messageEn: approved
            ? `Welcome to ${groupName}! You are now a member.`
            : `Your request to join ${groupName} was not approved.`,
          type: approved ? 'success' : 'info',
          category: 'group',
          actionUrl: approved ? `/member-dashboard/groups/${groupId}` : '/member-dashboard?section=group',
          metadata: { groupId, kind: 'join_request' },
        });
      }
    } catch (e) {
      console.error('[group join-requests] notify failed', e);
    }

    return NextResponse.json({ success: true, requestId, action });
  } catch (error) {
    console.error('[group join-requests] review', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
