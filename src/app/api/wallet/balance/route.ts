import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { getBalanceTzs } from '@/lib/wallet/ledger';

/**
 * Balance is read from the custodial ledger (wallet_accounts), not the nTZS
 * API — every member/group now has a database balance backed by the single
 * master wallet. Response shape is unchanged so the UI is untouched.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const groupId = searchParams.get('groupId');

  if (!userId && !groupId) {
    return NextResponse.json({ error: 'userId or groupId is required' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await ensureNtzsSchema(client);

    if (groupId) {
      const res = await client.query(
        `SELECT id, ntzs_wallet_address, name FROM groups WHERE id = $1`,
        [groupId]
      );
      if (res.rows.length === 0) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      const row = res.rows[0] as { id: number; ntzs_wallet_address: string | null; name: string };
      const balanceTzs = await getBalanceTzs(client, { ownerType: 'group', ownerId: row.id });
      return NextResponse.json({ balanceTzs, walletAddress: row.ntzs_wallet_address, name: row.name, provisioned: true });
    }

    const res = await client.query(
      `SELECT m.id, m.ntzs_wallet_address, m.full_name
       FROM members m JOIN users u ON u.id = m.user_id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    if (res.rows.length === 0) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    const row = res.rows[0] as { id: number; ntzs_wallet_address: string | null; full_name: string };
    const balanceTzs = await getBalanceTzs(client, { ownerType: 'member', ownerId: row.id });
    return NextResponse.json({ balanceTzs, walletAddress: row.ntzs_wallet_address, name: row.full_name, provisioned: true });
  } catch (error) {
    console.error('Balance DB error:', error);
    // Don't prompt wallet creation on error — accounts are implicit now.
    return NextResponse.json({ balanceTzs: 0, walletAddress: null, name: '', provisioned: true });
  } finally {
    client.release();
  }
}
