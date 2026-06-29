import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { getMasterNtzsUserId } from '@/lib/wallet/ledger';
import { ntzs, NtzsApiError } from '@/lib/ntzs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * On-chain treasury sweep (admin only).
 *
 * The custodial migration seeded DB ledger balances from each per-entity
 * on-chain wallet but left the actual nTZS sitting in those wallets ("import
 * now, sweep later"). Internal transfers are DB-only, so they work — but an
 * off-ramp (withdrawal) burns from the MASTER wallet, which holds nothing until
 * the funds are physically swept. This consolidates every per-entity on-chain
 * balance into the master wallet so withdrawals can actually settle.
 *
 * Scope is limited to FUNDED ledger accounts (balance_tzs > 0). Because the
 * ledger total equals the on-chain total (see /reconcile), every shilling
 * on-chain is reflected in some funded account, so this captures all sweepable
 * funds while keeping the on-chain reads small. Each pass runs under a wall-clock
 * budget and returns `done`/`remaining`; the caller re-invokes until done. A
 * swept wallet is at 0 on-chain, so it is skipped on the next pass — the sweep
 * is naturally idempotent and resumable. The DB ledger is never touched (it
 * stays the record of who owns what); only the on-chain backing is consolidated.
 *
 *   GET  → dry run: funded wallets, total sweepable, master balance. No change.
 *   POST → apply one budgeted pass: transfer funded wallets' on-chain balances
 *          into the master via nTZS user->user transfers.
 */
type Entity = { ownerType: 'member' | 'group' | 'investor'; ownerId: number; ntzsUserId: string };

const READ_BATCH = 20;      // concurrent on-chain reads
const TRANSFER_BATCH = 8;   // concurrent transfers
const MIN_SWEEP_TZS = 1;    // skip dust
const BUDGET_MS = 18_000;   // stop a pass before the platform function timeout

/** Funded entities only (ledger balance > 0), excluding the master itself. */
async function gatherFundedEntities(client: PoolClient, excludeNtzsUserId: string | null): Promise<Entity[]> {
  const out: Entity[] = [];
  const m = await client.query(
    `SELECT m.id, m.ntzs_user_id FROM members m
     JOIN wallet_accounts w ON w.owner_type = 'member' AND w.owner_id = m.id
     WHERE m.ntzs_user_id IS NOT NULL AND w.balance_tzs > 0`
  );
  for (const r of m.rows as { id: number; ntzs_user_id: string }[]) out.push({ ownerType: 'member', ownerId: r.id, ntzsUserId: r.ntzs_user_id });
  const g = await client.query(
    `SELECT g.id, g.ntzs_user_id FROM groups g
     JOIN wallet_accounts w ON w.owner_type = 'group' AND w.owner_id = g.id
     WHERE g.ntzs_user_id IS NOT NULL AND w.balance_tzs > 0`
  );
  for (const r of g.rows as { id: number; ntzs_user_id: string }[]) out.push({ ownerType: 'group', ownerId: r.id, ntzsUserId: r.ntzs_user_id });
  try {
    const i = await client.query(
      `SELECT ip.user_id AS id, ip.ntzs_user_id FROM investor_profiles ip
       JOIN wallet_accounts w ON w.owner_type = 'investor' AND w.owner_id = ip.user_id
       WHERE ip.ntzs_user_id IS NOT NULL AND w.balance_tzs > 0`
    );
    for (const r of i.rows as { id: number; ntzs_user_id: string }[]) out.push({ ownerType: 'investor', ownerId: r.id, ntzsUserId: r.ntzs_user_id });
  } catch { /* investor_profiles may not exist */ }
  return out.filter(e => e.ntzsUserId && e.ntzsUserId !== excludeNtzsUserId);
}

async function onChainBalance(ntzsUserId: string): Promise<number> {
  const u = await ntzs.users.getBalance(ntzsUserId);
  return Math.floor(Number(u.balanceTzs ?? 0));
}

/** Fetch on-chain balances in parallel batches; aligned with `entities`, null = read failed. */
async function fetchOnChain(entities: Entity[]): Promise<(number | null)[]> {
  const balances: (number | null)[] = new Array(entities.length).fill(null);
  for (let i = 0; i < entities.length; i += READ_BATCH) {
    const slice = entities.slice(i, i + READ_BATCH);
    const res = await Promise.all(slice.map(e => onChainBalance(e.ntzsUserId).then(v => v).catch(() => null)));
    for (let j = 0; j < slice.length; j++) balances[i + j] = res[j];
  }
  return balances;
}

async function masterOnChain(masterUserId: string | null): Promise<number | null> {
  if (!masterUserId) return null;
  try { return Math.floor(Number((await ntzs.users.getBalance(masterUserId)).balanceTzs ?? 0)); }
  catch { return null; }
}

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NTZS_API_KEY) return NextResponse.json({ error: 'NTZS_API_KEY not configured' }, { status: 503 });

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const masterRow = await client.query(
      `SELECT ntzs_user_id FROM wallet_accounts WHERE owner_type = 'master' AND owner_id = 0 LIMIT 1`
    );
    const masterUserId = (masterRow.rows[0] as { ntzs_user_id: string | null } | undefined)?.ntzs_user_id ?? null;

    const entities = await gatherFundedEntities(client, masterUserId);
    const balances = await fetchOnChain(entities);

    let totalSweepableTzs = 0, fundedCount = 0, failed = 0;
    const wallets: Record<string, unknown>[] = [];
    for (let i = 0; i < entities.length; i++) {
      const b = balances[i];
      if (b === null) { failed++; continue; }
      if (b >= MIN_SWEEP_TZS) {
        totalSweepableTzs += b;
        fundedCount++;
        if (wallets.length < 100) wallets.push({ ownerType: entities[i].ownerType, ownerId: entities[i].ownerId, onChainTzs: b });
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'dry-run',
      masterProvisioned: !!masterUserId,
      masterOnChainTzs: await masterOnChain(masterUserId),
      fundedAccounts: entities.length,
      walletsWithOnChainFunds: fundedCount,
      totalSweepableTzs,
      readFailed: failed,
      wallets,
      note: 'Nothing changed. POST to move these on-chain balances into the master wallet.',
    });
  } catch (error) {
    console.error('Treasury sweep (dry-run) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NTZS_API_KEY) return NextResponse.json({ error: 'NTZS_API_KEY not configured' }, { status: 503 });

  const started = Date.now();
  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    // Provision the master if needed so we always have a sink to sweep into.
    const masterUserId = await getMasterNtzsUserId(client);

    const entities = await gatherFundedEntities(client, masterUserId);
    const balances = await fetchOnChain(entities);

    // Only sweep wallets that actually hold on-chain funds this pass.
    const todo = entities
      .map((e, i) => ({ e, balance: balances[i] }))
      .filter((x): x is { e: Entity; balance: number } => x.balance !== null && x.balance >= MIN_SWEEP_TZS);

    let swept = 0, failed = 0, totalSentTzs = 0, totalReceivedTzs = 0, totalFeesTzs = 0;
    let budgetHit = false, processed = 0;
    const failures: Record<string, unknown>[] = [];

    for (let i = 0; i < todo.length; i += TRANSFER_BATCH) {
      // Stop before the platform timeout; the caller re-invokes for the rest.
      if (Date.now() - started > BUDGET_MS) { budgetHit = true; break; }
      const slice = todo.slice(i, i + TRANSFER_BATCH);
      const results = await Promise.all(slice.map(async ({ e, balance }) => {
        try {
          const t = await ntzs.transfers.create({ fromUserId: e.ntzsUserId, toUserId: masterUserId, amountTzs: balance });
          return { ok: true as const, e, sent: balance, received: Number(t.recipientAmountTzs ?? balance), fee: Number(t.feeAmountTzs ?? 0) };
        } catch (err) {
          const reason = err instanceof NtzsApiError ? (err.body?.message || err.body?.error || `HTTP ${err.status}`) : (err instanceof Error ? err.message : String(err));
          return { ok: false as const, e, balance, reason };
        }
      }));
      for (const r of results) {
        processed++;
        if (r.ok) {
          swept++;
          totalSentTzs += r.sent;
          totalReceivedTzs += r.received;
          totalFeesTzs += r.fee;
        } else {
          failed++;
          if (failures.length < 100) failures.push({ ownerType: r.e.ownerType, ownerId: r.e.ownerId, onChainTzs: r.balance, reason: r.reason });
        }
      }
    }

    const remaining = todo.length - processed;
    const done = !budgetHit;

    return NextResponse.json({
      success: true,
      mode: 'applied',
      done,
      remaining,
      walletsWithOnChainFunds: todo.length,
      swept,
      failed,
      totalSentTzs,
      totalReceivedTzs,
      totalFeesTzs,
      masterOnChainTzs: await masterOnChain(masterUserId),
      failures,
      note: !done
        ? `Swept ${swept} this pass; ${remaining} remaining — call again to continue.`
        : failed > 0
          ? 'Finished, but some transfers failed (see failures). Call again to retry — swept wallets are now empty and skipped.'
          : 'Swept all funded wallets into the master. Withdrawals can now settle. Verify with GET /api/admin/treasury/reconcile.',
    });
  } catch (error) {
    console.error('Treasury sweep (apply) error:', error);
    if (error instanceof NtzsApiError) {
      return NextResponse.json({ error: error.body?.message || error.body?.error || 'Sweep failed' }, { status: 502 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
