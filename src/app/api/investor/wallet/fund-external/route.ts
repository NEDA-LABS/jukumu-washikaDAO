import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import {
  ensureExternalFundingSchema,
  getTreasuryAddress,
  looksLikeWalletAddress,
  normalizeTxHash,
} from '@/lib/wallet/external-funding';
import { notifyGroupMembers } from '@/lib/notify';

export const runtime = 'nodejs';

/**
 * GET  /api/investor/wallet/fund-external — the treasury address to send to,
 *      plus this funder's own claims.
 * POST /api/investor/wallet/fund-external — declare a transfer already sent
 *      on-chain from an external wallet.
 *
 * A POST records an intent to fund; it does not move money. The group's
 * balance changes only when the arrival is confirmed against the treasury.
 */

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureExternalFundingSchema();
  const client = await pool.connect();
  try {
    const treasuryAddress = await getTreasuryAddress(client);
    const claims = await client.query(
      `SELECT c.id, c.group_id, c.proposal_id, c.from_address, c.amount_tzs,
              c.tx_hash, c.status, c.review_reason, c.created_at, c.reviewed_at,
              g.name AS group_name, p.title AS proposal_title
         FROM external_funding_claims c
         JOIN groups g ON g.id = c.group_id
         LEFT JOIN group_proposals p ON p.id = c.proposal_id
        WHERE c.claimed_by_user_id = $1
        ORDER BY c.created_at DESC
        LIMIT 50`,
      [auth.userId]
    );
    return NextResponse.json({
      treasuryAddress,
      claims: claims.rows.map((r) => ({ ...(r as object), amount_tzs: Number((r as { amount_tzs: string }).amount_tzs) })),
    });
  } catch (error) {
    console.error('External funding GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const proposalId = body?.proposalId ? Number(body.proposalId) : null;
  const groupIdRaw = body?.groupId ? Number(body.groupId) : null;
  const amountTzs = body?.amountTzs ? Math.floor(Number(body.amountTzs)) : 0;
  const fromAddress = typeof body?.fromAddress === 'string' ? body.fromAddress.trim() : '';
  const txHash = normalizeTxHash(body?.txHash);
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : null;

  if (!Number.isFinite(amountTzs) || amountTzs < 1000) {
    return NextResponse.json({ error: 'Minimum amount is TSH 1,000' }, { status: 400 });
  }
  // The hash is what makes a claim confirmable and what stops the same
  // transfer being credited twice, so it is the one required identifier.
  if (!txHash) {
    return NextResponse.json(
      {
        error: body?.txHash
          ? 'That transaction hash is not valid (expected 0x… , 66 characters)'
          : 'Enter the transaction hash from your wallet so we can confirm the transfer',
        field: 'txHash',
      },
      { status: 400 }
    );
  }
  // Optional: an unverified hint that helps reconcile the deposit. Rejected
  // only if it is present and malformed, never for being absent.
  if (fromAddress && !looksLikeWalletAddress(fromAddress)) {
    return NextResponse.json(
      { error: 'That wallet address is not valid (expected 0x… , 42 characters)', field: 'fromAddress' },
      { status: 400 }
    );
  }

  await ensureExternalFundingSchema();
  const client = await pool.connect();
  try {
    // Resolve the destination group, either directly or via the proposal the
    // funder is backing.
    let groupId = groupIdRaw;
    let proposalTitle: string | null = null;
    if (proposalId) {
      const res = await client.query(
        `SELECT p.id, p.title, p.group_id FROM group_proposals p WHERE p.id = $1 LIMIT 1`,
        [proposalId]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      }
      const row = res.rows[0] as { title: string; group_id: number };
      groupId = row.group_id;
      proposalTitle = row.title;
    }
    if (!groupId) {
      return NextResponse.json({ error: 'groupId or proposalId is required' }, { status: 400 });
    }

    const groupRes = await client.query(`SELECT id, name FROM groups WHERE id = $1 LIMIT 1`, [groupId]);
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    const groupName = (groupRes.rows[0] as { name: string }).name;

    // A hash that already funded something cannot fund anything else.
    if (txHash) {
      const dupe = await client.query(
        `SELECT id, status FROM external_funding_claims
          WHERE lower(tx_hash) = $1 AND status IN ('pending', 'confirmed') LIMIT 1`,
        [txHash]
      );
      if (dupe.rows.length > 0) {
        return NextResponse.json(
          { error: 'That transaction has already been submitted', field: 'txHash' },
          { status: 409 }
        );
      }
    }

    const inserted = await client.query(
      `INSERT INTO external_funding_claims
         (group_id, proposal_id, claimed_by_user_id, from_address, amount_tzs, tx_hash, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, status, created_at`,
      [groupId, proposalId, auth.userId, fromAddress ? fromAddress.toLowerCase() : null, amountTzs, txHash, note]
    );
    const claim = inserted.rows[0] as { id: number; status: string; created_at: string };

    // Tell the group someone is funding them. This is a heads-up, not a
    // credit — the message says pending on purpose.
    try {
      const amt = amountTzs.toLocaleString();
      await notifyGroupMembers(client, groupId, {
        title: 'Ufadhili Unasubiri Uthibitisho',
        message: `Mfadhili ametuma TSh ${amt} kwa ${proposalTitle || groupName}. Inasubiri uthibitisho.`,
        titleEn: 'Funding Pending Confirmation',
        messageEn: `A funder sent TSh ${amt} to ${proposalTitle || groupName}. Awaiting confirmation.`,
        type: 'info',
        category: 'group',
        actionUrl: `/member-dashboard/groups/${groupId}`,
        actionText: 'Angalia',
        metadata: { claimId: claim.id, amountTzs, kind: 'external_funding_pending' },
      });
    } catch (notifyErr) {
      console.error('External funding notify failed:', notifyErr);
    }

    const treasuryAddress = await getTreasuryAddress(client);
    return NextResponse.json({
      success: true,
      claim: { id: claim.id, status: claim.status, amountTzs, groupId, groupName },
      treasuryAddress,
      message: 'Funding recorded. The group is credited once the transfer is confirmed.',
    });
  } catch (error) {
    console.error('External funding POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
