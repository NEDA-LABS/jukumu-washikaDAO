import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { internalTransfer, LedgerError } from '@/lib/wallet/ledger';

export const runtime = 'nodejs';

async function getMembership(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  userId: number,
  groupId: number
) {
  const membershipRes = await client.query(
    `SELECT gm.member_id, gm.role, gm.status
     FROM group_members gm
     JOIN members m ON m.id = gm.member_id
     WHERE m.user_id = $1 AND gm.group_id = $2
     LIMIT 1`,
    [userId, groupId]
  );
  if (membershipRes.rows.length === 0) return null;
  return membershipRes.rows[0] as { member_id: number; role: string; status: string };
}

/**
 * POST /api/member/groups/[id]/treasury/deposit
 * Member contributes to the group treasury — an internal ledger transfer
 * (member account → group account). Pure DB, atomic.
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
  let inTx = false;
  try {
    await ensureNtzsSchema(client);

    const membership = await getMembership(client, auth.userId, groupId);
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const groupRes = await client.query(
      `SELECT id, name FROM groups WHERE id = $1 LIMIT 1`,
      [groupId]
    );
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    const group = groupRes.rows[0] as { id: number; name: string };

    await client.query('BEGIN');
    inTx = true;
    const result = await internalTransfer(client, {
      from: { ownerType: 'member', ownerId: membership.member_id },
      to: { ownerType: 'group', ownerId: groupId },
      amountTzs,
      purpose: 'contribution',
      note: `Member contribution to ${group.name}`,
    });
    await client.query('COMMIT');
    inTx = false;

    return NextResponse.json({
      success: true,
      transfer: {
        id: result.journalId,
        amountTzs: result.amountTzs,
        feeAmountTzs: 0,
        recipientAmountTzs: result.amountTzs,
        status: 'completed',
        txHash: null,
      },
      balanceTzs: result.fromBalanceTzs,
    });
  } catch (error) {
    if (inTx) await client.query('ROLLBACK').catch(() => {});
    if (error instanceof LedgerError) {
      const msg = error.code === 'insufficient_balance'
        ? 'Salio haitoshi (Insufficient balance)'
        : error.message;
      return NextResponse.json({ error: msg, code: error.code }, { status: 400 });
    }
    console.error('Treasury deposit error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  } finally {
    client.release();
  }
}
