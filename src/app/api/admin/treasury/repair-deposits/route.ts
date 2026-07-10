import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import {
  credit,
  isDepositSuccessStatus,
  resolveOwnerFromRow,
  getMasterNtzsUserId,
  getTotalsByOwnerType,
} from '@/lib/wallet/ledger';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Repair deposits that minted into the master treasury but never credited the
 * member's balance — the money-in half of a positive treasury drift.
 *
 * Unlike /settle-deposits (which only looks at posted=false rows), this scans
 * EVERY deposit in a date window, because the stuck ones were wrongly marked
 * settled (posted=true) without ever crediting. It is safe:
 *
 *  - ONLY credits deposits nTZS confirms minted (a confirmed payment). Anything
 *    still submitted/processing is never credited.
 *  - Idempotent: each repaired deposit is stamped metadata.repaired_credit, so
 *    re-running never credits the same deposit twice.
 *  - Capped at the treasury's real surplus (master on-chain − liabilities), so
 *    it can never create more balance than the master actually holds.
 *
 * Default window is 2026-07-08 .. 2026-07-11 (the reported affected days);
 * override with ?from=YYYY-MM-DD&to=YYYY-MM-DD (to is exclusive).
 *
 *   GET  → dry run: every deposit in the window with its live nTZS status,
 *          owner, that member's balance, and whether it would be credited.
 *   POST → apply: credit each minted, un-repaired deposit to its owner.
 */
const DEFAULT_FROM = '2026-07-08';
const DEFAULT_TO = '2026-07-11'; // exclusive — includes all of the 10th
const BATCH = 15;

type Row = {
  id: number; ntzsId: string | null; amountTzs: number; netTzs: number | null;
  dbStatus: string; posted: boolean; createdAt: string;
  toMemberId: number | null; toGroupId: number | null; fromMemberId: number | null;
  metadata: Record<string, unknown> | null; note: string | null;
};
type Live = { status: string | null; userId: string | null };

function windowOf(request: NextRequest): { from: string; to: string } {
  const { searchParams } = new URL(request.url);
  return { from: searchParams.get('from') || DEFAULT_FROM, to: searchParams.get('to') || DEFAULT_TO };
}

async function gather(client: PoolClient, from: string, to: string): Promise<Row[]> {
  const r = await client.query(
    `SELECT id, ntzs_id, amount_tzs, net_tzs, status, posted, created_at,
            to_member_id, to_group_id, from_member_id, metadata, note
     FROM ntzs_transactions
     WHERE type = 'deposit' AND ntzs_id IS NOT NULL
       AND created_at >= $1::date AND created_at < $2::date
     ORDER BY created_at ASC`,
    [from, to]
  );
  return (r.rows as {
    id: number; ntzs_id: string | null; amount_tzs: string; net_tzs: string | null;
    status: string; posted: boolean; created_at: string;
    to_member_id: number | null; to_group_id: number | null; from_member_id: number | null;
    metadata: Record<string, unknown> | null; note: string | null;
  }[]).map((x) => ({
    id: x.id, ntzsId: x.ntzs_id, amountTzs: Math.round(Number(x.amount_tzs)),
    netTzs: x.net_tzs != null ? Math.round(Number(x.net_tzs)) : null,
    dbStatus: x.status, posted: x.posted, createdAt: x.created_at,
    toMemberId: x.to_member_id, toGroupId: x.to_group_id, fromMemberId: x.from_member_id,
    metadata: x.metadata, note: x.note,
  }));
}

async function liveOf(ntzsId: string): Promise<Live> {
  try {
    const d = await ntzs.deposits.get(ntzsId);
    return { status: d.status ?? null, userId: (d as { userId?: string }).userId ?? null };
  } catch {
    return { status: null, userId: null };
  }
}

