import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureHarambeeSchema, harambeeTotals } from '@/lib/harambee';

export const runtime = 'nodejs';

/**
 * One collection, as its organiser sees it — which is more than the public
 * page shows: every contribution including the ones still in flight, and the
 * real name behind an anonymous gift, because the organiser is the person who
 * has to thank people and reconcile what arrived.
 *
 * PATCH closes or reopens it. Closing stops new contributions; it does not
 * touch money that has already arrived.
 */

async function ownerOf(request: NextRequest, id: number) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return null;
  const res = await pool.query(
    `SELECT h.id, h.code, h.title, h.kind, h.story, h.beneficiary, h.target_tzs,
            h.deadline, h.status, h.created_at, h.closed_at, h.group_id,
            (h.cover_image IS NOT NULL) AS has_cover
       FROM harambees h
       JOIN members m ON m.id = h.organiser_member_id
      WHERE h.id = $1 AND m.user_id = $2 LIMIT 1`,
    [id, auth.userId]
  );
  return (res.rows[0] as Record<string, unknown> | undefined) ?? null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureHarambeeSchema();
  const h = await ownerOf(request, Number(id));
  if (!h) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [totals, contributions] = await Promise.all([
    harambeeTotals(Number(id)),
    pool.query(
      `SELECT id, contributor_name, phone, email, amount_tzs, method, status,
              message, anonymous, reference, created_at, settled_at
         FROM harambee_contributions
        WHERE harambee_id = $1
        ORDER BY created_at DESC`,
      [Number(id)]
    ),
  ]);

  return NextResponse.json({
    harambee: h,
    totals,
    contributions: contributions.rows,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureHarambeeSchema();
  const h = await ownerOf(request, Number(id));
  if (!h) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);

  // Changing the picture is its own request; it does not touch the status.
  if (typeof body?.coverImage === 'string') {
    const raw = body.coverImage.trim();
    const ok = raw === ''
      || (/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(raw) && raw.length <= 2_000_000);
    if (!ok) {
      return NextResponse.json({ error: 'That image could not be used. Try a smaller one.' }, { status: 400 });
    }
    await pool.query(`UPDATE harambees SET cover_image = $1 WHERE id = $2`, [raw || null, Number(id)]);
    return NextResponse.json({ success: true, hasCover: raw !== '' });
  }

  const status = body?.status === 'closed' ? 'closed' : body?.status === 'open' ? 'open' : null;
  if (!status) return NextResponse.json({ error: "status must be 'open' or 'closed'" }, { status: 400 });

  await pool.query(
    `UPDATE harambees
        SET status = $1,
            closed_at = CASE WHEN $2::boolean THEN NOW() ELSE NULL END
      WHERE id = $3`,
    [status, status === 'closed', Number(id)]
  );
  return NextResponse.json({ success: true, status });
}
