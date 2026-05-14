import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let client;
  try {
    client = await pool.connect();

    const res = await client.query(
      `SELECT ip.ntzs_user_id, ip.ntzs_wallet_address, u.email
       FROM investor_profiles ip JOIN users u ON u.id = ip.user_id
       WHERE ip.user_id = $1 LIMIT 1`,
      [auth.userId]
    ) as { rows: { ntzs_user_id: string | null; ntzs_wallet_address: string | null; email: string }[] };

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const row = res.rows[0];
    if (row.ntzs_user_id) {
      return NextResponse.json({
        success: true,
        alreadyProvisioned: true,
        walletAddress: row.ntzs_wallet_address,
      });
    }

    const ntzsUser = await ntzs.users.create({
      externalId: `investor_${auth.userId}`,
      email: row.email,
    });

    await client.query(
      `UPDATE investor_profiles SET ntzs_user_id = $1, ntzs_wallet_address = $2, updated_at = NOW() WHERE user_id = $3`,
      [ntzsUser.id, ntzsUser.walletAddress, auth.userId]
    );

    return NextResponse.json({ success: true, walletAddress: ntzsUser.walletAddress });
  } catch (error) {
    console.error('Investor wallet provision error:', error);
    return NextResponse.json({ error: 'Imeshindwa kuunda pochi' }, { status: 500 });
  } finally {
    client?.release();
  }
}
