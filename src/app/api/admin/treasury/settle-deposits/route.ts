import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { settleExternalTransaction, isDepositSuccessStatus, resolveOwnerFromRow } from '@/lib/wallet/ledger';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Settle nTZS deposits that minted into the master wallet but never credited the
 * owner. This is the money-in side of the +drift: funds are in the master, not
 * on anyone's balance.
 *
 *   GET  → diagnostic: dumps each unsettled deposit's owner columns / metadata /
 *          note, the owner settlement WOULD resolve, and the live nTZS status.
 *          Read-only — this is how we see why a deposit isn't crediting.
 *   POST → settle: for each landed deposit, credit the resolved owner
 *          (member / group / investor) via settleExternalTransaction (idempotent).
 */
type Pending = {
  id: number; ntzsId: string; amountTzs: number; dbStatus: string;
  toMemberId: number | null; toGroupId: number | null; fromMemberId: number | null;
  metadata: Record<string, unknown> | null; note: string | null;
};

const BATCH = 15;

async function gatherPending(client: PoolClient): Promise<Pending[]> {
  const r = await client.query(
    `SELECT id, ntzs_id, amount_tzs, status, to_member_id, to_group_id, from_member_id, metadata, note
     FROM ntzs_transactions
     WHERE type = 'deposit' AND posted = false AND ntzs_id IS NOT NULL
     ORDER BY created_at ASC`
  );
  return (r.rows as {
    id: number; ntzs_id: string; amount_tzs: string; status: string;
    to_member_id: number | null; to_group_id: number | null; from_member_id: number | null;
    metadata: Record<string, unknown> | null; note: string | null;
  }[]).map((x) => ({
    id: x.id, ntzsId: x.ntzs_id, amountTzs: Math.round(Number(x.amount_tzs)), dbStatus: x.status,
    toMemberId: x.to_member_id, toGroupId: x.to_group_id, fromMemberId: x.from_member_id,
    metadata: x.metadata, note: x.note,
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

function resolvedOwnerOf(p: Pending) {
  return resolveOwnerFromRow(
    { to_member_id: p.toMemberId, to_group_id: p.toGroupId, from_member_id: p.fromMemberId, from_group_id: null, metadata: p.metadata },
    'to'
  );
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

    let landedWithOwner = 0, landedWithOwnerTzs = 0, landedNoOwner = 0, landedNoOwnerTzs = 0;
    const deposits = pending.map((p, i) => {
      const s = live[i];
      const owner = resolvedOwnerOf(p);
      const landed = isDepositSuccessStatus(s);
      if (landed && owner) { landedWithOwner++; landedWithOwnerTzs += p.amountTzs; }
      if (landed && !owner) { landedNoOwner++; landedNoOwnerTzs += p.amountTzs; }
      return {
        amountTzs: p.amountTzs, dbStatus: p.dbStatus, liveStatus: s, note: p.note,
        toMemberId: p.toMemberId, toGroupId: p.toGroupId, metadata: p.metadata,
        resolvesTo: owner ? `${owner.ownerType}#${owner.ownerId}` : null,
        wouldCredit: !!(landed && owner),
      };
    });

    return NextResponse.json({
      success: true,
      mode: 'diagnostic',
      unsettledDeposits: pending.length,
      landedWithOwner, landedWithOwnerTzs,
      landedNoOwner, landedNoOwnerTzs,
      deposits,
      note: 'wouldCredit=true rows will land on POST. landedNoOwner rows minted but carry no owner (no to_member_id/to_group_id/metadata.investor_id) — those are the ones that need attribution.',
    });
  } catch (error) {
    console.error('Settle deposits (diagnostic) error:', error);
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

    let credited = 0, creditedTzs = 0, noOwner = 0, inFlight = 0, failed = 0;
    for (let i = 0; i < pending.length; i++) {
      const s = live[i];
      if (!isDepositSuccessStatus(s)) { inFlight++; continue; }
      if (!resolvedOwnerOf(pending[i])) { noOwner++; continue; }
      await client.query('BEGIN');
      try {
        const r = await settleExternalTransaction(client, pending[i].ntzsId, s as string);
        await client.query('COMMIT');
        if (r.applied) { credited++; creditedTzs += pending[i].amountTzs; } else { noOwner++; }
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
      credited, creditedTzs, noOwner, inFlight, failed,
      note: 'Credited landed deposits that carry an owner. noOwner ones still need attribution.',
    });
  } catch (error) {
    console.error('Settle deposits (apply) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
