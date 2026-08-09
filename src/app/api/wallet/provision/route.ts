import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getOrCreateAccount } from '@/lib/wallet/ledger';
import { getActor } from '@/lib/wallet/authorize';

/**
 * In the custodial model every member has an implicit ledger account, so
 * "provisioning" just ensures the account row exists and returns success —
 * no per-entity on-chain wallet, no async race, no failure mode. Kept as an
 * endpoint for backward compatibility with the dashboard's wallet setup call.
 */
export async function POST(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    // Identity comes from the signed cookie, never the request body.
    const userId = actor.userId;
    await request.json().catch(() => ({}));

    const memberRes = await client.query(
      `SELECT m.id, m.ntzs_wallet_address
       FROM members m JOIN users u ON u.id = m.user_id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    const member = memberRes.rows[0] as { id: number; ntzs_wallet_address: string | null };

    await getOrCreateAccount(client, { ownerType: 'member', ownerId: member.id });

    return NextResponse.json({
      walletAddress: member.ntzs_wallet_address,
      provisioned: true,
      message: 'Wallet tayari ipo (Wallet ready)',
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Provision error:', errMsg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
