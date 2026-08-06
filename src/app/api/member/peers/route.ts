import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/member/peers
 *
 * The people you can send money to: members who share at least one active
 * group with you. Scoped that way deliberately — this returns real names, so
 * it must not become a directory of every member on the platform.
 *
 * Returns member ids rather than only usernames because usernames are almost
 * never set (4 of 199 members at the time of writing). A recipient picker keyed
 * on usernames would be empty for practically everyone; the transfer endpoint
 * accepts `toMemberId` for p2p, so that is what the picker sends.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    const meRes = await client.query(
      `SELECT id FROM members WHERE user_id = $1 LIMIT 1`,
      [auth.userId],
    );
    if (meRes.rows.length === 0) return NextResponse.json({ peers: [] });
    const myMemberId = (meRes.rows[0] as { id: number }).id;

    // One row per peer, with the groups you have in common folded into an
    // array so two people with the same name can still be told apart.
    const res = await client.query(
      `SELECT m.id,
              m.full_name,
              m.username,
              m.avatar_url,
              ARRAY_AGG(DISTINCT g.name ORDER BY g.name) AS shared_groups
         FROM group_members mine
         JOIN group_members theirs ON theirs.group_id = mine.group_id
                                  AND theirs.status = 'active'
                                  AND theirs.member_id <> mine.member_id
         JOIN members m ON m.id = theirs.member_id
         JOIN groups  g ON g.id = mine.group_id
        WHERE mine.member_id = $1
          AND mine.status = 'active'
          AND m.status = 'active'
        GROUP BY m.id, m.full_name, m.username, m.avatar_url
        ORDER BY m.full_name`,
      [myMemberId],
    );

    return NextResponse.json({
      myMemberId,
      peers: (res.rows as {
        id: number; full_name: string; username: string | null;
        avatar_url: string | null; shared_groups: string[];
      }[]).map((p) => ({
        id: p.id,
        name: p.full_name,
        username: p.username,
        avatarUrl: p.avatar_url,
        groups: p.shared_groups ?? [],
      })),
    });
  } catch (error) {
    console.error('[member/peers]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
