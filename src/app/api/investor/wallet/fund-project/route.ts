import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const proposalId = body?.proposalId ? Number(body.proposalId) : 0;
  const amountTzs = body?.amountTzs ? Number(body.amountTzs) : 0;

  if (!proposalId) {
    return NextResponse.json({ error: 'Proposal ID required' }, { status: 400 });
  }
  if (!amountTzs || amountTzs < 1000) {
    return NextResponse.json({ error: 'Minimum amount is TSH 1,000' }, { status: 400 });
  }

  let client;
  try {
    client = await pool.connect();
    await ensureNtzsSchema(client);

    // Investor wallet
    const investorRes = await client.query(
      `SELECT ntzs_user_id FROM investor_profiles WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    ) as { rows: { ntzs_user_id: string | null }[] };

    const investorNtzsUserId = investorRes.rows[0]?.ntzs_user_id;
    if (!investorNtzsUserId) {
      return NextResponse.json(
        { error: 'Your wallet is not set up yet. Please create a wallet first.' },
        { status: 400 }
      );
    }

    // Group wallet via proposal
    const proposalRes = await client.query(
      `SELECT p.id, p.title, p.group_id,
              g.name AS group_name,
              g.ntzs_user_id AS group_ntzs_user_id
       FROM group_proposals p
       JOIN groups g ON g.id = p.group_id
       WHERE p.id = $1 AND p.proposal_type = 'prodcast'
       LIMIT 1`,
      [proposalId]
    ) as { rows: { id: number; title: string; group_id: number; group_name: string; group_ntzs_user_id: string | null }[] };

    if (proposalRes.rows.length === 0) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const proposal = proposalRes.rows[0];
    if (!proposal.group_ntzs_user_id) {
      return NextResponse.json(
        { error: `${proposal.group_name} does not have a treasury wallet yet. Contact the admin.` },
        { status: 400 }
      );
    }

    // Execute the nTZS transfer
    const transfer = await ntzs.transfers.create({
      fromUserId: investorNtzsUserId,
      toUserId: proposal.group_ntzs_user_id,
      amountTzs,
    });

    // Record in local ledger
    await recordTransaction(client, {
      ntzsId: transfer.id,
      type: 'transfer',
      status: transfer.status,
      toGroupId: proposal.group_id,
      amountTzs: transfer.amountTzs,
      feeTzs: transfer.feeAmountTzs,
      netTzs: transfer.recipientAmountTzs,
      txHash: transfer.txHash,
      purpose: 'disbursement',
      note: `Investor funding: ${proposal.title} (${proposal.group_name})`,
      metadata: { investor_user_id: auth.userId, proposal_id: proposalId },
    });

    return NextResponse.json({
      success: true,
      transferId: transfer.id,
      status: transfer.status,
      amountTzs: transfer.amountTzs,
      feeTzs: transfer.feeAmountTzs,
      netTzs: transfer.recipientAmountTzs,
      message: `Sent TSH ${amountTzs.toLocaleString()} to ${proposal.group_name}`,
    });
  } catch (error) {
    if (error instanceof NtzsApiError) {
      console.error(`Fund project nTZS error (${error.status}):`, error.body);
      const msg = error.body?.message || error.body?.error || 'Transfer failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error('Fund project error:', error);
    return NextResponse.json({ error: 'Transfer failed. Please try again.' }, { status: 500 });
  } finally {
    client?.release();
  }
}
