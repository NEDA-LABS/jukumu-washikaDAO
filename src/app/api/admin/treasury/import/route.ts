import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';

/**
 * POST /api/admin/treasury/import  (admin only)
 *
 * One-time seed of wallet_accounts from each entity's current on-chain nTZS
 * balance. Runs inside the deployed app, so it uses the DATABASE_URL /
 * NTZS_API_KEY already configured in the environment — no local setup.
 *
 * Idempotent: only seeds accounts whose ledger balance is still 0, so it never
 * clobbers balances once the ledger has activity. Safe to re-run.
 */
async function seed(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  ownerType: string,
  ownerId: number,
  balanceTzs: number
) {
  await client.query(
    `INSERT INTO wallet_accounts (owner_type, owner_id, balance_tzs)
     VALUES ($1, $2, $3)
     ON CONFLICT (owner_type, owner_id)
     DO UPDATE SET balance_tzs = EXCLUDED.balance_tzs, updated_at = NOW()
     WHERE wallet_accounts.balance_tzs = 0`,
    [ownerType, ownerId, balanceTzs]
  );
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.NTZS_API_KEY) {
    return NextResponse.json({ error: 'Wallet service not configured (NTZS_API_KEY missing).' }, { status: 503 });
  }

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const members = (await client.query(`SELECT id, ntzs_user_id FROM members WHERE ntzs_user_id IS NOT NULL`)).rows as { id: number; ntzs_user_id: string }[];
    const groups = (await client.query(`SELECT id, ntzs_user_id FROM groups WHERE ntzs_user_id IS NOT NULL`)).rows as { id: number; ntzs_user_id: string }[];
    let investors: { id: number; ntzs_user_id: string }[] = [];
    try {
      investors = (await client.query(`SELECT user_id AS id, ntzs_user_id FROM investor_profiles WHERE ntzs_user_id IS NOT NULL`)).rows as { id: number; ntzs_user_id: string }[];
    } catch { /* investor_profiles may not exist */ }

    async function run(ownerType: string, rows: { id: number; ntzs_user_id: string }[]) {
      const s = { accounts: rows.length, funded: 0, totalTzs: 0, failed: 0 };
      for (const r of rows) {
        try {
          const bal = Math.round((await ntzs.users.getBalance(r.ntzs_user_id)).balanceTzs ?? 0);
          await seed(client, ownerType, r.id, bal);
          s.totalTzs += bal;
          if (bal > 0) s.funded++;
        } catch {
          s.failed++;
        }
      }
      return s;
    }

    const member = await run('member', members);
    const group = await run('group', groups);
    const investor = await run('investor', investors);
    const grandTotalTzs = member.totalTzs + group.totalTzs + investor.totalTzs;

    return NextResponse.json({
      success: true,
      grandTotalTzs,
      byOwnerType: { member, group, investor },
      note: 'Funds physically remain in the per-entity wallets until you sweep them into the master wallet. Check GET /api/admin/treasury/reconcile.',
    });
  } catch (error) {
    console.error('Treasury import error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  } finally {
    client.release();
  }
}
