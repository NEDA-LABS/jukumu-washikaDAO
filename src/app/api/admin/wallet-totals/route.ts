import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTotalsByOwnerType } from '@/lib/wallet/ledger';

export const runtime = 'nodejs';

/**
 * Aggregate balances straight from the ledger — a single GROUP BY SUM instead
 * of one nTZS API call per entity (which previously fanned out and partially
 * failed). No external calls, so no failedFetches.
 */
export async function GET() {
  const client = await pool.connect();
  try {
    const totals = await getTotalsByOwnerType(client);
    const totalMembersBalance = totals.member ?? 0;
    const totalGroupsBalance = totals.group ?? 0;

    const counts = await client.query(
      `SELECT owner_type, COUNT(*)::int AS n FROM wallet_accounts
       WHERE owner_type IN ('member','group') GROUP BY owner_type`
    );
    let membersWithWallet = 0;
    let groupsWithWallet = 0;
    for (const r of counts.rows as { owner_type: string; n: number }[]) {
      if (r.owner_type === 'member') membersWithWallet = r.n;
      if (r.owner_type === 'group') groupsWithWallet = r.n;
    }

    return NextResponse.json({
      totalMembersBalance,
      totalGroupsBalance,
      totalWalletBalance: totalMembersBalance + totalGroupsBalance,
      membersWithWallet,
      groupsWithWallet,
      failedFetches: 0,
    });
  } catch (error) {
    console.error('Wallet totals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
