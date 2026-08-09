import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { createPayout, getPayoutFee } from '@/lib/snippe';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { debit, LedgerError } from '@/lib/wallet/ledger';
import { assertPayoutAuthorized, PayoutAuthorizationError } from '@/lib/groups/payout-authorization';

const LEADERSHIP_ROLES = new Set(['leader', 'mwenyekiti', 'katibu', 'mwekahazina']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  let body: {
    recipientPhone: string;
    recipientName: string;
    provider: string;
    amount: number;
    description?: string;
    proposalId?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { recipientPhone, recipientName, provider, amount, description, proposalId } = body;

  if (!recipientPhone || !recipientName || !provider || !amount || amount <= 0) {
    return NextResponse.json(
      { error: 'recipientPhone, recipientName, provider, and amount are required' },
      { status: 400 }
    );
  }

  const validProviders = ['airtel', 'mpesa', 'mixx', 'halopesa', 'tigopesa'];
  if (!validProviders.includes(provider.toLowerCase())) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  let inTx = false;
  try {
    // Get requesting member
    const memberRes = await client.query(
      `SELECT m.id, m.full_name FROM members m WHERE m.user_id = $1 LIMIT 1`,
      [auth.userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }
    const member = memberRes.rows[0] as { id: number; full_name: string };

    // Verify the requester is a leader in this group
    const membershipRes = await client.query(
      `SELECT gm.role FROM group_members gm
       WHERE gm.group_id = $1 AND gm.member_id = $2
       LIMIT 1`,
      [groupId, member.id]
    );
    if (membershipRes.rows.length === 0) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }
    const { role } = membershipRes.rows[0] as { role: string };
    if (!LEADERSHIP_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'Only group leaders can initiate disbursements' },
        { status: 403 }
      );
    }

    // Fetch group name for metadata
    const groupRes = await client.query(
      `SELECT name FROM groups WHERE id = $1 LIMIT 1`,
      [groupId]
    );
    const groupName = groupRes.rows.length > 0
      ? (groupRes.rows[0] as { name: string }).name
      : `Group ${groupId}`;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jukumu.netlify.app';
    const webhookUrl = `${appUrl}/api/webhooks/snippe`;

    // Calculate fee so caller is informed
    let feeInfo: { fee: number; total: number } | null = null;
    try {
      feeInfo = await getPayoutFee(amount);
    } catch {
      // non-fatal — proceed without fee preview
    }

    // Members authorize the spend; leadership only executes it. The proposal is
    // locked and the treasury debited in one transaction, so a payout can never
    // leave the group without the balance moving with it.
    await ensureNtzsSchema(client);
    await client.query('BEGIN');
    inTx = true;
    await assertPayoutAuthorized(client, groupId, proposalId, amount);
    await debit(client, { ownerType: 'group', ownerId: groupId }, amount);
    await client.query(
      `UPDATE group_proposals SET payment_status = 'processing' WHERE id = $1`,
      [Number(proposalId)]
    );
    await client.query('COMMIT');
    inTx = false;

    let payout;
    try {
      payout = await createPayout({
      amount,
      phone: recipientPhone,
      name: recipientName,
      provider: provider.toLowerCase(),
      description: description ?? `Malipo kutoka ${groupName}`,
      webhook_url: webhookUrl,
      metadata: {
        payment_type: 'disbursement',
        group_id: String(groupId),
        group_name: groupName,
        initiated_by_member_id: String(member.id),
        initiated_by_name: member.full_name,
        proposal_id: String(proposalId),
      },
      });
    } catch (payoutErr) {
      // The rail refused it. Put the money back — the debit above already
      // committed, so nothing else will unwind it.
      await client.query('BEGIN');
      await client.query(
        `UPDATE wallet_accounts SET balance_tzs = balance_tzs + $1, updated_at = NOW()
          WHERE owner_type = 'group' AND owner_id = $2`,
        [amount, groupId]
      );
      await client.query(
        `UPDATE group_proposals SET payment_status = 'failed' WHERE id = $1`,
        [Number(proposalId)]
      );
      await client.query('COMMIT');
      throw payoutErr;
    }

    return NextResponse.json({
      success: true,
      reference: payout.data.reference,
      status: payout.data.status,
      amount,
      fee: feeInfo?.fee ?? null,
      total_deducted: feeInfo?.total ?? null,
      recipient: { phone: recipientPhone, name: recipientName, provider },
    });
  } catch (error) {
    if (inTx) await client.query('ROLLBACK').catch(() => {});
    if (error instanceof PayoutAuthorizationError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    }
    if (error instanceof LedgerError) {
      const msg = error.code === 'insufficient_balance'
        ? 'Salio la kundi haitoshi (Insufficient group balance)'
        : error.message;
      return NextResponse.json({ error: msg, code: error.code }, { status: 400 });
    }
    console.error('Disbursement error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    // Verify membership
    const memberRes = await client.query(
      `SELECT m.id FROM members m
       JOIN group_members gm ON gm.member_id = m.id
       WHERE m.user_id = $1 AND gm.group_id = $2
       LIMIT 1`,
      [auth.userId, groupId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if snippe_payments table exists before querying
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'snippe_payments'
      ) AS exists`
    );
    const tableExists = (tableCheck.rows[0] as { exists: boolean }).exists;
    if (!tableExists) {
      return NextResponse.json({ success: true, disbursements: [] });
    }

    const res = await client.query(
      `SELECT reference, status, amount_tzs, net_tzs,
              channel_provider, customer_phone, customer_name,
              failure_reason, completed_at, created_at,
              metadata->>'initiated_by_name' as initiated_by
       FROM snippe_payments
       WHERE group_id = $1 AND payment_type = 'disbursement'
       ORDER BY created_at DESC
       LIMIT 50`,
      [groupId]
    );

    return NextResponse.json({ success: true, disbursements: res.rows });
  } catch (error) {
    console.error('Disbursements GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
