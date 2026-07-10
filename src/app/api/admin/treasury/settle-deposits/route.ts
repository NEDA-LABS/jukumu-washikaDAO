import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import {
  settleExternalTransaction,
  isDepositSuccessStatus,
  resolveOwnerFromRow,
  getMasterNtzsUserId,
} from '@/lib/wallet/ledger';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Settle nTZS deposits that minted into the master wallet but never credited the
 * owner's database balance. The webhook that would do this automatically may be
 * down, so this is the manual/bulk fallback.
 *
 * A deposit credits ONLY when nTZS reports it minted (a confirmed payment).
 * Deposits still `submitted`/`processing` are NOT credited — they haven't
 * landed yet. This mirrors how balances self-heal on each member wallet read.
 *
 *   GET  → diagnostic (read-only): for every unsettled deposit, the live nTZS
 *          status, whether it minted into the master wallet, the owner it
 *          resolves to, that member's current balance, and a plain reason.
 *   POST → settle: credit every deposit nTZS confirms minted (idempotent).
 */
type Pending = {
  id: number; ntzsId: string; amountTzs: number; netTzs: number | null; dbStatus: string;
  toMemberId: number | null; toGroupId: number | null; fromMemberId: number | null;
  metadata: Record<string, unknown> | null; note: string | null;
};

type Live = { status: string | null; userId: string | null };

const BATCH = 15;

async function gatherPending(client: PoolClient): Promise<Pending[]> {
  const r = await client.query(
    `SELECT id, ntzs_id, amount_tzs, net_tzs, status, to_member_id, to_group_id, from_member_id, metadata, note
     FROM ntzs_transactions
     WHERE type = 'deposit' AND posted = false AND ntzs_id IS NOT NULL
     ORDER BY created_at ASC`
  );
  return (r.rows as {
    id: number; ntzs_id: string; amount_tzs: string; net_tzs: string | null; status: string;
    to_member_id: number | null; to_group_id: number | null; from_member_id: number | null;
    metadata: Record<string, unknown> | null; note: string | null;
  }[]).map((x) => ({
    id: x.id, ntzsId: x.ntzs_id, amountTzs: Math.round(Number(x.amount_tzs)),
    netTzs: x.net_tzs != null ? Math.round(Number(x.net_tzs)) : null, dbStatus: x.status,
    toMemberId: x.to_member_id, toGroupId: x.to_group_id, fromMemberId: x.from_member_id,
    metadata: x.metadata, note: x.note,
  }));
}

/** Live nTZS status + owning wallet for one deposit. */
async function liveOf(ntzsId: string): Promise<Live> {
  try {
    const d = await ntzs.deposits.get(ntzsId);
    return { status: d.status ?? null, userId: (d as { userId?: string }).userId ?? null };
  } catch {
    return { status: null, userId: null };
  }
}

async function fetchLive(list: Pending[]): Promise<Live[]> {
  const out: Live[] = new Array(list.length).fill(null).map(() => ({ status: null, userId: null }));
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH);
    const res = await Promise.all(slice.map((p) => liveOf(p.ntzsId)));
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

/** Member names + current balances for the deposits that name a member. */
async function memberInfo(client: PoolClient, memberIds: number[]): Promise<Map<number, { name: string | null; balanceTzs: number | null }>> {
  const map = new Map<number, { name: string | null; balanceTzs: number | null }>();
  if (memberIds.length === 0) return map;
  const ids = Array.from(new Set(memberIds));
  const r = await client.query(
    `SELECT m.id, m.full_name,
            (SELECT balance_tzs FROM wallet_accounts wa WHERE wa.owner_type = 'member' AND wa.owner_id = m.id LIMIT 1) AS balance_tzs
     FROM members m WHERE m.id = ANY($1::int[])`,
    [ids]
  );
  for (const row of r.rows as { id: number; full_name: string | null; balance_tzs: string | null }[]) {
    map.set(row.id, { name: row.full_name, balanceTzs: row.balance_tzs != null ? Math.round(Number(row.balance_tzs)) : null });
  }
  return map;
}

