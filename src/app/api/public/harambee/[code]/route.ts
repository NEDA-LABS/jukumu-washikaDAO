import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureHarambeeSchema, harambeeTotals } from '@/lib/harambee';

export const runtime = 'nodejs';

/**
 * GET /api/public/harambee/<code> — everything the shared page shows.
 *
 * Open without a session: the whole point is a link somebody forwards.
 * The code is unguessable, so possessing it is the permission.
 *
 * The contributor list is deliberately narrow. A contribution row carries a
 * phone number and an email address; neither belongs on a page that gets
 * forwarded through WhatsApp. Name, amount and when — nothing else — and not
 * even the name when the giver asked to stay anonymous.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  await ensureHarambeeSchema();

  try {
    const res = await pool.query(
      `SELECT h.id, h.code, h.title, h.kind, h.story, h.beneficiary, h.target_tzs,
              h.deadline, h.status, h.created_at, h.closed_at,
              g.name AS group_name, m.full_name AS organiser_name
         FROM harambees h
         LEFT JOIN groups g ON g.id = h.group_id
         LEFT JOIN members m ON m.id = h.organiser_member_id
        WHERE h.code = $1 LIMIT 1`,
      [code]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const h = res.rows[0] as { id: number; [k: string]: unknown };

    const [totals, contributions] = await Promise.all([
      harambeeTotals(h.id),
      pool.query(
        `SELECT CASE WHEN anonymous THEN NULL ELSE contributor_name END AS name,
                amount_tzs, message, anonymous,
                COALESCE(settled_at, created_at) AS at
           FROM harambee_contributions
          WHERE harambee_id = $1 AND status = 'settled'
          ORDER BY COALESCE(settled_at, created_at) DESC
          LIMIT 100`,
        [h.id]
      ),
    ]);

    return NextResponse.json({
      harambee: {
        code: h.code, title: h.title, kind: h.kind, story: h.story,
        beneficiary: h.beneficiary, targetTzs: h.target_tzs != null ? Number(h.target_tzs) : null,
        deadline: h.deadline, status: h.status, createdAt: h.created_at, closedAt: h.closed_at,
        groupName: h.group_name, organiserName: h.organiser_name,
      },
      totals,
      contributions: contributions.rows.map((r) => {
        const row = r as { name: string | null; amount_tzs: string; message: string | null; anonymous: boolean; at: string };
        return {
          name: row.name,
          amountTzs: Number(row.amount_tzs),
          message: row.message,
          anonymous: row.anonymous,
          at: row.at,
        };
      }),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[public/harambee GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
