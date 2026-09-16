import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import {
  ensureHarambeeSchema, newHarambeeCode, normalizeKind, HARAMBEE_KINDS,
} from '@/lib/harambee';

export const runtime = 'nodejs';

/**
 * The signed-in member's collections.
 *
 * GET  — the ones they opened, newest first, with what each has raised.
 * POST — open a new one.
 *
 * A collection can name a group, and then the money settles to that group's
 * wallet instead of the organiser's. That is only offered for a group they
 * actually belong to: naming someone else's chama as the destination would be
 * a way to raise money into an account you do not control, or worse, to make
 * it look as though a group is asking.
 */

async function currentMember(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return null;
  const res = await pool.query(
    `SELECT m.id, m.full_name FROM members m WHERE m.user_id = $1 LIMIT 1`,
    [auth.userId]
  );
  return (res.rows[0] as { id: number; full_name: string } | undefined) ?? null;
}

export async function GET(request: NextRequest) {
  const member = await currentMember(request);
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureHarambeeSchema();
  try {
    const res = await pool.query(
      `SELECT h.id, h.code, h.title, h.kind, h.story, h.beneficiary, h.target_tzs,
              h.deadline, h.status, h.created_at, h.closed_at,
              -- Not the image itself: a list of ten collections would carry a
              -- megabyte of base64 nobody on that screen is going to look at.
              (h.cover_image IS NOT NULL) AS has_cover,
              g.name AS group_name,
              COALESCE((SELECT SUM(c.amount_tzs) FILTER (WHERE c.status = 'settled')
                          FROM harambee_contributions c WHERE c.harambee_id = h.id), 0)::bigint AS raised_tzs,
              (SELECT count(*) FILTER (WHERE c.status = 'settled')
                 FROM harambee_contributions c WHERE c.harambee_id = h.id)::int AS contributors
         FROM harambees h
         LEFT JOIN groups g ON g.id = h.group_id
        WHERE h.organiser_member_id = $1
        ORDER BY h.created_at DESC`,
      [member.id]
    );
    return NextResponse.json({ harambees: res.rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[member/harambees GET]', error);
    return NextResponse.json({ error: 'Could not load your collections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const member = await currentMember(request);
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
  const story = typeof body?.story === 'string' ? body.story.trim().slice(0, 4000) : null;
  const beneficiary = typeof body?.beneficiary === 'string' ? body.beneficiary.trim().slice(0, 160) : null;
  const kind = normalizeKind(body?.kind);
  const targetRaw = Number(body?.targetTzs);
  const target = Number.isFinite(targetRaw) && targetRaw > 0 ? Math.floor(targetRaw) : null;
  const deadline = typeof body?.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.deadline)
    ? body.deadline : null;
  const groupId = Number.isFinite(Number(body?.groupId)) && Number(body.groupId) > 0
    ? Number(body.groupId) : null;

  // Accepted only as an image data URL, and only within a size the column and
  // a link preview can both live with. The browser resizes before sending, so
  // anything arriving larger than this did not come from our form.
  const rawCover = typeof body?.coverImage === 'string' ? body.coverImage.trim() : '';
  const cover = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(rawCover)
    && rawCover.length <= 2_000_000
    ? rawCover : null;
  if (rawCover && !cover) {
    return NextResponse.json(
      { error: 'That image could not be used. Try a smaller one.', field: 'coverImage' },
      { status: 400 }
    );
  }

  if (title.length < 3) {
    return NextResponse.json({ error: 'Give the collection a name', field: 'title' }, { status: 400 });
  }
  if (!HARAMBEE_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Choose what this is for', field: 'kind' }, { status: 400 });
  }

  await ensureHarambeeSchema();
  const client = await pool.connect();
  try {
    if (groupId !== null) {
      const ok = await client.query(
        `SELECT 1 FROM group_members
          WHERE group_id = $1 AND member_id = $2 AND status = 'active' LIMIT 1`,
        [groupId, member.id]
      );
      if (ok.rows.length === 0) {
        return NextResponse.json(
          { error: 'You can only collect for a group you belong to', field: 'groupId' },
          { status: 403 }
        );
      }
    }

    // A collision is vanishingly unlikely and trivially survivable, so it is
    // retried rather than guarded with a lock.
    let code = newHarambeeCode();
    for (let i = 0; i < 5; i += 1) {
      const clash = await client.query(`SELECT 1 FROM harambees WHERE code = $1 LIMIT 1`, [code]);
      if (clash.rows.length === 0) break;
      code = newHarambeeCode();
    }

    const res = await client.query(
      `INSERT INTO harambees
         (code, title, kind, story, beneficiary, target_tzs, deadline, organiser_member_id, group_id, cover_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, code, title, kind, story, beneficiary, target_tzs, deadline, status, created_at,
                 (cover_image IS NOT NULL) AS has_cover`,
      [code, title, kind, story, beneficiary, target, deadline, member.id, groupId, cover]
    );

    return NextResponse.json({ harambee: res.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[member/harambees POST]', error);
    return NextResponse.json({ error: 'Could not open the collection' }, { status: 500 });
  } finally {
    client.release();
  }
}
