import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';

async function getMembership(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  userId: number,
  groupId: number
) {
  const membershipRes = await client.query(
    `
      SELECT gm.member_id, gm.role, gm.status, m.ntzs_user_id
      FROM group_members gm
      JOIN members m ON m.id = gm.member_id
      WHERE m.user_id = $1
        AND gm.group_id = $2
      LIMIT 1
    `,
    [userId, groupId]
  );

  if (membershipRes.rows.length === 0) return null;
  return membershipRes.rows[0] as {
    member_id: number;
    role: string;
    status: string;
    ntzs_user_id: string | null;
  };
}

/**
 * POST /api/member/groups/[id]/treasury/deposit
 * Member deposits funds to group treasury via nTZS P2P transfer
 * 
 * Body: { amountTzs: number }
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

  let body: { amountTzs?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const amountTzs = Number(body.amountTzs);
  if (!Number.isFinite(amountTzs) || amountTzs <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureNtzsSchema(client);

    const membership = await getMembership(client, auth.userId, groupId);
    if (!membership) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!membership.ntzs_user_id) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Member wallet not provisioned. Please contact support.' },
        { status: 400 }
      );
    }

    const groupRes = await client.query(
      `SELECT id, name, ntzs_user_id FROM groups WHERE id = $1 LIMIT 1`,
      [groupId]
    );

    if (groupRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const group = groupRes.rows[0] as {
      id: number;
      name: string;
      ntzs_user_id: string | null;
    };

    if (!group.ntzs_user_id) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Group treasury not created. Leadership must create it first.' },
        { status: 400 }
      );
    }

    // Execute P2P transfer via nTZS
    const transfer = await ntzs.transfers.create({
      fromUserId: membership.ntzs_user_id,
      toUserId: group.ntzs_user_id,
      amountTzs,
    });

    // Record in local ledger
    await recordTransaction(client, {
      ntzsId: transfer.id,
      type: 'transfer',
      status: transfer.status,
      fromMemberId: membership.member_id,
      toGroupId: groupId,
      amountTzs: transfer.amountTzs,
      feeTzs: transfer.feeAmountTzs,
      netTzs: transfer.recipientAmountTzs,
      txHash: transfer.txHash,
      purpose: 'contribution',
      note: `Member contribution to ${group.name}`,
    });

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      transfer: {
        id: transfer.id,
        amountTzs: transfer.amountTzs,
        feeAmountTzs: transfer.feeAmountTzs,
        recipientAmountTzs: transfer.recipientAmountTzs,
        status: transfer.status,
        txHash: transfer.txHash,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Treasury deposit error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  } finally {
    client.release();
  }
}