async function fetchLive(rows: Row[]): Promise<Live[]> {
  const out: Live[] = rows.map(() => ({ status: null, userId: null }));
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const res = await Promise.all(slice.map((x) => (x.ntzsId ? liveOf(x.ntzsId) : Promise.resolve({ status: null, userId: null }))));
    for (let j = 0; j < slice.length; j++) out[i + j] = res[j];
  }
  return out;
}

function ownerOf(r: Row) {
  return resolveOwnerFromRow(
    { to_member_id: r.toMemberId, to_group_id: r.toGroupId, from_member_id: r.fromMemberId, from_group_id: null, metadata: r.metadata },
    'to'
  );
}

function alreadyRepaired(r: Row): boolean {
  return r.metadata?.repaired_credit === true;
}

async function memberInfo(client: PoolClient, ids: number[]) {
  const map = new Map<number, { name: string | null; balanceTzs: number | null }>();
  const uniq = Array.from(new Set(ids.filter((x): x is number => !!x)));
  if (uniq.length === 0) return map;
  const r = await client.query(
    `SELECT m.id, m.full_name,
            (SELECT balance_tzs FROM wallet_accounts wa WHERE wa.owner_type = 'member' AND wa.owner_id = m.id LIMIT 1) AS balance_tzs
     FROM members m WHERE m.id = ANY($1::int[])`,
    [uniq]
  );
  for (const row of r.rows as { id: number; full_name: string | null; balance_tzs: string | null }[]) {
    map.set(row.id, { name: row.full_name, balanceTzs: row.balance_tzs != null ? Math.round(Number(row.balance_tzs)) : null });
  }
  return map;
}

