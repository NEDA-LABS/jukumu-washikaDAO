import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { ensureSnippeSchema, creditSnippePaymentToLedger } from '@/lib/snippe-db';
import { getPaymentStatus } from '@/lib/snippe';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Backfill Snippe payments (contributions / group top-ups) that completed but
 * never credited the custodial ledger — the money-in gap when the webhook
 * didn't fire.
 *
 * Two-step recovery so nothing is missed:
 *  1. Poll Snippe for our still-`pending` rows and mark the ones that actually
 *     completed/failed (a payment nobody polled is `pending` in our DB even
 *     though the customer paid).
 *  2. Credit every `status = 'completed'` payment that isn't posted yet.
 *
 * Idempotent via `ledger_posted`. Keys on `status` (set by both webhook and
 * poll), not `event_type`.
 *
 *   GET  → how many completed payments are uncredited + how many pending remain.
 *   POST → reconcile pending against Snippe, then credit all completed-unposted.
 */
const POLL_LIMIT = 60;   // recent pending rows to reconcile per run
const BATCH = 10;

async function uncreditedCompleted(client: PoolClient) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_tzs), 0)::bigint AS total
     FROM snippe_payments
     WHERE status = 'completed' AND ledger_posted = false
       AND (group_id IS NOT NULL OR member_id IS NOT NULL)`
  );
  const row = r.rows[0] as { n: number; total: string };
  return { count: row.n, totalTzs: Number(row.total) };
}

async function pendingCount(client: PoolClient) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM snippe_payments
     WHERE status = 'pending' AND (group_id IS NOT NULL OR member_id IS NOT NULL)`
  );
  return (r.rows[0] as { n: number }).n;
}

/** Poll Snippe for our pending rows and persist any that reached a terminal state. */
async function reconcilePending(client: PoolClient): Promise<{ checked: number; nowCompleted: number; nowFailed: number }> {
  const r = await client.query(
    `SELECT reference FROM snippe_payments
     WHERE status = 'pending' AND (group_id IS NOT NULL OR member_id IS NOT NULL)
     ORDER BY created_at DESC LIMIT $1`,
    [POLL_LIMIT]
  );
  const refs = (r.rows as { reference: string }[]).map((x) => x.reference);
  let nowCompleted = 0, nowFailed = 0;
  for (let i = 0; i < refs.length; i += BATCH) {
    const slice = refs.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (ref) => {
        try { return { ref, status: (await getPaymentStatus(ref)).data.status }; }
        catch { return { ref, status: null as string | null }; }
      })
    );
    for (const { ref, status } of results) {
      if (status !== 'completed' && status !== 'failed') continue;
      await client.query(
        `UPDATE snippe_payments
           SET status = $1, event_type = $2,
               completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
         WHERE reference = $3 AND status NOT IN ('completed', 'failed')`,
        [status, `payment.${status}`, ref]
      );
      if (status === 'completed') nowCompleted++; else nowFailed++;
    }
  }
  return { checked: refs.length, nowCompleted, nowFailed };
}

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    await ensureSnippeSchema(client);
    await ensureNtzsSchema(client);
    const { count, totalTzs } = await uncreditedCompleted(client);
    const pending = await pendingCount(client);
    return NextResponse.json({
      success: true,
      mode: 'dry-run',
      uncreditedPayments: count,
      totalTzs,
      pendingToReconcile: pending,
      note: 'Completed Snippe payments not yet on the ledger. POST reconciles pending against Snippe, then credits all completed ones.',
    });
  } catch (error) {
    console.error('Backfill deposits (dry-run) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    await ensureSnippeSchema(client);
    await ensureNtzsSchema(client);

    // 1) Discover completions Snippe knows about but our DB still marks pending
    //    (webhook never fired and nobody polled that reference).
    let reconciled = { checked: 0, nowCompleted: 0, nowFailed: 0 };
    if (process.env.SNIPPE_API_KEY) {
      try { reconciled = await reconcilePending(client); }
      catch (e) { console.error('Backfill reconcile-pending error:', e); }
    }

    // 2) Credit every completed-but-unposted payment.
    const refsRes = await client.query(
      `SELECT reference FROM snippe_payments
       WHERE status = 'completed' AND ledger_posted = false
         AND (group_id IS NOT NULL OR member_id IS NOT NULL)
       ORDER BY created_at ASC`
    );

    let credited = 0, totalTzs = 0, failed = 0;
    for (const row of refsRes.rows as { reference: string }[]) {
      await client.query('BEGIN');
      try {
        const amount = await creditSnippePaymentToLedger(client, row.reference);
        await client.query('COMMIT');
        if (amount > 0) { credited++; totalTzs += amount; }
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        failed++;
        console.error('Backfill credit failed for', row.reference, e);
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'applied',
      reconciledChecked: reconciled.checked,
      reconciledCompleted: reconciled.nowCompleted,
      reconciledFailed: reconciled.nowFailed,
      credited,
      totalTzs,
      failed,
      note: 'Reconciled pending payments against Snippe, then credited all completed ones. Refresh the app; balances now reflect them.',
    });
  } catch (error) {
    console.error('Backfill deposits (apply) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
