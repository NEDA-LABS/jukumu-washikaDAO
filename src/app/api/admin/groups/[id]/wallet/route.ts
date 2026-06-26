import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, linkGroupWallet } from '@/lib/ntzs-db';
import { getBalanceTzs } from '@/lib/wallet/ledger';

export const runtime = 'nodejs';

/**
 * GET  /api/admin/groups/[id]/wallet  — view nTZS treasury (admin only)
 * POST /api/admin/groups/[id]/wallet  — provision nTZS treasury for a group (admin only)
 */

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const groupRes = await client.query(
      `SELECT id, name, ntzs_user_id, ntzs_wallet_address FROM groups WHERE id = $1 LIMIT 1`,
      [groupId]
    );
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const group = groupRes.rows[0] as {
      id: number; name: string;
      ntzs_user_id: string | null; ntzs_wallet_address: string | null;
    };

    if (!group.ntzs_user_id) {
      return NextResponse.json({ success: true, wallet: null, balanceTzs: 0, recentTransactions: [] });
    }

    // Recent nTZS transactions for this group
    const txRes = await client.query(
      `SELECT id, type, status, amount_tzs, fee_tzs, purpose, note, created_at
       FROM ntzs_transactions
       WHERE from_group_id = $1 OR to_group_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [groupId]
    );

    // Balance from the custodial ledger.
    const balanceTzs = await getBalanceTzs(client, { ownerType: 'group', ownerId: groupId });
    const balanceError: string | null = null;

    return NextResponse.json({
      success: true,
      wallet: {
        network: 'Base (nTZS)',
        address: group.ntzs_wallet_address,
        ntzsUserId: group.ntzs_user_id,
      },
      balanceTzs,
      balanceError,
      recentTransactions: txRes.rows,
    });
  } catch (error) {
    console.error('Admin group wallet GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  if (!process.env.NTZS_API_KEY) {
    return NextResponse.json({ error: 'Wallet service not configured. Contact support.' }, { status: 503 });
  }

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const groupRes = await client.query(
      `SELECT id, name, ntzs_user_id, ntzs_wallet_address FROM groups WHERE id = $1 LIMIT 1`,
      [groupId]
    );
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    const group = groupRes.rows[0] as {
      id: number; name: string;
      ntzs_user_id: string | null; ntzs_wallet_address: string | null;
    };

    if (group.ntzs_user_id) {
      const profile = await ntzs.users.getBalance(group.ntzs_user_id);
      return NextResponse.json({
        success: true,
        wallet: { network: 'Base (nTZS)', address: group.ntzs_wallet_address, ntzsUserId: group.ntzs_user_id },
        balanceTzs: profile.balanceTzs ?? 0,
        message: 'Wallet already provisioned',
      });
    }

    const ntzsUser = await ntzs.users.create({
      externalId: `group_${groupId}`,
      email: `group_${groupId}@groups.washikadau.com`,
    });

    await linkGroupWallet(client, groupId, ntzsUser.id, ntzsUser.walletAddress);

    return NextResponse.json({
      success: true,
      wallet: { network: 'Base (nTZS)', address: ntzsUser.walletAddress, ntzsUserId: ntzsUser.id },
      balanceTzs: 0,
      message: 'Hazina imeundwa kwa mafanikio! (Treasury created successfully)',
    });
  } catch (error) {
    console.error('Admin group wallet POST error:', error);
    if (error instanceof NtzsApiError) {
      return NextResponse.json({ error: error.body?.message || error.body?.error || 'Wallet service error' }, { status: 502 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