/** Master on-chain balance − ledger liabilities = the surplus we can credit. */
async function surplusTzs(client: PoolClient, masterUserId: string): Promise<number | null> {
  const totals = await getTotalsByOwnerType(client);
  const liabilities = Object.entries(totals).filter(([t]) => t !== 'master').reduce((s, [, v]) => s + v, 0);
  try {
    const onChain = Math.floor(Number((await ntzs.users.getBalance(masterUserId)).balanceTzs ?? 0));
    return onChain - liabilities;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NTZS_API_KEY) return NextResponse.json({ error: 'NTZS_API_KEY not configured' }, { status: 503 });

  const { from, to } = windowOf(request);
  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);
    const masterUserId = await getMasterNtzsUserId(client);
    const rows = await gather(client, from, to);
    const live = await fetchLive(rows);
    const info = await memberInfo(client, rows.map((r) => r.toMemberId).filter((x): x is number => !!x));
    const surplus = await surplusTzs(client, masterUserId);

    let wouldCreditTzs = 0, mintedNoOwnerTzs = 0, inFlightTzs = 0, alreadyDoneTzs = 0;
    const deposits = rows.map((r, i) => {
      const minted = isDepositSuccessStatus(live[i].status);
      const owner = ownerOf(r);
      const repaired = alreadyRepaired(r);
      let reason: string;
      if (repaired) { reason = 'already_repaired'; alreadyDoneTzs += r.amountTzs; }
      else if (minted && owner) { reason = 'would_credit'; wouldCreditTzs += r.amountTzs; }
      else if (minted && !owner) { reason = 'minted_no_owner'; mintedNoOwnerTzs += r.amountTzs; }
      else if (live[i].status && ['failed', 'cancelled', 'canceled', 'expired', 'reversed', 'refunded', 'rejected'].includes(live[i].status!.toLowerCase())) reason = 'failed';
      else { reason = 'in_flight'; inFlightTzs += r.amountTzs; }
      const mi = r.toMemberId ? info.get(r.toMemberId) : undefined;
      return {
        date: r.createdAt, amountTzs: r.amountTzs, dbStatus: r.dbStatus, liveStatus: live[i].status,
        mintedIntoMaster: !!live[i].userId && live[i].userId === masterUserId, posted: r.posted,
        toMemberId: r.toMemberId, member: mi?.name ?? null, memberBalanceTzs: mi?.balanceTzs ?? null,
        resolvesTo: owner ? `${owner.ownerType}#${owner.ownerId}` : null,
        note: r.note, reason,
      };
    });

    return NextResponse.json({
      success: true,
      mode: 'dry-run',
      window: { from, to },
      masterUserId,
      depositsInWindow: rows.length,
      wouldCreditTzs, wouldCreditCount: deposits.filter((d) => d.reason === 'would_credit').length,
      alreadyRepairedTzs: alreadyDoneTzs,
      mintedNoOwnerTzs, inFlightTzs,
      treasurySurplusTzs: surplus,
      capNote: surplus != null && wouldCreditTzs > surplus
        ? `Would-credit (${wouldCreditTzs}) exceeds treasury surplus (${surplus}); POST will credit only up to the surplus (oldest first).`
        : 'Would-credit fits within the treasury surplus — safe to apply.',
      deposits,
      note: 'Only reason="would_credit" rows credit on POST (nTZS confirms minted, owner known, not yet repaired). Verify wouldCreditTzs ≈ the treasury drift before applying.',
    });
  } catch (error) {
    console.error('Repair deposits (dry-run) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NTZS_API_KEY) return NextResponse.json({ error: 'NTZS_API_KEY not configured' }, { status: 503 });

  const { from, to } = windowOf(request);
  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);
    const masterUserId = await getMasterNtzsUserId(client);
    const rows = await gather(client, from, to);
    const live = await fetchLive(rows);

    // Safety ceiling: never credit more than the treasury actually holds beyond
    // what it already owes. null (on-chain read failed) → refuse rather than guess.
    const ceiling = await surplusTzs(client, masterUserId);
    if (ceiling == null) {
      return NextResponse.json({ error: 'Could not read master on-chain balance to bound the repair. Try again.' }, { status: 502 });
    }

    let credited = 0, creditedTzs = 0, skippedInFlight = 0, skippedNoOwner = 0, skippedRepaired = 0, failed = 0, cappedOut = 0;
    const creditedMembers: Record<string, { name?: string; tzs: number }> = {};
    let remainingCeiling = Math.max(0, ceiling);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (alreadyRepaired(r)) { skippedRepaired++; continue; }
      if (!isDepositSuccessStatus(live[i].status)) { skippedInFlight++; continue; } // submitted/processing/failed — not confirmed money
      const owner = ownerOf(r);
      if (!owner) { skippedNoOwner++; continue; }
      const amount = r.netTzs ?? r.amountTzs;
      if (amount > remainingCeiling) { cappedOut++; continue; } // would exceed treasury surplus — leave it

      await client.query('BEGIN');
      try {
        await credit(client, owner, amount);
        await client.query(
          `UPDATE ntzs_transactions
             SET posted = true,
                 status = $2,
                 metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('repaired_credit', true, 'repaired_window', $3::text),
                 updated_at = NOW()
           WHERE id = $1`,
          [r.id, live[i].status, `${from}..${to}`]
        );
        await client.query('COMMIT');
        credited++; creditedTzs += amount; remainingCeiling -= amount;
        const key = `${owner.ownerType}#${owner.ownerId}`;
        creditedMembers[key] = { tzs: (creditedMembers[key]?.tzs ?? 0) + amount };
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        failed++;
        console.error('Repair deposit failed for id', r.id, e);
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'applied',
      window: { from, to },
      depositsInWindow: rows.length,
      credited, creditedTzs, creditedMembers,
      skippedInFlight, skippedNoOwner, skippedRepaired, cappedOut, failed,
      treasurySurplusBeforeTzs: ceiling,
      note:
        'Credited every minted deposit in the window to its owner (idempotent — re-running is safe). ' +
        'skippedInFlight are still submitted/processing (not landed). cappedOut would have exceeded the treasury surplus.',
    });
  } catch (error) {
    console.error('Repair deposits (apply) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
