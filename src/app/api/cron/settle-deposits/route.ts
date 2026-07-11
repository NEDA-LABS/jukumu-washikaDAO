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
  if (!process.env.NTZS_API_KEY) return { checked: 0, credited: 0, creditedTzs: 0, liveStatusCounts: {}, sample: [], apiError: 'NTZS_API_KEY missing' };
  const r = await client.query(
    `SELECT ntzs_id, amount_tzs, status FROM ntzs_transactions
     WHERE type = 'deposit' AND posted = false AND ntzs_id IS NOT NULL
     ORDER BY created_at DESC LIMIT $1`,
    [NTZS_LIMIT]
  );
  const rows = r.rows as { ntzs_id: string; amount_tzs: string; status: string }[];
  let checked = 0, credited = 0, creditedTzs = 0;
  // Diagnostics: what nTZS's API actually returns for each deposit, so we can
  // see whether the live status reads as minted (or something unexpected).
  const liveStatusCounts: Record<string, number> = {};
  const sample: { amountTzs: number; dbStatus: string; liveStatus: string | null; credited: boolean }[] = [];
  let apiError: string | null = null;
  for (let i = 0; i < rows.length; i += BATCH) {
    if (Date.now() > deadline) break;
    const slice = rows.slice(i, i + BATCH);
    const statuses = await Promise.all(
      slice.map(async (row) => {
        try { return { row, status: (await ntzs.deposits.get(row.ntzs_id)).status as string | null, err: null as string | null }; }
        catch (e) { return { row, status: null, err: e instanceof Error ? e.message : String(e) }; }
      })
    );
    for (const { row, status, err } of statuses) {
      checked++;
      if (err && !apiError) apiError = err;
      const key = status ?? 'ERROR';
      liveStatusCounts[key] = (liveStatusCounts[key] ?? 0) + 1;
      let applied = false;
      if (status) {
        await client.query('BEGIN');
        try {
          const res = await settleExternalTransaction(client, row.ntzs_id, status);
          await client.query('COMMIT');
          if (res.applied) { applied = true; credited++; creditedTzs += Math.round(Number(row.amount_tzs)); }
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          console.error('cron settleNtzs failed for', row.ntzs_id, e);
        }
      }
      if (sample.length < 20) sample.push({ amountTzs: Math.round(Number(row.amount_tzs)), dbStatus: row.status, liveStatus: status, credited: applied });
    }
  }
  return { checked, credited, creditedTzs, liveStatusCounts, sample, apiError };
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
