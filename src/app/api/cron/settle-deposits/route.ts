import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { ensureSnippeSchema, creditSnippePaymentToLedger } from '@/lib/snippe-db';
import { settleExternalTransaction } from '@/lib/wallet/ledger';
import { ntzs } from '@/lib/ntzs';
import { getPaymentStatus } from '@/lib/snippe';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Automatic deposit reconciliation — the durable fix for "balances don't
 * reflect deposits."
 *
 * Since deposits now mint into ONE master wallet, a user's balance is a DB
 * value that must be explicitly credited on confirmation. That credit used to
 * fire only when a member opened their wallet (self-sync) or the webhook fired
 * (it doesn't), so confirmed money sat in the master uncredited. This endpoint
 * settles EVERY confirmed-but-uncredited deposit across both rails, globally,
 * with no dependence on any screen. Run on a schedule (Netlify Scheduled
 * Function) every couple of minutes; also safe to hit manually.
 *
 * Idempotent (posted / ledger_posted guards). Bounded per run so it never
 * exceeds the function timeout; the next run picks up the rest.
 *
 * Auth: if CRON_SECRET is set, require header `x-cron-key` to match. If it is
 * not set, the call is allowed (the work is idempotent and only credits money
 * that already landed).
 */
const NTZS_LIMIT = 80;
const SNIPPE_PENDING_LIMIT = 80;
const BATCH = 10;
const BUDGET_MS = 22_000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get('x-cron-key') === secret;
}

/** Settle nTZS deposits that minted into the master but were never credited. */
async function settleNtzs(client: PoolClient, deadline: number) {
  if (!process.env.NTZS_API_KEY) return { checked: 0, credited: 0, creditedTzs: 0 };
  const r = await client.query(
    `SELECT ntzs_id FROM ntzs_transactions
     WHERE type = 'deposit' AND posted = false AND ntzs_id IS NOT NULL
     ORDER BY created_at DESC LIMIT $1`,
    [NTZS_LIMIT]
  );
  const ids = (r.rows as { ntzs_id: string }[]).map((x) => x.ntzs_id);
  let checked = 0, credited = 0, creditedTzs = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    if (Date.now() > deadline) break;
    const slice = ids.slice(i, i + BATCH);
    const statuses = await Promise.all(
      slice.map(async (id) => {
        try { return { id, status: (await ntzs.deposits.get(id)).status as string | null }; }
        catch { return { id, status: null }; }
      })
    );
    for (const { id, status } of statuses) {
      checked++;
      if (!status) continue;
      await client.query('BEGIN');
      try {
        const res = await settleExternalTransaction(client, id, status);
        await client.query('COMMIT');
        if (res.applied) { credited++; }
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('cron settleNtzs failed for', id, e);
      }
    }
  }
  return { checked, credited, creditedTzs };
}

/** Reconcile Snippe pending payments, then credit all completed-but-unposted. */
async function settleSnippe(client: PoolClient, deadline: number) {
  if (!process.env.SNIPPE_API_KEY) return { reconciled: 0, credited: 0, creditedTzs: 0 };

  // 1) Discover completions Snippe knows about but our DB still marks pending.
  const pend = await client.query(
    `SELECT reference FROM snippe_payments
     WHERE status = 'pending' AND (group_id IS NOT NULL OR member_id IS NOT NULL)
     ORDER BY created_at DESC LIMIT $1`,
    [SNIPPE_PENDING_LIMIT]
  );
  const refs = (pend.rows as { reference: string }[]).map((x) => x.reference);
  let reconciled = 0;
  for (let i = 0; i < refs.length; i += BATCH) {
    if (Date.now() > deadline) break;
    const slice = refs.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (ref) => {
        try { return { ref, status: (await getPaymentStatus(ref)).data.status as string | null }; }
        catch { return { ref, status: null }; }
      })
    );
    for (const { ref, status } of results) {
      if (status !== 'completed' && status !== 'failed') continue;
      await client.query(
        `UPDATE snippe_payments SET status = $1, event_type = $2,
               completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
         WHERE reference = $3 AND status NOT IN ('completed','failed')`,
        [status, `payment.${status}`, ref]
      );
      if (status === 'completed') reconciled++;
    }
  }

  // 2) Credit every completed-but-unposted payment.
  const comp = await client.query(
    `SELECT reference FROM snippe_payments
     WHERE status = 'completed' AND ledger_posted = false
       AND (group_id IS NOT NULL OR member_id IS NOT NULL)
     ORDER BY created_at ASC LIMIT 200`
  );
  let credited = 0, creditedTzs = 0;
  for (const row of comp.rows as { reference: string }[]) {
    if (Date.now() > deadline) break;
    await client.query('BEGIN');
    try {
      const amt = await creditSnippePaymentToLedger(client, row.reference);
      await client.query('COMMIT');
      if (amt > 0) { credited++; creditedTzs += amt; }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('cron settleSnippe credit failed for', row.reference, e);
    }
  }
  return { reconciled, credited, creditedTzs };
}

async function run() {
  const deadline = Date.now() + BUDGET_MS;
  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);
    await ensureSnippeSchema(client);
    const ntzsRes = await settleNtzs(client, deadline);
    const snippeRes = await settleSnippe(client, deadline);
    return { success: true, ntzs: ntzsRes, snippe: snippeRes };
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await run());
  } catch (error) {
    console.error('cron settle-deposits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET allowed too, so the schedule (or a manual check) can trigger it simply.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await run());
  } catch (error) {
    console.error('cron settle-deposits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
