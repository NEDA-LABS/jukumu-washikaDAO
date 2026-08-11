import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureDonationsSchema, settleDonationByNtzsId } from '@/lib/donations';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';

/**
 * Every donation, and the review queue for the ones that need a person.
 *
 * Mobile money and bank transfers settle themselves — nTZS tells us when the
 * money lands. A transfer sent on chain happens entirely outside this
 * application, so the only evidence is a hash the donor typed; confirming one
 * is what releases the certificate, so it stays a human decision. Check the
 * hash against the treasury wallet first.
 *
 * The list is not filtered by method: a donation that settled on its own still
 * needs to be visible, or the only gifts anyone can see are the ones that went
 * wrong.
 */

/**
 * Bring any still-open bank or mobile donation up to date with nTZS before
 * listing. The scheduled sweep is meant to do this, but it runs on the host's
 * timer and a donation that reads `submitted` here while the money has already
 * minted is exactly the thing this screen exists to disprove. A handful of
 * lookups on a page an admin opens by hand is a cheap way to never show a
 * stale gift — and it is the same idempotent step the sweep and webhook call.
 */
async function refreshOpenDonations() {
  if (!process.env.NTZS_API_KEY) return;
  const client = await pool.connect();
  try {
    const open = await client.query(
      `SELECT ntzs_id FROM donations
        WHERE ntzs_id IS NOT NULL AND method <> 'crypto'
          AND status NOT IN ('completed', 'failed', 'rejected')
        ORDER BY created_at DESC LIMIT 25`
    );
    await Promise.all((open.rows as { ntzs_id: string }[]).map(async ({ ntzs_id }) => {
      try {
        const remote = await ntzs.deposits.get(ntzs_id);
        await settleDonationByNtzsId(client, ntzs_id, remote.status, remote.txHash ?? null);
      } catch {
        // One unreachable lookup must not stop the list from rendering.
      }
    }));
  } catch {
    // Same: a refresh failure is not a reason to show the admin nothing.
  } finally {
    client.release();
  }
}

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
  await refreshOpenDonations();
  const sp = new URL(request.url).searchParams;
  const status = sp.get('status');

  try {
    // `status` narrows the list; without it, everything, newest first. Pending
    // reviews are floated to the top of that view because they are the only
    // rows anyone has to act on.
    const res = await pool.query(
      status
        ? `SELECT id, donor_name, phone, amount_tzs, token, token_amount, tx_hash, from_address,
                  status, method, certificate_code, message, review_reason, created_at, settled_at
             FROM donations WHERE status = $1
            ORDER BY created_at DESC LIMIT 300`
        : `SELECT id, donor_name, phone, amount_tzs, token, token_amount, tx_hash, from_address,
                  status, method, certificate_code, message, review_reason, created_at, settled_at
             FROM donations
            ORDER BY (status = 'pending_review') DESC, created_at DESC LIMIT 300`,
      status ? [status] : []
    );

    const totals = await pool.query(
      `SELECT
         COALESCE(SUM(amount_tzs) FILTER (WHERE status = 'completed'), 0)::bigint AS raised,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS supporters,
         COUNT(*) FILTER (WHERE status = 'pending_review')::int AS awaiting,
         -- nTZS reports a started deposit as pending, submitted or
         -- processing depending on the rail; all three mean "not yet paid".
         COUNT(*) FILTER (WHERE status IN ('pending','submitted','processing'))::int AS in_flight
       FROM donations`
    );
    const t = totals.rows[0] as { raised: string; supporters: number; awaiting: number; in_flight: number };

    return NextResponse.json({
      donations: res.rows.map((r) => ({
        ...(r as object),
        amount_tzs: Number((r as { amount_tzs: string }).amount_tzs),
        token_amount: (r as { token_amount: string | null }).token_amount != null
          ? Number((r as { token_amount: string }).token_amount)
          : null,
      })),
      totals: {
        raisedTzs: Number(t.raised),
        supporters: t.supporters,
        awaitingReview: t.awaiting,
        inFlight: t.in_flight,
      },
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
