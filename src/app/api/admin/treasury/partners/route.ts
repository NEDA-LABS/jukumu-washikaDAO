import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { partnerLiabilities, attributeFloat } from '@/lib/wallet/partner-treasury';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/treasury/partners (admin only)
 *
 * Per-tenant view of the same pool /reconcile reports platform-wide: what each
 * partner owes its users, what it has put into and taken out of the shared
 * float, and how a shortfall would land if apportioned pro-rata.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check the role against the database rather than the token's own claim: a
  // token minted before an admin was demoted would still carry role=admin, and
  // this endpoint exposes every tenant's balances.
  const roleRes = await pool.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [auth.userId]);
  if ((roleRes.rows[0] as { role?: string } | undefined)?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    const liabilities = await partnerLiabilities(client);

    const masterRow = await client.query(
      `SELECT ntzs_user_id FROM wallet_accounts WHERE owner_type = 'master' AND owner_id = 0 LIMIT 1`,
    );
    const masterUserId =
      (masterRow.rows[0] as { ntzs_user_id: string | null } | undefined)?.ntzs_user_id ?? null;

    let masterOnChainTzs: number | null = null;
    let onChainError: string | null = null;
    if (masterUserId && process.env.NTZS_API_KEY) {
      try {
        masterOnChainTzs = (await ntzs.users.getBalance(masterUserId)).balanceTzs ?? 0;
      } catch (e) {
        onChainError = e instanceof Error ? e.message : String(e);
      }
    } else {
      onChainError = masterUserId
        ? 'NTZS_API_KEY is not configured on this environment.'
        : 'The master wallet has not been provisioned yet.';
    }

    const treasury = attributeFloat(liabilities, masterOnChainTzs, onChainError);

    return NextResponse.json({
      success: true,
      ...treasury,
      note: treasury.fullyBacked === false
        ? 'On-chain float is below total liabilities — run the treasury sweep before large withdrawals.'
        : null,
      disclaimer:
        'Funds are held in one shared wallet. Liabilities are exact; attributed float is a pro-rata convention, not physical segregation.',
    });
  } catch (error) {
    console.error('[admin/treasury/partners]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
