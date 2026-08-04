import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/**
 * POST /api/investor/contact
 *
 * Someone outside the group wants to talk to it. Records nothing on its own —
 * the conversation happens over phone or email — but tells the group it is
 * being approached, so a chama learns about investor interest from its own app
 * rather than from head office weeks later.
 *
 * Every active member with a login is notified, not just leadership: interest
 * in the group's project is news for the whole group, and a leader who does not
 * open the app should not be a single point of failure.
 *
 * Body: { groupId, projectTitle?, channel?: 'email'|'phone'|'support' }
 */
export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const groupId = Number(body?.groupId);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'groupId is required.' }, { status: 422 });
  }
  const projectTitle = typeof body?.projectTitle === 'string' ? body.projectTitle.slice(0, 200) : null;
  const channel = ['email', 'phone', 'support'].includes(body?.channel) ? body.channel : 'email';

  const client = await pool.connect();
  try {
    const groupRes = await client.query(`SELECT id, name FROM groups WHERE id = $1 LIMIT 1`, [groupId]);
    const group = groupRes.rows[0] as { id: number; name: string } | undefined;
    if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 });

    // Who is asking. Falls back to a neutral phrase rather than leaking an
    // email address into every member's notification.
    const whoRes = await client.query(
      `SELECT COALESCE(NULLIF(TRIM(ip.company), ''), NULLIF(TRIM(u.full_name), '')) AS who
         FROM users u LEFT JOIN investor_profiles ip ON ip.user_id = u.id
        WHERE u.id = $1 LIMIT 1`,
      [auth.userId],
    );
    const who = (whoRes.rows[0] as { who?: string } | undefined)?.who?.trim();

    // This endpoint fans one request out to every member of a group, so it is
    // a spam vector: pressing the button ten times must not ring ten phones.
    // One notification per caller, per group, per hour — repeats inside that
    // window succeed silently so the investor's tel:/mailto: still opens.
    const recent = await client.query(
      `SELECT 1 FROM notifications
        WHERE metadata->>'kind' = 'investor_contact'
          AND metadata->>'groupId' = $1
          AND metadata->>'byUserId' = $2
          AND created_at > NOW() - INTERVAL '1 hour'
        LIMIT 1`,
      [String(groupId), String(auth.userId)],
    );
    if (recent.rows.length > 0) {
      return NextResponse.json({ success: true, notified: 0, deduped: true });
    }

    const targets = await client.query(
      `SELECT DISTINCT m.user_id
         FROM group_members gm JOIN members m ON m.id = gm.member_id
        WHERE gm.group_id = $1 AND gm.status = 'active' AND m.user_id IS NOT NULL`,
      [groupId],
    );

    const subject = projectTitle ? `"${projectTitle}"` : group.name;
    let sent = 0;
    for (const r of targets.rows as { user_id: number }[]) {
      try {
        await notify(client, r.user_id, {
          title: 'Mwekezaji amewasiliana',
          message: `${who || 'Mwekezaji'} ameonyesha nia kuhusu ${subject}. Timu ya Washika itawasiliana nanyi.`,
          titleEn: 'An investor got in touch',
          messageEn: `${who || 'An investor'} has expressed interest in ${subject}. The Washika team will follow up with you.`,
          type: 'info',
          category: 'group',
          actionUrl: `/member-dashboard/groups/${groupId}`,
          metadata: { groupId, kind: 'investor_contact', channel, projectTitle, byUserId: auth.userId },
        });
        sent += 1;
      } catch (e) {
        // One unreachable member must not stop the rest of the group hearing.
        console.error('[investor/contact] notify failed', e);
      }
    }

    return NextResponse.json({ success: true, notified: sent, members: targets.rows.length });
  } catch (error) {
    console.error('[investor/contact]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
