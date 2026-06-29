import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Treasury resync / repair (admin only).
 *
 *   GET  → dry run: report on-chain balance vs DB ledger balance per entity,
 *          list mismatches. Changes nothing.
 *   POST → restore: set a DB balance to its on-chain value only when on-chain is
 *          HIGHER (never reduces a balance). Repairs under-seeded accounts.
 *
 * On-chain reads run in parallel batches so this finishes within the function
 * timeout even for hundreds of entities. The on-chain wallets are the source of
 * truth at migration time (funds not yet swept), so no funds are at risk.
 */
type Entity = { ownerType: 'member' | 'group' | 'investor'; ownerId: number; ntzsUserId: string };

const BATCH = 20;

async function gatherEntities(client: PoolClient): Promise<Entity[]> {
  const out: Entity[] = [];
  const m = await client.query(`SELECT id, ntzs_user_id FROM members WHERE ntzs_user_id IS NOT NULL`);
  for (const r of m.rows as { id: number; ntzs_user_id: string }[]) out.push({ ownerType: 'member', ownerId: r.id, ntzsUserId: r.ntzs_user_id });
  const g = await client.query(`SELECT id, ntzs_user_id FROM groups WHERE ntzs_user_id IS NOT NULL`);
  for (const r of g.rows as { id: number; ntzs_user_id: string }[]) out.push({ ownerType: 'group', ownerId: r.id, ntzsUserId: r.ntzs_user_id });
  try {
    const i = await client.query(`SELECT user_id AS id, ntzs_user_id FROM investor_profiles WHERE ntzs_user_id IS NOT NULL`);
    for (const r of i.rows as { id: number; ntzs_user_id: string }[]) out.push({ ownerType: 'investor', ownerId: r.id, ntzsUserId: r.ntzs_user_id });
  } catch { /* investor_profiles may not exist */ }
  return out;
}

async function onChainBalance(ntzsUserId: string): Promise<number> {
  const u = await ntzs.users.getBalance(ntzsUserId);
  return Math.round(Number(u.balanceTzs ?? 0));
}

/** Fetch on-chain balances in parallel batches; aligned with `entities`, null = read failed. */
async function fetchOnChain(entities: Entity[]): Promise<(number | null)[]> {
  const balances: (number | null)[] = new Array(entities.length).fill(null);
  for (let i = 0; i < entities.length; i += BATCH) {
    const slice = entities.slice(i, i + BATCH);
    const res = await Promise.all(slice.map(e => onChainBalance(e.ntzsUserId).then(v => v).catch(() => null)));
    for (let j = 0; j < slice.length; j++) balances[i + j] = res[j];
  }
  return balances;
}

async function dbBalance(client: PoolClient, ownerType: string, ownerId: number): Promise<number> {
  const r = await client.query(
    `SELECT balance_tzs FROM wallet_accounts WHERE owner_type = $1 AND owner_id = $2 LIMIT 1`,
    [ownerType, ownerId]
  );
  return r.rows[0] ? Number((r.rows[0] as { balance_tzs: string }).balance_tzs) : 0;
}

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NTZS_API_KEY) return NextResponse.json({ error: 'NTZS_API_KEY not configured' }, { status: 503 });

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);
    const entities = await gatherEntities(client);
    const balances = await fetchOnChain(entities);

    let onChainTotal = 0, dbTotal = 0, failed = 0;
    const mismatches: Record<string, unknown>[] = [];

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const onchain = balances[i];
      if (onchain === null) { failed++; continue; }
      const db = await dbBalance(client, e.ownerType, e.ownerId);
      onChainTotal += onchain;
      dbTotal += db;
      if (onchain !== db && mismatches.length < 100) {
        mismatches.push({ ownerType: e.ownerType, ownerId: e.ownerId, onChainTzs: onchain, dbTzs: db, diffTzs: onchain - db });
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'dry-run',
      entitiesWithWallet: entities.length,
      onChainTotalTzs: onChainTotal,
      dbTotalTzs: dbTotal,
      missingInDbTzs: onChainTotal - dbTotal,
      mismatchCount: mismatches.length,
      failed,
      mismatches,
      note: 'Nothing changed. POST to restore under-seeded DB balances up to on-chain.',
    });
  } catch (error) {
    console.error('Treasury resync (dry-run) error:', error);
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
    const entities = await gatherEntities(client);
    const balances = await fetchOnChain(entities);

    let onChainTotal = 0, restored = 0, skippedHigherInDb = 0, failed = 0;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const onchain = balances[i];
      if (onchain === null) { failed++; continue; }
      onChainTotal += onchain;
      const db = await dbBalance(client, e.ownerType, e.ownerId);
      if (onchain > db) {
        await client.query(
          `INSERT INTO wallet_accounts (owner_type, owner_id, balance_tzs)
           VALUES ($1, $2, $3)
           ON CONFLICT (owner_type, owner_id)
           DO UPDATE SET balance_tzs = EXCLUDED.balance_tzs, updated_at = NOW()`,
          [e.ownerType, e.ownerId, onchain]
        );
        restored++;
      } else if (onchain < db) {
        skippedHigherInDb++; // SAFETY: never reduce a balance from an on-chain read
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'applied',
      entitiesWithWallet: entities.length,
      restored,
      skippedHigherInDb,
      failed,
      onChainTotalTzs: onChainTotal,
      note: 'Restored under-seeded balances up to on-chain values (never reduced any). Refresh the app.',
    });
  } catch (error) {
    console.error('Treasury resync (apply) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