/** Classify a deposit for display / settlement decision. */
function classify(p: Pending, live: Live, masterUserId: string) {
  const minted = isDepositSuccessStatus(live.status);
  const owner = resolvedOwnerOf(p);
  const isMaster = !!live.userId && live.userId === masterUserId;
  let reason: string;
  if (live.status == null) reason = 'status_unknown';
  else if (minted && owner) reason = 'would_credit';
  else if (minted && !owner) reason = 'minted_no_owner';
  else if (['failed', 'cancelled', 'canceled', 'expired', 'reversed', 'refunded', 'rejected'].includes(live.status.toLowerCase())) reason = 'failed';
  else reason = 'in_flight'; // pending / submitted / processing — not landed yet
  return { minted, owner, isMaster, reason, wouldCredit: minted && !!owner };
}

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NTZS_API_KEY) return NextResponse.json({ error: 'NTZS_API_KEY not configured' }, { status: 503 });

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);
    const masterUserId = await getMasterNtzsUserId(client);
    const pending = await gatherPending(client);
    const live = await fetchLive(pending);
    const info = await memberInfo(client, pending.map((p) => p.toMemberId).filter((x): x is number => !!x));

    let landedWithOwner = 0, landedWithOwnerTzs = 0;
    let landedNoOwner = 0, landedNoOwnerTzs = 0;
    let inFlight = 0, inFlightTzs = 0;
    let failed = 0, failedTzs = 0;

    const deposits = pending.map((p, i) => {
      const c = classify(p, live[i], masterUserId);
      if (c.reason === 'would_credit') { landedWithOwner++; landedWithOwnerTzs += p.amountTzs; }
      else if (c.reason === 'minted_no_owner') { landedNoOwner++; landedNoOwnerTzs += p.amountTzs; }
      else if (c.reason === 'failed') { failed++; failedTzs += p.amountTzs; }
      else { inFlight++; inFlightTzs += p.amountTzs; } // in_flight + status_unknown
      const mi = p.toMemberId ? info.get(p.toMemberId) : undefined;
      return {
        amountTzs: p.amountTzs, dbStatus: p.dbStatus, liveStatus: live[i].status,
        mintedIntoMaster: c.isMaster, note: p.note,
        toMemberId: p.toMemberId, member: mi?.name ?? null, memberBalanceTzs: mi?.balanceTzs ?? null,
        resolvesTo: c.owner ? `${c.owner.ownerType}#${c.owner.ownerId}` : null,
        reason: c.reason, wouldCredit: c.wouldCredit,
      };
    });

    return NextResponse.json({
      success: true,
      mode: 'diagnostic',
      masterUserId,
      unsettledDeposits: pending.length,
      // Ready to credit on POST — nTZS confirms these minted and they have an owner.
      landedWithOwner, landedWithOwnerTzs,
      // Minted but no owner column/metadata — need attribution before they can credit.
      landedNoOwner, landedNoOwnerTzs,
      // Not yet minted (still submitted/processing) — these must NOT credit yet.
      inFlight, inFlightTzs,
      // Terminal failures on nTZS — will never credit.
      failed, failedTzs,
      deposits,
      note:
        'Only reason="would_credit" rows credit on POST (nTZS confirms minted). ' +
        'reason="in_flight" are still submitted/processing — they have not landed, so per the rule they are not credited. ' +
        'mintedIntoMaster=true confirms the money is in the master treasury wallet.',
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
    const masterUserId = await getMasterNtzsUserId(client);
    const pending = await gatherPending(client);
    const live = await fetchLive(pending);

    let credited = 0, creditedTzs = 0, noOwner = 0, inFlight = 0, failed = 0;
    const creditedMembers: Record<string, number> = {};

    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      const c = classify(p, live[i], masterUserId);
      if (c.reason === 'in_flight' || c.reason === 'status_unknown') { inFlight++; continue; }
      if (c.reason === 'failed') { continue; }
      if (!c.owner) { noOwner++; continue; }
      await client.query('BEGIN');
      try {
        const r = await settleExternalTransaction(client, p.ntzsId, live[i].status as string);
        await client.query('COMMIT');
        if (r.applied) {
          credited++; creditedTzs += p.amountTzs;
          const key = `${c.owner.ownerType}#${c.owner.ownerId}`;
          creditedMembers[key] = (creditedMembers[key] ?? 0) + p.amountTzs;
        } else {
          noOwner++;
        }
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        failed++;
        console.error('Settle deposit failed for', p.ntzsId, e);
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'applied',
      masterUserId,
      unsettledDeposits: pending.length,
      credited, creditedTzs, creditedMembers,
      noOwner, inFlight, failed,
      note:
        'Credited every deposit nTZS confirmed minted. ' +
        'inFlight are still submitted/processing (not landed) — run again once they mint. ' +
        'noOwner minted but carry no owner attribution.',
    });
  } catch (error) {
    console.error('Settle deposits (apply) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
