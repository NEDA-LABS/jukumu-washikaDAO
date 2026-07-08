import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { settleExternalTransaction, isDepositSuccessStatus } from '@/lib/wallet/ledger';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Settle nTZS deposits that minted into the master wallet but never credited the
 * member (the webhook wasn't delivered / the sync didn't catch it). This is the
 * money-in side of the +drift: funds are in the master, not on anyone's balance.
 *
 *   GET  → diagnostic: every unsettled deposit's DB status vs its LIVE nTZS
 *          status, grouped, plus the total that would credit. Changes nothing.
 *   POST → settle: for each unsettled deposit whose live status means it landed,
 *          credit the recipient (idempotent via settleExternalTransaction).
 */
type Pending = { id: number; ntzsId: string; amountTzs: number; dbStatus: string };

const BATCH = 15;

async function gatherPending(client: PoolClient): Promise<Pending[]> {
  const r = await client.query(
    `SELECT id, ntzs_id, amount_tzs, status
     FROM ntzs_transactions
     WHERE type = 'deposit' AND posted = false AND ntzs_id IS NOT NULL
     ORDER BY created_at ASC`
  );
  return (r.rows as { id: number; ntzs_id: string; amount_tzs: string; status: string }[]).map((x) => ({
    id: x.id, ntzsId: x.ntzs_id, amountTzs: Math.round(Number(x.amount_tzs)), dbStatus: x.status,
  }));
}

async function liveStatus(ntzsId: string): Promise<string | null> {
  try { return (await ntzs.deposits.get(ntzsId)).status ?? null; } catch { return null; }
}

async function fetchLive(list: Pending[]): Promise<(string | null)[]> {
  const out: (string | null)[] = new Array(list.length).fill(null);
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH);
    const res = await Promise.all(slice.map((p) => liveStatus(p.ntzsId)));
    for (let j = 0; j < slice.length; j++) out[i + j] = res[j];
  }
  return out;
}

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NTZS_API_KEY) return NextResponse.json({ error: 'NTZS_API_KEY not configured' }, { status: 503 });

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);
    const pending = await gatherPending(client);
    const live = await fetchLive(pending);

    // Group by live status so we can SEE what a landed deposit actually reports.
    const byStatus: Record<string, { count: number; totalTzs: number; willCredit: boolean }> = {};
    let creditableCount = 0, creditableTzs = 0, readFailed = 0;
    for (let i = 0; i < pending.length; i++) {
      const s = live[i];
      if (s === null) { readFailed++; continue; }
      const key = s.toLowerCase();
      const willCredit = isDepositSuccessStatus(s);
      byStatus[key] ??= { count: 0, totalTzs: 0, willCredit };
      byStatus[key].count++;
      byStatus[key].totalTzs += pending[i].amountTzs;
      if (willCredit) { creditableCount++; creditableTzs += pending[i].amountTzs; }
    }

    return NextResponse.json({
      success: true,
      mode: 'dry-run',
      unsettledDeposits: pending.length,
      readFailed,
      creditableCount,
      creditableTzs,
      liveStatusBreakdown: byStatus,
      note: 'These deposits minted but never credited. POST to credit the ones whose live nTZS status means they landed. If a landed status is missing from creditable, tell the developer the status name.',
    });
  } catch (error) {
    console.error('Settle deposits (dry-run) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NTZS_API_KEY) return NextResponse.json({ error: 'NTZS_API_KEY not configured' }, { status: 503 });

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);
    const pending = await gatherPending(client);
    const live = await fetchLive(pending);

    let credited = 0, creditedTzs = 0, skipped = 0, failed = 0;
    for (let i = 0; i < pending.length; i++) {
      const s = live[i];
      if (!isDepositSuccessStatus(s)) { skipped++; continue; }
      await client.query('BEGIN');
      try {
        const r = await settleExternalTransaction(client, pending[i].ntzsId, s as string);
        await client.query('COMMIT');
        if (r.applied) { credited++; creditedTzs += pending[i].amountTzs; }
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        failed++;
        console.error('Settle deposit failed for', pending[i].ntzsId, e);
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'applied',
      unsettledDeposits: pending.length,
      credited,
      creditedTzs,
      skipped,
      failed,
      note: 'Credited deposits that landed. Balances now reflect them; the drift should shrink by the credited total.',
    });
  } catch (error) {
    console.error('Settle deposits (apply) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
