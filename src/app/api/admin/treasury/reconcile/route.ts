import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { getTotalsByOwnerType } from '@/lib/wallet/ledger';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';

/**
 * GET /api/admin/treasury/reconcile (admin only)
 *
 * Compares the master wallet's on-chain balance to the sum of all ledger
 * balances it is supposed to back (the float / liabilities). A negative drift
 * means the master holds less than users' balances — expected after an
 * import-without-sweep, and a signal to run the sweep before large withdrawals.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const totals = await getTotalsByOwnerType(client);
    const ledgerLiabilitiesTzs = Object.entries(totals)
      .filter(([t]) => t !== 'master')
      .reduce((sum, [, v]) => sum + v, 0);

    const masterRow = await client.query(
      `SELECT ntzs_user_id FROM wallet_accounts WHERE owner_type = 'master' AND owner_id = 0 LIMIT 1`
    );
    const masterUserId = (masterRow.rows[0] as { ntzs_user_id: string | null } | undefined)?.ntzs_user_id ?? null;

    let masterOnChainTzs: number | null = null;
    let onChainError: string | null = null;
    if (masterUserId && process.env.NTZS_API_KEY) {
      try {
        masterOnChainTzs = (await ntzs.users.getBalance(masterUserId)).balanceTzs ?? 0;
      } catch (e) {
        onChainError = e instanceof Error ? e.message : String(e);
      }
    }

    const driftTzs = masterOnChainTzs !== null ? masterOnChainTzs - ledgerLiabilitiesTzs : null;

    return NextResponse.json({
      success: true,
      masterProvisioned: !!masterUserId,
      masterOnChainTzs,
      ledgerLiabilitiesTzs,
      driftTzs,
      byOwnerType: totals,
      onChainError,
      note: driftTzs !== null && driftTzs < 0
        ? 'Master wallet holds less than the sum of balances — run the on-chain sweep before large withdrawals.'
        : null,
    });
  } catch (error) {
    console.error('Reconcile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
