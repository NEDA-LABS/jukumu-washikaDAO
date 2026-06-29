import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema, linkGroupWallet } from '@/lib/ntzs-db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { getBalanceTzs, getOrCreateAccount } from '@/lib/wallet/ledger';

export const runtime = 'nodejs';

const LEADERSHIP_ROLES = new Set(['leader', 'mwenyekiti', 'katibu', 'mwekahazina']);

async function getMembership(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  userId: number,
  groupId: number
) {
  const membershipRes = await client.query(
    `
      SELECT gm.member_id, gm.role, gm.status
      FROM group_members gm
      JOIN members m ON m.id = gm.member_id
      WHERE m.user_id = $1
        AND gm.group_id = $2
      LIMIT 1
    `,
    [userId, groupId]
  );

  if (membershipRes.rows.length === 0) return null;
  return membershipRes.rows[0] as { member_id: number; role: string; status: string };
}

/**
 * GET /api/member/groups/[id]/treasury
 * Returns group treasury balance (nTZS wallet)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
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

    const membership = await getMembership(client, auth.userId, groupId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const groupRes = await client.query(
      `SELECT id, name, ntzs_user_id, ntzs_wallet_address FROM groups WHERE id = $1 LIMIT 1`,
      [groupId]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const group = groupRes.rows[0] as {
      id: number;
      name: string;
      ntzs_user_id: string | null;
      ntzs_wallet_address: string | null;
    };

    // Balance from the custodial ledger — every group has a DB account.
    const balanceTzs = await getBalanceTzs(client, { ownerType: 'group', ownerId: groupId });

    return NextResponse.json({
      success: true,
      treasury: {
        ntzsUserId: group.ntzs_user_id,
        walletAddress: group.ntzs_wallet_address,
      },
      balanceTzs,
      membership,
    });
  } catch (error) {
    console.error('Treasury GET error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * POST /api/member/groups/[id]/treasury
 * Provision nTZS treasury wallet for group (leadership only)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
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

    const membership = await getMembership(client, auth.userId, groupId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!LEADERSHIP_ROLES.has(membership.role)) {
      return NextResponse.json(
        { error: 'Only group leadership can create treasury wallet' },
        { status: 403 }
      );
    }

    const groupRes = await client.query(
      `SELECT id, name, ntzs_user_id, ntzs_wallet_address FROM groups WHERE id = $1 LIMIT 1`,
      [groupId]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const group = groupRes.rows[0] as {
      id: number;
      name: string;
      ntzs_user_id: string | null;
      ntzs_wallet_address: string | null;
    };

    // The treasury is the group's ledger account — ensure it exists.
    await getOrCreateAccount(client, { ownerType: 'group', ownerId: groupId });
    const balanceTzs = await getBalanceTzs(client, { ownerType: 'group', ownerId: groupId });

    return NextResponse.json({
      success: true,
      treasury: {
        ntzsUserId: group.ntzs_user_id,
        walletAddress: group.ntzs_wallet_address,
      },
      balanceTzs,
      membership,
    });
  } catch (error) {
    console.error('Treasury POST error:', error);
    if (error instanceof Error && error.message.includes('NTZS_API_KEY')) {
      return NextResponse.json({ error: 'Wallet service not configured. Contact support.' }, { status: 503 });
    }
    if (error instanceof NtzsApiError) {
      return NextResponse.json({ error: error.body?.message || error.body?.error || 'Wallet service error. Try again later.' }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  } finally {
    client.release();
  }
}
