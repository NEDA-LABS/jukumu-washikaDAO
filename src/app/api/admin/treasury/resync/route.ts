import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';

/**
 * Treasury resync / repair (admin only).
 *
 *   GET  → dry run: for every entity with an on-chain wallet, report on-chain
 *          balance vs DB ledger balance, and list the mismatches. Changes nothing.
 *   POST → apply: set each entity's DB balance to its on-chain balance.
 *
 * This restores any balances the one-time import missed (e.g. an nTZS read that
 * errored, or a preview DB that was never seeded). The on-chain wallets are the
 * source of truth at migration time, before funds are swept into the master
 * wallet — so DB = on-chain is the correct reconciliation here.
 *
 * NOTE: POST force-overwrites DB balances with on-chain values, so run it during
 * migration/repair, before real internal-transfer activity has diverged the
 * ledger from the chain.
 */
type Entity = { ownerType: 'member' | 'group' | 'investor'; ownerId: number; ntzsUserId: string };

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

async function dbBalance(client: PoolClient, ownerType: string, ownerId: number): Promise<number> {
  const r = await client.query(
    `SELECT balance_tzs FROM wallet_accounts WHERE owner_type = $1 AND owner_id = $2 LIMIT 1`,
    [ownerType, ownerId]
  );
  return r.rows[0] ? Number((r.rows[0] as { balance_tzs: string }).balance_tzs) : 0;
}

async function onChainBalance(ntzsUserId: string): Promise<number> {
  const u = await ntzs.users.getBalance(ntzsUserId);
  return Math.round(Number(u.balanceTzs ?? 0));
}

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NTZS_API_KEY) return NextResponse.json({ error: 'NTZS_API_KEY not configured' }, { status: 503 });

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);
    const entities = await gatherEntities(client);

    let onChainTotal = 0, dbTotal = 0, failed = 0;
    const mismatches: Record<string, unknown>[] = [];

    for (const e of entities) {
      try {
        const onchain = await onChainBalance(e.ntzsUserId);
        const db = await dbBalance(client, e.ownerType, e.ownerId);
        onChainTotal += onchain;
        dbTotal += db;
        if (onchain !== db) {
          if (mismatches.length < 100) {
            mismatches.push({ ownerType: e.ownerType, ownerId: e.ownerId, onChainTzs: onchain, dbTzs: db, diffTzs: onchain - db });
          }
        }
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'dry-run',
      entities: entities.length,
      onChainTotalTzs: onChainTotal,
      dbTotalTzs: dbTotal,
      mismatchCount: mismatches.length,
      missingInDbTzs: onChainTotal - dbTotal,
      failed,
      mismatches,
      note: 'Nothing changed. POST to this endpoint to set DB balances = on-chain.',
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

    let onChainTotal = 0, restored = 0, skippedHigherInDb = 0, failed = 0;

    for (const e of entities) {
      try {
        const onchain = await onChainBalance(e.ntzsUserId);
        const db = await dbBalance(client, e.ownerType, e.ownerId);
        onChainTotal += onchain;
        if (onchain > db) {
          // Restore a missing/under-seeded balance up to the on-chain amount.
          await client.query(
            `INSERT INTO wallet_accounts (owner_type, owner_id, balance_tzs)
             VALUES ($1, $2, $3)
             ON CONFLICT (owner_type, owner_id)
             DO UPDATE SET balance_tzs = EXCLUDED.balance_tzs, updated_at = NOW()`,
            [e.ownerType, e.ownerId, onchain]
          );
          restored++;
        } else if (onchain < db) {
          // SAFETY: never reduce a DB balance from an on-chain read — it could
          // be a transient/zero read, or a legitimate internal-transfer surplus.
          skippedHigherInDb++;
        }
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'applied',
      entities: entities.length,
      restored,
      skippedHigherInDb,
      failed,
      onChainTotalTzs: onChainTotal,
      note: 'Restored under-seeded balances up to on-chain values (never reduced any balance). Refresh the app.',
    });
  } catch (error) {
    console.error('Treasury resync (apply) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
