import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { internalTransfer, LedgerError } from '@/lib/wallet/ledger';

/**
 * Internal ledger transfer between database accounts. Pure DB, atomic — no
 * on-chain call. Supports: contribution (member→group), disbursement
 * (group→member), p2p (member→member).
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();
  let inTx = false;

  try {
    const { userId, purpose, amountTzs, toMemberId, toUsername, groupId: rawGroupId, groupCode } = await request.json();

    if (!userId || !amountTzs || !purpose) {
      return NextResponse.json({ error: 'userId, amountTzs, and purpose are required' }, { status: 400 });
    }
    if (!['contribution', 'disbursement', 'p2p'].includes(purpose)) {
      return NextResponse.json({ error: 'purpose must be contribution, disbursement, or p2p' }, { status: 400 });
    }
    if (amountTzs < 100) {
      return NextResponse.json({ error: 'Minimum transfer is 100 TZS' }, { status: 400 });
    }

    // Schema DDL must commit independently of the transfer transaction.
    await ensureNtzsSchema(client);

    // Resolve groupCode → groupId
    let groupId = rawGroupId;
    if (!groupId && groupCode) {
      const codeRes = await client.query(
        `SELECT id FROM groups WHERE group_code = $1 AND status = 'active' LIMIT 1`,
        [String(groupCode).trim().toUpperCase()]
      );
      if (codeRes.rows.length === 0) {
        return NextResponse.json({ error: 'Hakuna kundi lenye nambari hiyo.' }, { status: 404 });
      }
      groupId = (codeRes.rows[0] as { id: number }).id;
    }

    // Resolve sender member
    const senderRes = await client.query(
      `SELECT m.id, m.full_name FROM members m JOIN users u ON u.id = m.user_id WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    if (senderRes.rows.length === 0) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    }
    const sender = senderRes.rows[0] as { id: number; full_name: string };

    // Authorization + recipient resolution (reads), then the atomic transfer.
    let from: { ownerType: 'member' | 'group'; ownerId: number };
    let to: { ownerType: 'member' | 'group'; ownerId: number };

    if (purpose === 'contribution') {
      if (!groupId) return NextResponse.json({ error: 'groupId is required for contributions' }, { status: 400 });
      const membershipRes = await client.query(
        `SELECT gm.id FROM group_members gm WHERE gm.member_id = $1 AND gm.group_id = $2 AND gm.status = 'active'`,
        [sender.id, groupId]
      );
      if (membershipRes.rows.length === 0) {
        return NextResponse.json({ error: 'You are not a member of this group' }, { status: 403 });
      }
      from = { ownerType: 'member', ownerId: sender.id };
      to = { ownerType: 'group', ownerId: groupId };

    } else if (purpose === 'disbursement') {
      if (!groupId || !toMemberId) {
        return NextResponse.json({ error: 'groupId and toMemberId are required for disbursements' }, { status: 400 });
      }
      const leaderRes = await client.query(
        `SELECT gm.role FROM group_members gm
         WHERE gm.member_id = $1 AND gm.group_id = $2 AND gm.status = 'active'
         AND gm.role IN ('leader', 'mwenyekiti', 'mwekahazina')`,
        [sender.id, groupId]
      );
      if (leaderRes.rows.length === 0) {
        return NextResponse.json({ error: 'Only leadership can disburse funds' }, { status: 403 });
      }
      const recipientRes = await client.query(`SELECT id FROM members WHERE id = $1`, [toMemberId]);
      if (recipientRes.rows.length === 0) {
        return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
      }
      from = { ownerType: 'group', ownerId: groupId };
      to = { ownerType: 'member', ownerId: Number(toMemberId) };

    } else {
      // p2p
      let recipientMemberId: number;
      if (toUsername) {
        const usernameRes = await client.query(
          `SELECT id FROM members WHERE lower(username) = lower($1) LIMIT 1`,
          [toUsername]
        );
        if (usernameRes.rows.length === 0) {
          return NextResponse.json({ error: `Username "${toUsername}" not found` }, { status: 404 });
        }
        recipientMemberId = (usernameRes.rows[0] as { id: number }).id;
      } else if (toMemberId) {
        const recipientRes = await client.query(`SELECT id FROM members WHERE id = $1`, [toMemberId]);
        if (recipientRes.rows.length === 0) {
          return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
        }
        recipientMemberId = Number(toMemberId);
      } else {
        return NextResponse.json({ error: 'toUsername or toMemberId is required for p2p transfers' }, { status: 400 });
      }
      from = { ownerType: 'member', ownerId: sender.id };
      to = { ownerType: 'member', ownerId: recipientMemberId };
    }

    await client.query('BEGIN');
    inTx = true;
    const result = await internalTransfer(client, {
      from, to, amountTzs,
      purpose,
      note: `${purpose} by ${sender.full_name}`,
    });
    await client.query('COMMIT');
    inTx = false;

    return NextResponse.json({
      transferId: result.journalId,
      status: 'completed',
      amountTzs: result.amountTzs,
      feeTzs: 0,
      netTzs: result.amountTzs,
      txHash: null,
      fromBalanceTzs: result.fromBalanceTzs,
      toBalanceTzs: result.toBalanceTzs,
    });
  } catch (error) {
    if (inTx) await client.query('ROLLBACK').catch(() => {});
    if (error instanceof LedgerError) {
      const msg = error.code === 'insufficient_balance'
        ? 'Salio haitoshi (Insufficient balance)'
        : error.message;
      return NextResponse.json({ error: msg, code: error.code }, { status: 400 });
    }
    console.error('Transfer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
