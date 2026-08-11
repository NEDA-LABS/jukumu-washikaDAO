import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureDonationsSchema } from '@/lib/donations';

export const runtime = 'nodejs';

/**
 * Review queue for gifts sent on chain.
 *
 * Mobile-money donations settle themselves — nTZS tells us whether the donor
 * approved the prompt. A crypto transfer happens entirely outside this
 * application, so the only evidence is a hash the donor typed. Confirming is
 * what turns that into a recognised gift and releases the certificate, so it
 * is a human decision: check the hash against the treasury wallet first.
 */

async function requireAdmin(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return null;
  // From the database, not the token: a token minted before someone was
  // demoted still carries the old claim.
  const res = await pool.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [auth.userId]);
  if ((res.rows[0] as { role?: string } | undefined)?.role !== 'admin') return null;
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await ensureDonationsSchema();
  const status = new URL(request.url).searchParams.get('status') || 'pending_review';

  try {
    const res = await pool.query(
      `SELECT id, donor_name, amount_tzs, token, tx_hash, from_address, status,
              certificate_code, message, review_reason, created_at, settled_at
         FROM donations
        WHERE method = 'crypto' AND status = $1
        ORDER BY created_at ASC
        LIMIT 200`,
      [status]
    );
    return NextResponse.json({
      donations: res.rows.map((r) => ({
        ...(r as object),
        amount_tzs: Number((r as { amount_tzs: string }).amount_tzs),
      })),
    });
  } catch (error) {
    console.error('[admin/donations GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const id = Number(body?.donationId);
  const action = body?.action;
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

  if (!Number.isFinite(id)) return NextResponse.json({ error: 'donationId is required' }, { status: 400 });
  if (action !== 'confirm' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'confirm' or 'reject'" }, { status: 400 });
  }

  await ensureDonationsSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Locked, so two reviewers cannot both confirm the same gift.
    const res = await client.query(
      `SELECT id, status, certificate_code FROM donations WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (res.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const d = res.rows[0] as { status: string; certificate_code: string };
    if (d.status !== 'pending_review') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: `This donation was already ${d.status}` }, { status: 409 });
    }

    // Decide the status here rather than in SQL: reusing one parameter as both
    // an assigned value and a comparison leaves Postgres unable to deduce its
    // type ("inconsistent types deduced for parameter $1").
    const confirmed = action === 'confirm';
    await client.query(
      `UPDATE donations
          SET status = $1,
              settled_at = COALESCE(settled_at, CASE WHEN $2::boolean THEN NOW() END),
              reviewed_by_user_id = $3,
              review_reason = $4
        WHERE id = $5`,
      [confirmed ? 'completed' : 'rejected', confirmed, auth.userId, reason, id]
    );

    await client.query('COMMIT');
    return NextResponse.json({
      success: true,
      status: action === 'confirm' ? 'completed' : 'rejected',
      reference: d.certificate_code,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[admin/donations POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
