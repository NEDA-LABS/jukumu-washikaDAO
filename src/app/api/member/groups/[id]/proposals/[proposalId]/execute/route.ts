import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { ntzs } from '@/lib/ntzs';

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
 * POST /api/member/groups/[id]/proposals/[proposalId]/execute
 * Execute an approved payment proposal (leadership only)
 * Transfers funds from group treasury to recipient via nTZS
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, proposalId } = await params;
  const groupId = Number.parseInt(id, 10);
  const proposalIdNum = Number.parseInt(proposalId, 10);

  if (!Number.isFinite(groupId) || !Number.isFinite(proposalIdNum)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
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

    if (!LEADERSHIP_ROLES.has(membership.role)) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Only leadership can execute proposals' },
        { status: 403 }
      );
    }

    // Get proposal details
    const proposalRes = await client.query(
      `
        SELECT 
          p.id, p.group_id, p.title, p.description, p.status,
          p.payment_amount_tzs, p.recipient_member_id, p.recipient_phone,
          p.payment_status, p.payment_tx_id,
          g.ntzs_user_id as group_ntzs_user_id,
          g.voting_threshold_numerator, g.voting_threshold_denominator,
          m.ntzs_user_id as recipient_ntzs_user_id
        FROM group_proposals p
        JOIN groups g ON g.id = p.group_id
        LEFT JOIN members m ON m.id = p.recipient_member_id
        WHERE p.id = $1 AND p.group_id = $2
        LIMIT 1
      `,
      [proposalIdNum, groupId]
    );

    if (proposalRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const proposal = proposalRes.rows[0] as {
      id: number;
      group_id: number;
      title: string;
      description: string;
      status: string;
      payment_amount_tzs: number | null;
      recipient_member_id: number | null;
      recipient_phone: string | null;
      payment_status: string | null;
      payment_tx_id: string | null;
      group_ntzs_user_id: string | null;
      voting_threshold_numerator: number;
      voting_threshold_denominator: number;
      recipient_ntzs_user_id: string | null;
    };

    // Validate it's a payment proposal
    if (!proposal.payment_amount_tzs || proposal.payment_amount_tzs <= 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not a payment proposal' }, { status: 400 });
    }

    // Check if already executed
    if (proposal.payment_status === 'executed') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Proposal already executed' }, { status: 400 });
    }

    // Check group has treasury
    if (!proposal.group_ntzs_user_id) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Group treasury not provisioned' }, { status: 400 });
    }

    // Count votes
    const votesRes = await client.query(
      `
        SELECT 
          COUNT(*) FILTER (WHERE vote = 'yes') as yes_votes,
          COUNT(*) FILTER (WHERE vote = 'no') as no_votes,
          COUNT(*) as total_votes
        FROM group_proposal_votes
        WHERE proposal_id = $1
      `,
      [proposalIdNum]
    );

    const votes = votesRes.rows[0] as { yes_votes: string; no_votes: string; total_votes: string };
    const yesVotes = Number(votes.yes_votes);
    const noVotes = Number(votes.no_votes);

    // Get total active members
    const membersRes = await client.query(
      `SELECT COUNT(*) as total FROM group_members WHERE group_id = $1 AND status = 'active'`,
      [groupId]
    );
    const totalMembers = Number((membersRes.rows[0] as { total: string }).total);

    // Check if proposal passed threshold
    const requiredYes = Math.ceil(
      (totalMembers * proposal.voting_threshold_numerator) / proposal.voting_threshold_denominator
    );

    if (yesVotes < requiredYes) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        {
          error: 'Proposal has not reached voting threshold',
          details: `Requires ${requiredYes} yes votes, has ${yesVotes}`,
        },
        { status: 400 }
      );
    }

    // Determine recipient
    let recipientNtzsUserId: string;
    let recipientType: 'member' | 'phone';

    if (proposal.recipient_member_id && proposal.recipient_ntzs_user_id) {
      recipientNtzsUserId = proposal.recipient_ntzs_user_id;
      recipientType = 'member';
    } else if (proposal.recipient_phone) {
      // For phone recipients, we'd need to create a withdrawal instead of transfer
      // For now, require member recipient
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Phone-based recipients not yet supported. Recipient must be a member.' },
        { status: 400 }
      );
    } else {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No valid recipient specified' }, { status: 400 });
    }

    // Execute nTZS transfer
    const transfer = await ntzs.transfers.create({
      fromUserId: proposal.group_ntzs_user_id,
      toUserId: recipientNtzsUserId,
      amountTzs: proposal.payment_amount_tzs,
    });

    // Record transaction
    await recordTransaction(client, {
      ntzsId: transfer.id,
      type: 'transfer',
      status: transfer.status,
      fromGroupId: groupId,
      toMemberId: proposal.recipient_member_id,
      amountTzs: transfer.amountTzs,
      feeTzs: transfer.feeAmountTzs,
      netTzs: transfer.recipientAmountTzs,
      txHash: transfer.txHash,
      purpose: 'disbursement',
      note: `Proposal #${proposal.id}: ${proposal.title}`,
      metadata: { proposalId: proposal.id },
    });

    // Update proposal
    await client.query(
      `
        UPDATE group_proposals
        SET payment_status = 'executed',
            payment_tx_id = $1,
            executed_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
      `,
      [transfer.id, proposalIdNum]
    );

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
      proposal: {
        id: proposal.id,
        paymentStatus: 'executed',
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Proposal execute error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  } finally {
    client.release();
  }
}
