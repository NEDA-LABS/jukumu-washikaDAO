import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { ensureSnippeSchema, creditSnippePaymentToLedger } from '@/lib/snippe-db';
import { settleExternalTransaction } from '@/lib/wallet/ledger';
import { ntzs } from '@/lib/ntzs';
import { getPaymentStatus } from '@/lib/snippe';
import { ensureDonationsSchema, settleDonationByNtzsId } from '@/lib/donations';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Automatic deposit reconciliation — the durable fix for "balances don't
 * reflect deposits."
 *
 * Since deposits mint into ONE master wallet, a user's balance is a DB value
 * that must be explicitly credited on confirmation. This settles EVERY
 * confirmed-but-uncredited deposit across both rails, globally. Runs every 2
 * minutes via a Netlify Scheduled Function; also triggered by the admin "sync
 * now" button. Idempotent (posted / ledger_posted guards).
 *
 * Failure design: each rail runs independently and reports its own error, so
 * one bad rail (or one bad row) can never turn the whole run into an opaque
 * 500 — the response always says exactly what happened. The per-run work is
 * budgeted to finish inside the platform's function time limit; the next run
 * picks up anything left.
 *
 * Auth: if CRON_SECRET is set, require header `x-cron-key` to match. Without
 * it the call is open — acceptable because the work is idempotent and only
 * credits money that already landed.
 */
const NTZS_LIMIT = 40;
const SNIPPE_PENDING_LIMIT = 40;
const BATCH = 10;
const BUDGET_MS = 8_000; // finish well inside the platform's ~10s function budget

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get('x-cron-key') === secret;
}

/** Settle nTZS deposits that minted into the master but were never credited. */
async function settleNtzs(client: PoolClient, deadline: number) {
  if (!process.env.NTZS_API_KEY) return { checked: 0, credited: 0, creditedTzs: 0, liveStatusCounts: {}, apiError: 'NTZS_API_KEY missing' };
  const r = await client.query(
    `SELECT ntzs_id, amount_tzs, status FROM ntzs_transactions
     WHERE type = 'deposit' AND posted = false AND ntzs_id IS NOT NULL
     ORDER BY created_at DESC LIMIT $1`,
    [NTZS_LIMIT]
  );
  // A donation's ledger row never becomes posted (nobody is credited), so the
  // query above keeps returning it and it stays swept. What it does NOT cover
  // is a donation whose ledger row already settled while the donation itself
  // was left behind — the exact state the old code could strand. Both are
  // gathered here so one pass fixes either.
  const openDonations = await client.query(
    `SELECT ntzs_id, amount_tzs, status FROM donations
      WHERE ntzs_id IS NOT NULL AND status NOT IN ('completed', 'failed', 'rejected')
        AND method <> 'crypto'
      ORDER BY created_at DESC LIMIT $1`,
    [NTZS_LIMIT]
  );
  const seen = new Set((r.rows as { ntzs_id: string }[]).map((x) => x.ntzs_id));
  const rows = [
    ...(r.rows as { ntzs_id: string; amount_tzs: string; status: string }[]),
    ...(openDonations.rows as { ntzs_id: string; amount_tzs: string; status: string }[])
      .filter((x) => !seen.has(x.ntzs_id)),
  ];
  let checked = 0, credited = 0, creditedTzs = 0, donationsSettled = 0;
  const liveStatusCounts: Record<string, number> = {};
  let apiError: string | null = null;
  for (let i = 0; i < rows.length; i += BATCH) {
    if (Date.now() > deadline) break;
    const slice = rows.slice(i, i + BATCH);
    const statuses = await Promise.all(
      slice.map(async (row) => {
        try { return { row, status: (await ntzs.deposits.get(row.ntzs_id)).status as string | null, err: null as string | null }; }
        catch (e) { return { row, status: null, err: errMsg(e) }; }
      })
    );
    for (const { row, status, err } of statuses) {
      checked++;
      if (err && !apiError) apiError = err;
      liveStatusCounts[status ?? 'ERROR'] = (liveStatusCounts[status ?? 'ERROR'] ?? 0) + 1;
      if (!status) continue;
      await client.query('BEGIN');
      try {
        // Also advances the stored status (e.g. submitted -> minted), so the
        // member's transaction list stops showing a stale state.
        const res = await settleExternalTransaction(client, row.ntzs_id, status);
        const don = await settleDonationByNtzsId(client, row.ntzs_id, status);
        await client.query('COMMIT');
        if (res.applied) { credited++; creditedTzs += Math.round(Number(row.amount_tzs)); }
        if (don === 'completed') donationsSettled++;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        if (!apiError) apiError = errMsg(e);
        console.error('cron settleNtzs failed for', row.ntzs_id, e);
      }
    }
  }
  return { checked, credited, creditedTzs, donationsSettled, liveStatusCounts, apiError };
}

/** Reconcile Snippe pending payments, then credit all completed-but-unposted. */
async function settleSnippe(client: PoolClient, deadline: number) {
  if (!process.env.SNIPPE_API_KEY) return { reconciled: 0, credited: 0, creditedTzs: 0, apiError: 'SNIPPE_API_KEY missing' };
  let apiError: string | null = null;

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
        catch (e) { if (!apiError) apiError = errMsg(e); return { ref, status: null }; }
      })
    );
    for (const { ref, status } of results) {
      if (status !== 'completed' && status !== 'failed') continue;
      // $4 boolean instead of reusing $1 in a comparison — dual-typed parameter
      // reuse is rejected by the database ("inconsistent types deduced").
      await client.query(
        `UPDATE snippe_payments SET status = $1, event_type = $2,
               completed_at = CASE WHEN $4::boolean THEN NOW() ELSE completed_at END
         WHERE reference = $3 AND status NOT IN ('completed','failed')`,
        [status, `payment.${status}`, ref, status === 'completed']
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
      if (!apiError) apiError = errMsg(e);
      console.error('cron settleSnippe credit failed for', row.reference, e);
    }
  }
  return { reconciled, credited, creditedTzs, apiError };
}

async function run() {
  const deadline = Date.now() + BUDGET_MS;
  const errors: string[] = [];
  const client = await pool.connect();
  try {
    try { await ensureNtzsSchema(client); } catch (e) { errors.push(`schema(ntzs): ${errMsg(e)}`); }
    try { await ensureDonationsSchema(); } catch (e) { errors.push(`schema(donations): ${errMsg(e)}`); }
    try { await ensureSnippeSchema(client); } catch (e) { errors.push(`schema(snippe): ${errMsg(e)}`); }

    let ntzsRes = null, snippeRes = null;
    try { ntzsRes = await settleNtzs(client, deadline); } catch (e) { errors.push(`ntzs: ${errMsg(e)}`); }
    try { snippeRes = await settleSnippe(client, deadline); } catch (e) { errors.push(`snippe: ${errMsg(e)}`); }

    return { success: true, ntzs: ntzsRes, snippe: snippeRes, errors };
  } finally {
    client.release();
  }
}

async function handle(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await run());
  } catch (error) {
    // Only pool.connect can land here; surface the real reason instead of a
    // generic string so the admin button shows what actually broke.
    console.error('cron settle-deposits error:', error);
    return NextResponse.json({ error: errMsg(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) { return handle(request); }
export async function GET(request: NextRequest) { return handle(request); }
