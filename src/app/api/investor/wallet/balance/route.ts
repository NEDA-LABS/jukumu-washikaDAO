import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ntzs } from '@/lib/ntzs';

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
      `SELECT ntzs_user_id, ntzs_wallet_address FROM investor_profiles WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    ) as { rows: { ntzs_user_id: string | null; ntzs_wallet_address: string | null }[] };

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { ntzs_user_id, ntzs_wallet_address } = res.rows[0];

    if (!ntzs_user_id) {
      return NextResponse.json({ balanceTzs: 0, walletAddress: null, provisioned: false });
    }

    if (!process.env.NTZS_API_KEY) {
      return NextResponse.json({ balanceTzs: 0, walletAddress: ntzs_wallet_address, provisioned: true });
    }

    try {
      const ntzsUser = await ntzs.users.getBalance(ntzs_user_id);
      return NextResponse.json({
        balanceTzs: ntzsUser.balanceTzs ?? 0,
        walletAddress: ntzsUser.walletAddress ?? ntzs_wallet_address,
        provisioned: true,
      });
    } catch {
      return NextResponse.json({ balanceTzs: 0, walletAddress: ntzs_wallet_address, provisioned: true });
    }
  } catch (error) {
    console.error('Investor wallet balance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client?.release();
  }
}
