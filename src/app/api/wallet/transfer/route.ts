import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';

/**
 * Transfer nTZS between wallets.
 * Supports: contribution (member→group), disbursement (group→member), p2p (member→member)
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const { userId, purpose, amountTzs, toMemberId, groupId } = await request.json();

    if (!userId || !amountTzs || !purpose) {
      return NextResponse.json({ error: 'userId, amountTzs, and purpose are required' }, { status: 400 });
    }

    if (!['contribution', 'disbursement', 'p2p'].includes(purpose)) {
      return NextResponse.json({ error: 'purpose must be contribution, disbursement, or p2p' }, { status: 400 });
    }

    if (amountTzs < 100) {
      return NextResponse.json({ error: 'Minimum transfer is 100 TZS' }, { status: 400 });
    }

    await ensureNtzsSchema(client);

    // Get sender info
    const senderRes = await client.query(
      `SELECT m.id, m.ntzs_user_id, m.full_name
       FROM members m JOIN users u ON u.id = m.user_id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );

    if (senderRes.rows.length === 0) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    }

    const sender = senderRes.rows[0] as { id: number; ntzs_user_id: string | null; full_name: string };

    let fromNtzsUserId: string;
    let toNtzsUserId: string;
    let fromMemberId: number | null = null;
    let fromGroupId: number | null = null;
    let toMemberIdFinal: number | null = null;
    let toGroupIdFinal: number | null = null;

    if (purpose === 'contribution') {
      // Member → Group
      if (!groupId) {
        return NextResponse.json({ error: 'groupId is required for contributions' }, { status: 400 });
      }
      if (!sender.ntzs_user_id) {
        return NextResponse.json({ error: 'Your wallet is not provisioned' }, { status: 400 });
      }

      // Verify membership
      const membershipRes = await client.query(
        `SELECT gm.id FROM group_members gm WHERE gm.member_id = $1 AND gm.group_id = $2 AND gm.status = 'active'`,
        [sender.id, groupId]
      );
      if (membershipRes.rows.length === 0) {
        return NextResponse.json({ error: 'You are not a member of this group' }, { status: 403 });
      }

      const groupRes = await client.query(
        `SELECT ntzs_user_id FROM groups WHERE id = $1`,
        [groupId]
      );
      if (groupRes.rows.length === 0 || !(groupRes.rows[0] as { ntzs_user_id: string | null }).ntzs_user_id) {
        return NextResponse.json({ error: 'Group wallet not provisioned' }, { status: 400 });
      }

      fromNtzsUserId = sender.ntzs_user_id;
      toNtzsUserId = (groupRes.rows[0] as { ntzs_user_id: string }).ntzs_user_id;
      fromMemberId = sender.id;
      toGroupIdFinal = groupId;

    } else if (purpose === 'disbursement') {
      // Group → Member (requires leadership role)
      if (!groupId || !toMemberId) {
        return NextResponse.json({ error: 'groupId and toMemberId are required for disbursements' }, { status: 400 });
      }

      // Verify sender is leadership
      const leaderRes = await client.query(
        `SELECT gm.role FROM group_members gm
         WHERE gm.member_id = $1 AND gm.group_id = $2 AND gm.status = 'active'
         AND gm.role IN ('leader', 'mwenyekiti', 'mwekahazina')`,
        [sender.id, groupId]
      );
      if (leaderRes.rows.length === 0) {
        return NextResponse.json({ error: 'Only leadership can disburse funds' }, { status: 403 });
      }

      const groupRes = await client.query(
        `SELECT ntzs_user_id FROM groups WHERE id = $1`,
        [groupId]
      );
      const recipientRes = await client.query(
        `SELECT ntzs_user_id FROM members WHERE id = $1`,
        [toMemberId]
      );

      if (!(groupRes.rows[0] as { ntzs_user_id: string | null })?.ntzs_user_id) {
        return NextResponse.json({ error: 'Group wallet not provisioned' }, { status: 400 });
      }
      if (!(recipientRes.rows[0] as { ntzs_user_id: string | null })?.ntzs_user_id) {
        return NextResponse.json({ error: 'Recipient wallet not provisioned' }, { status: 400 });
      }

      fromNtzsUserId = (groupRes.rows[0] as { ntzs_user_id: string }).ntzs_user_id;
      toNtzsUserId = (recipientRes.rows[0] as { ntzs_user_id: string }).ntzs_user_id;
      fromGroupId = groupId;
      toMemberIdFinal = toMemberId;

    } else {
      // P2P: Member → Member
      if (!toMemberId) {
        return NextResponse.json({ error: 'toMemberId is required for p2p transfers' }, { status: 400 });
      }
      if (!sender.ntzs_user_id) {
        return NextResponse.json({ error: 'Your wallet is not provisioned' }, { status: 400 });
      }

      const recipientRes = await client.query(
        `SELECT ntzs_user_id FROM members WHERE id = $1`,
        [toMemberId]
      );
      if (!(recipientRes.rows[0] as { ntzs_user_id: string | null })?.ntzs_user_id) {
        return NextResponse.json({ error: 'Recipient wallet not provisioned' }, { status: 400 });
      }

      fromNtzsUserId = sender.ntzs_user_id;
      toNtzsUserId = (recipientRes.rows[0] as { ntzs_user_id: string }).ntzs_user_id;
      fromMemberId = sender.id;
      toMemberIdFinal = toMemberId;
    }

    // Execute transfer via nTZS
    const transfer = await ntzs.transfers.create({
      fromUserId: fromNtzsUserId,
      toUserId: toNtzsUserId,
      amountTzs,
    });

    // Record in local ledger
    await recordTransaction(client, {
      ntzsId: transfer.id,
      type: 'transfer',
      status: transfer.status,
      fromMemberId,
      fromGroupId,
      toMemberId: toMemberIdFinal,
      toGroupId: toGroupIdFinal,
      amountTzs,
      feeTzs: transfer.feeAmountTzs,
      netTzs: transfer.recipientAmountTzs,
      txHash: transfer.txHash,
      purpose,
      note: `${purpose} by ${sender.full_name}`,
    });

    return NextResponse.json({
      transferId: transfer.id,
      status: transfer.status,
      amountTzs,
      feeTzs: transfer.feeAmountTzs,
      netTzs: transfer.recipientAmountTzs,
      txHash: transfer.txHash,
    });
  } catch (error) {
    if (error instanceof NtzsApiError) {
      console.error('nTZS transfer error:', error.status, error.body);
      const msg = error.body.error === 'insufficient_balance'
        ? 'Salio haitoshi (Insufficient balance)'
        : error.body.error === 'wallet_not_provisioned'
          ? 'Wallet bado inatengenezwa (Wallet still being created)'
          : error.body.message || 'Transfer failed';
      return NextResponse.json({ error: msg }, { status: error.status });
    }
    console.error('Transfer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
