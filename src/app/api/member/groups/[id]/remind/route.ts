import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const LEADERSHIP = new Set(['leader', 'mwenyekiti', 'katibu', 'mwekahazina']);

/**
 * POST /api/member/groups/[id]/remind — nudge members who have not contributed
 * this month. Leadership only: a button that messages the whole group is not
 * something an ordinary member should hold.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });

  const client = await pool.connect();
  try {
    const meRes = await client.query(
      `SELECT gm.role FROM group_members gm
         JOIN members m ON m.id = gm.member_id
        WHERE m.user_id = $1 AND gm.group_id = $2 AND gm.status = 'active' LIMIT 1`,
      [auth.userId, groupId],
    );
    const role = (meRes.rows[0] as { role?: string } | undefined)?.role;
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!LEADERSHIP.has(role)) {
      return NextResponse.json({ error: 'Only group leadership can send reminders.' }, { status: 403 });
    }

    const groupRes = await client.query(`SELECT name FROM groups WHERE id = $1`, [groupId]);
    const groupName = (groupRes.rows[0] as { name?: string } | undefined)?.name ?? 'your group';

    // Members with a login who have not contributed this month. Those without
    // a user_id (partner-created) have nowhere to receive a notification.
    const targets = await client.query(
      `SELECT m.id, m.user_id
         FROM group_members gm
         JOIN members m ON m.id = gm.member_id
        WHERE gm.group_id = $1 AND gm.status = 'active' AND m.user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM ntzs_transactions t
             WHERE t.to_group_id = $1 AND t.purpose = 'contribution'
               AND t.from_member_id = m.id
               AND t.created_at >= date_trunc('month', CURRENT_DATE)
          )`,
      [groupId],
    );

    let sent = 0;
    for (const r of targets.rows as { user_id: number }[]) {
      try {
        await notify(client, r.user_id, {
          title: 'Kumbusho la mchango',
          message: `Bado hujaweka mchango wako wa mwezi huu katika ${groupName}.`,
          titleEn: 'Contribution reminder',
          messageEn: `Your contribution for this month in ${groupName} is still outstanding.`,
          type: 'info',
          category: 'group',
          actionUrl: `/member-dashboard/groups/${groupId}`,
          metadata: { groupId, kind: 'contribution_reminder' },
        });
        sent += 1;
      } catch (e) {
        // One bad recipient must not abort the rest of the round.
        console.error('[group remind] notify failed', e);
      }
    }

    return NextResponse.json({ success: true, sent, unpaid: targets.rows.length });
  } catch (error) {
    console.error('[group remind]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
