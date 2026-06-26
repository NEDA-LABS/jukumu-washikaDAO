import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { getBalanceTzs } from '@/lib/wallet/ledger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let client;
  try {
    client = await pool.connect();
    const res = await client.query(
      `SELECT ntzs_wallet_address FROM investor_profiles WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    ) as { rows: { ntzs_wallet_address: string | null }[] };

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Balance from the custodial ledger (investor account keyed by user id).
    const balanceTzs = await getBalanceTzs(client, { ownerType: 'investor', ownerId: auth.userId });
    return NextResponse.json({
      balanceTzs,
      walletAddress: res.rows[0].ntzs_wallet_address,
      provisioned: true,
    });
  } catch (error) {
    console.error('Investor wallet balance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client?.release();
  }
}
