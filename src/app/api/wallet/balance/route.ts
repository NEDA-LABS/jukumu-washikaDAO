import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema } from '@/lib/ntzs-db';

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

    let ntzsUserId: string | null = null;
    let walletAddress: string | null = null;
    let entityName: string = '';

    if (groupId) {
      const res = await client.query(
        `SELECT ntzs_user_id, ntzs_wallet_address, name FROM groups WHERE id = $1`,
        [groupId]
      );
      if (res.rows.length === 0) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      const row = res.rows[0] as { ntzs_user_id: string | null; ntzs_wallet_address: string | null; name: string };
      ntzsUserId = row.ntzs_user_id;
      walletAddress = row.ntzs_wallet_address;
      entityName = row.name;
    } else {
      const res = await client.query(
        `SELECT m.ntzs_user_id, m.ntzs_wallet_address, m.full_name
         FROM members m JOIN users u ON u.id = m.user_id
         WHERE u.id = $1 LIMIT 1`,
        [userId]
      );
      if (res.rows.length === 0) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      const row = res.rows[0] as { ntzs_user_id: string | null; ntzs_wallet_address: string | null; full_name: string };
      ntzsUserId = row.ntzs_user_id;
      walletAddress = row.ntzs_wallet_address;
      entityName = row.full_name;
    }

    if (!ntzsUserId) {
      return NextResponse.json({ balanceTzs: 0, walletAddress: null, name: entityName, provisioned: false });
    }

    // If nTZS API key isn't configured, return wallet info without live balance
    if (!process.env.NTZS_API_KEY) {
      return NextResponse.json({ balanceTzs: 0, walletAddress, name: entityName, provisioned: true });
    }

    const { balanceTzs } = await ntzs.users.getBalance(ntzsUserId);

    return NextResponse.json({
      balanceTzs,
      walletAddress,
      name: entityName,
      provisioned: true,
    });
  } catch (error) {
    if (error instanceof NtzsApiError) {
      console.error('nTZS balance error:', error.status, error.body);
      return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 502 });
    }
    console.error('Balance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
