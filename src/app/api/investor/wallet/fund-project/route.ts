import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { internalTransfer, LedgerError } from '@/lib/wallet/ledger';

export const runtime = 'nodejs';

/**
 * Investor funds a community-approved (prodcast) project — an internal ledger
 * transfer from the investor account to the group account. Pure DB, atomic.
 */
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

  const client = await pool.connect();
  let inTx = false;
  try {
    await ensureNtzsSchema(client);

    const investorRes = await client.query(
      `SELECT user_id FROM investor_profiles WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    ) as { rows: { user_id: number }[] };
    if (investorRes.rows.length === 0) {
      return NextResponse.json({ error: 'Investor profile not found' }, { status: 404 });
    }

    const proposalRes = await client.query(
      `SELECT p.id, p.title, p.group_id, g.name AS group_name
       FROM group_proposals p
       JOIN groups g ON g.id = p.group_id
       WHERE p.id = $1 AND p.proposal_type = 'prodcast'
       LIMIT 1`,
      [proposalId]
    ) as { rows: { id: number; title: string; group_id: number; group_name: string }[] };

    if (proposalRes.rows.length === 0) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }
    const proposal = proposalRes.rows[0];

    await client.query('BEGIN');
    inTx = true;
    const result = await internalTransfer(client, {
      from: { ownerType: 'investor', ownerId: auth.userId },
      to: { ownerType: 'group', ownerId: proposal.group_id },
      amountTzs,
      purpose: 'funding',
      note: `Investor funding: ${proposal.title} (${proposal.group_name})`,
      metadata: { investor_user_id: auth.userId, proposal_id: proposalId },
    });
    await client.query('COMMIT');
    inTx = false;

    return NextResponse.json({
      success: true,
      transferId: result.journalId,
      status: 'completed',
      amountTzs: result.amountTzs,
      feeTzs: 0,
      netTzs: result.amountTzs,
      message: `Sent TSH ${amountTzs.toLocaleString()} to ${proposal.group_name}`,
    });
  } catch (error) {
    if (inTx) await client.query('ROLLBACK').catch(() => {});
    if (error instanceof LedgerError) {
      const msg = error.code === 'insufficient_balance'
        ? 'Salio haitoshi (Insufficient balance). Top up your wallet first.'
        : error.message;
      return NextResponse.json({ error: msg, code: error.code }, { status: 400 });
    }
    console.error('Fund project error:', error);
    return NextResponse.json({ error: 'Transfer failed. Please try again.' }, { status: 500 });
  } finally {
    client?.release();
  }
}
