import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs } from '@/lib/ntzs';
import { ensureNtzsSchema } from '@/lib/ntzs-db';

export const runtime = 'nodejs';

export async function GET() {
  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const [memberRes, groupRes] = await Promise.all([
      client.query(`SELECT ntzs_user_id FROM members WHERE ntzs_user_id IS NOT NULL`),
      client.query(`SELECT ntzs_user_id FROM groups WHERE ntzs_user_id IS NOT NULL`),
    ]);

    const memberIds: string[] = memberRes.rows.map((r: { ntzs_user_id: string }) => r.ntzs_user_id);
    const groupIds: string[]  = groupRes.rows.map((r: { ntzs_user_id: string }) => r.ntzs_user_id);

    const [memberResults, groupResults] = await Promise.all([
      Promise.allSettled(memberIds.map(id => ntzs.users.getBalance(id))),
      Promise.allSettled(groupIds.map(id => ntzs.users.getBalance(id))),
    ]);

    let totalMembersBalance = 0;
    let totalGroupsBalance = 0;
    let failedFetches = 0;

    for (const r of memberResults) {
      if (r.status === 'fulfilled') totalMembersBalance += r.value.balanceTzs ?? 0;
      else failedFetches++;
    }
    for (const r of groupResults) {
      if (r.status === 'fulfilled') totalGroupsBalance += r.value.balanceTzs ?? 0;
      else failedFetches++;
    }

    return NextResponse.json({
      totalMembersBalance,
      totalGroupsBalance,
      totalWalletBalance: totalMembersBalance + totalGroupsBalance,
      membersWithWallet: memberIds.length,
      groupsWithWallet: groupIds.length,
      failedFetches,
    });
  } catch (error) {
    console.error('Wallet totals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
