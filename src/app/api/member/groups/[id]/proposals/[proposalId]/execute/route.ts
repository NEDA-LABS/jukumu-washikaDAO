import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { internalTransfer, debit, getMasterNtzsUserId, LedgerError } from '@/lib/wallet/ledger';
import { ntzs, NtzsApiError } from '@/lib/ntzs';

export const runtime = 'nodejs';

const LEADERSHIP_ROLES = new Set(['leader', 'mwenyekiti', 'katibu', 'mwekahazina']);

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

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}

/**
 * POST /api/member/groups/[id]/proposals/[proposalId]/execute
 *
 * Disburses an approved ask/spend proposal from the group treasury:
 *  - recipient is a member → atomic internal ledger transfer (group → member)
 *  - recipient is a non-member phone → external off-ramp (debit group, burn
 *    from the master wallet to that phone)
 *
 * The proposal row is locked FOR UPDATE so two leaders can't double-pay.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, proposalId } = await params;
  const groupId = Number.parseInt(id, 10);
  const proposalIdNum = Number.parseInt(proposalId, 10);

  if (!Number.isFinite(groupId) || !Number.isFinite(proposalIdNum)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  // Optional leadership-supplied overrides — so a passed proposal can still be
  // disbursed even if the amount/recipient weren't captured at creation time.
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const overrideAmount = body?.amountTzs != null ? Number(body.amountTzs) : null;
  const overrideRecipientMemberId = body?.recipientMemberId != null ? Number(body.recipientMemberId) : null;
  const overridePhone = typeof body?.recipientPhone === 'string' ? body.recipientPhone.trim() : null;

  const client = await pool.connect();
  let inTx = false;
  try {
    await ensureNtzsSchema(client);

    // Platform admins can execute any group's approved proposal; otherwise the
    // caller must be group leadership.
    if (auth.role !== 'admin') {
      const membership = await getMembership(client, auth.userId, groupId);
      if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (!LEADERSHIP_ROLES.has(membership.role)) {
        return NextResponse.json({ error: 'Only leadership can execute proposals' }, { status: 403 });
      }
    }

    await client.query('BEGIN');
    inTx = true;

    // Lock the proposal row (not the group) to serialize execution attempts.
    const proposalRes = await client.query(
      `SELECT p.id, p.title, p.proposal_type,
              p.payment_amount_tzs, p.recipient_member_id, p.recipient_phone, p.payment_status,
              g.voting_threshold_numerator, g.voting_threshold_denominator
       FROM group_proposals p
       JOIN groups g ON g.id = p.group_id
       WHERE p.id = $1 AND p.group_id = $2
       FOR UPDATE OF p`,
      [proposalIdNum, groupId]
    );
    if (proposalRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }
    const proposal = proposalRes.rows[0] as {
      id: number; title: string; proposal_type: string;
      payment_amount_tzs: string | number | null;
      recipient_member_id: number | null; recipient_phone: string | null;
      payment_status: string | null;
      voting_threshold_numerator: number; voting_threshold_denominator: number;
    };

    // Prodcasts are funded by investors, not disbursed from the treasury.
    if (proposal.proposal_type === 'prodcast') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Prodcast proposals are funded by investors, not disbursed from the treasury' }, { status: 400 });
    }
    // Amount: leadership override wins, else the proposal's amount.
    const amount = overrideAmount && overrideAmount > 0 ? Math.round(overrideAmount) : Number(proposal.payment_amount_tzs);
    if (!Number.isFinite(amount) || amount <= 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Weka kiasi cha malipo (set a payment amount to disburse)' }, { status: 400 });
    }
    if (proposal.payment_status === 'completed') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Proposal already executed' }, { status: 400 });
    }

    // Vote threshold
    const votesRes = await client.query(
      `SELECT COUNT(*) FILTER (WHERE vote = 'yes') AS yes_votes FROM group_proposal_votes WHERE proposal_id = $1`,
      [proposalIdNum]
    );
    const yesVotes = Number((votesRes.rows[0] as { yes_votes: string }).yes_votes);
    const membersRes = await client.query(
      `SELECT COUNT(*) AS total FROM group_members WHERE group_id = $1 AND status = 'active'`,
      [groupId]
    );
    const totalMembers = Number((membersRes.rows[0] as { total: string }).total);
    const requiredYes = Math.ceil(
      (totalMembers * proposal.voting_threshold_numerator) / proposal.voting_threshold_denominator
    );
    if (yesVotes < requiredYes) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Proposal has not reached voting threshold', details: `Requires ${requiredYes} yes votes, has ${yesVotes}` },
        { status: 400 }
      );
    }

    // Resolve recipient: leadership override → proposal's recipient → phone lookup.
    let recipientMemberId = overrideRecipientMemberId || proposal.recipient_member_id;
    const recipientPhone = overridePhone || proposal.recipient_phone;
    if (!recipientMemberId && recipientPhone) {
      const phoneRes = await client.query(
        `SELECT id FROM members WHERE phone = $1 LIMIT 1`,
        [recipientPhone]
      );
      if (phoneRes.rows.length > 0) recipientMemberId = (phoneRes.rows[0] as { id: number }).id;
    }

    let paymentTxId: string;
    let payout: Record<string, unknown>;

    if (recipientMemberId) {
      // Internal ledger transfer — instant, atomic, no chain call.
      const result = await internalTransfer(client, {
        from: { ownerType: 'group', ownerId: groupId },
        to: { ownerType: 'member', ownerId: recipientMemberId },
        amountTzs: amount,
        purpose: proposal.proposal_type === 'spend' ? 'expense' : 'disbursement',
        note: `Proposal #${proposal.id}: ${proposal.title}`,
        metadata: { proposalId: proposal.id, proposalType: proposal.proposal_type },
      });
      paymentTxId = String(result.journalId);
      payout = { type: 'internal', amountTzs: amount, recipientMemberId, status: 'completed' };

    } else if (recipientPhone) {
      // External off-ramp to a non-member phone.
      if (!process.env.NTZS_API_KEY) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Wallet service not configured for external payouts.' }, { status: 503 });
      }
      await debit(client, { ownerType: 'group', ownerId: groupId }, amount); // reserve from treasury
      const masterUserId = await getMasterNtzsUserId(client);
      const phone = normalizePhone(recipientPhone);
      const withdrawal = await ntzs.withdrawals.create({ userId: masterUserId, amountTzs: amount, phoneNumber: phone });
      await recordTransaction(client, {
        ntzsId: withdrawal.id,
        type: 'withdrawal',
        status: withdrawal.status,
        fromGroupId: groupId,
        amountTzs: amount,
        netTzs: amount,
        phone,
        purpose: 'expense',
        note: `Proposal #${proposal.id}: ${proposal.title}`,
        metadata: { proposalId: proposal.id, proposalType: proposal.proposal_type },
        posted: true,
      });
      paymentTxId = withdrawal.id;
      payout = { type: 'external', amountTzs: amount, phone, status: withdrawal.status };

    } else {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No valid recipient specified' }, { status: 400 });
    }

    await client.query(
      `UPDATE group_proposals
       SET payment_status = 'completed', payment_tx_id = $1, executed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [paymentTxId, proposalIdNum]
    );

    await client.query('COMMIT');
    inTx = false;

    return NextResponse.json({
      success: true,
      payout,
      proposal: { id: proposal.id, paymentStatus: 'completed' },
    });
  } catch (error) {
    if (inTx) await client.query('ROLLBACK').catch(() => {});
    if (error instanceof LedgerError) {
      const msg = error.code === 'insufficient_balance'
        ? 'Salio la hazina haitoshi (Group treasury balance is insufficient)'
        : error.message;
      return NextResponse.json({ error: msg, code: error.code }, { status: 400 });
    }
    if (error instanceof NtzsApiError) {
      console.error('Proposal execute nTZS error:', error.status, error.body);
      return NextResponse.json({ error: error.body?.message || 'Payout failed' }, { status: 502 });
    }
    console.error('Proposal execute error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  } finally {
    client.release();
  }
}
