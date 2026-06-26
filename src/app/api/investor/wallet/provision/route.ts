import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { getOrCreateAccount } from '@/lib/wallet/ledger';

export const runtime = 'nodejs';

/**
 * Ensures the investor's ledger account exists. No per-entity on-chain wallet
 * in the custodial model — funds live in the master wallet, balance in the DB.
 */
export async function POST(request: NextRequest) {
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

    await getOrCreateAccount(client, { ownerType: 'investor', ownerId: auth.userId });

    return NextResponse.json({
      success: true,
      provisioned: true,
      walletAddress: res.rows[0].ntzs_wallet_address,
    });
  } catch (error) {
    console.error('Investor wallet provision error:', error);
    return NextResponse.json({ error: 'Imeshindwa kuunda pochi' }, { status: 500 });
  } finally {
    client?.release();
  }
}
