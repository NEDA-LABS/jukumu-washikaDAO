import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureHarambeeSchema } from '@/lib/harambee';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';

/**
 * Asking specific people to contribute.
 *
 * A link works for anyone, which is why sharing came first — but a link sent
 * to a group of forty is addressed to nobody, and a funeral collection needs
 * particular people to actually see it. This puts the ask in their own
 * notifications, where it waits for them rather than scrolling away.
 *
 * Who may be invited is deliberately narrow: people the organiser already
 * shares a group with. An invite is a message sent in someone's name to
 * someone else, and an endpoint that would send it to any member id is a
 * spam tool with an organiser's face on it.
 */

const MAX_PER_CALL = 60;

async function organiserOf(request: NextRequest, harambeeId: number) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return null;
  const res = await pool.query(
    `SELECT h.id, h.code, h.title, h.status, h.organiser_member_id, m.full_name AS organiser_name
       FROM harambees h
       JOIN members m ON m.id = h.organiser_member_id
      WHERE h.id = $1 AND m.user_id = $2 LIMIT 1`,
    [harambeeId, auth.userId]
  );
  return (res.rows[0] as {
    id: number; code: string; title: string; status: string;
    organiser_member_id: number; organiser_name: string;
  } | undefined) ?? null;
}

/** Who the organiser could ask, and who has already been asked. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureHarambeeSchema();
  const h = await organiserOf(request, Number(id));
  if (!h) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const res = await pool.query(
    `SELECT DISTINCT m.id, m.full_name, m.username,
            (i.id IS NOT NULL) AS invited,
            EXISTS (
              SELECT 1 FROM harambee_contributions c
               WHERE c.harambee_id = $1 AND c.status = 'settled'
                 AND lower(c.contributor_name) = lower(m.full_name)
            ) AS contributed
       FROM group_members gm
       JOIN group_members mine
         ON mine.group_id = gm.group_id AND mine.member_id = $2 AND mine.status = 'active'
       JOIN members m ON m.id = gm.member_id
       LEFT JOIN harambee_invites i ON i.harambee_id = $1 AND i.member_id = m.id
      WHERE gm.status = 'active' AND m.id <> $2
      ORDER BY m.full_name`,
    [h.id, h.organiser_member_id]
  );

  return NextResponse.json({ candidates: res.rows }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureHarambeeSchema();
  const h = await organiserOf(request, Number(id));
  if (!h) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (h.status !== 'open') {
    return NextResponse.json({ error: 'This collection is closed' }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.memberIds)
    ? [...new Set(body.memberIds.map(Number).filter((n: number) => Number.isFinite(n) && n > 0))].slice(0, MAX_PER_CALL)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Choose at least one person', field: 'memberIds' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Only people the organiser shares an active group with, resolved in SQL
    // rather than trusted from the request.
    const allowed = await client.query(
      `SELECT DISTINCT m.id, m.user_id, m.full_name
         FROM group_members gm
         JOIN group_members mine
           ON mine.group_id = gm.group_id AND mine.member_id = $1 AND mine.status = 'active'
         JOIN members m ON m.id = gm.member_id
        WHERE gm.status = 'active' AND m.id = ANY($2::int[]) AND m.id <> $1`,
      [h.organiser_member_id, ids]
    );

    let invited = 0, skipped = 0;
    for (const row of allowed.rows as { id: number; user_id: number | null; full_name: string }[]) {
      const claim = await client.query(
        `INSERT INTO harambee_invites (harambee_id, member_id, invited_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (harambee_id, member_id) DO NOTHING
         RETURNING id`,
        [h.id, row.id, h.organiser_member_id]
      );
      // Already asked — the notification is not sent again.
      if (claim.rowCount === 0) { skipped += 1; continue; }
      if (!row.user_id) { invited += 1; continue; }

      await notify(client, row.user_id, {
        title: `${h.organiser_name} anaomba mchango`,
        titleEn: `${h.organiser_name} is asking for help`,
        message: `"${h.title}" — bonyeza kuona na kuchangia.`,
        messageEn: `“${h.title}” — open it to see the collection and give.`,
        type: 'info',
        category: 'harambee',
        actionUrl: `/harambee/${h.code}`,
        actionText: 'Ona mchango',
        metadata: { harambee_id: h.id, code: h.code },
      });
      invited += 1;
    }

    const notAllowed = ids.length - allowed.rows.length;
    return NextResponse.json({ invited, skipped, notAllowed });
  } catch (error) {
    console.error('[harambee/invite]', error);
    return NextResponse.json({ error: 'Could not send the invitations' }, { status: 500 });
  } finally {
    client.release();
  }
}
