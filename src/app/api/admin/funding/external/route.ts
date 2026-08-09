import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { credit } from '@/lib/wallet/ledger';
import { ensureExternalFundingSchema } from '@/lib/wallet/external-funding';
import { notifyGroupMembers, notify } from '@/lib/notify';

export const runtime = 'nodejs';

/**
 * Review queue for funding sent to the treasury from an outside wallet.
 *
 * GET  — pending claims.
 * POST — { claimId, action: 'confirm' | 'reject', reason? }
 *
 * Confirming is the step that turns a funder's claim into money: it credits
 * the group's ledger balance. It is deliberately a human decision, because
 * nothing in the claim itself proves the transfer arrived — the funder typed
 * it. Whoever confirms is asserting they have seen the nTZS reach the treasury
 * wallet, and their user id is recorded against that assertion.
 */

async function requireAdmin(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return null;
  // Role is read from the database, not the token: a token minted before
  // someone was demoted still carries the old claim.
  const res = await pool.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [auth.userId]);
  if ((res.rows[0] as { role?: string } | undefined)?.role !== 'admin') return null;
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await ensureExternalFundingSchema();
  const client = await pool.connect();
  try {
    const status = new URL(request.url).searchParams.get('status') || 'pending';
    const res = await client.query(
      `SELECT c.id, c.group_id, c.proposal_id, c.from_address, c.amount_tzs, c.tx_hash,
              c.status, c.note, c.review_reason, c.created_at, c.reviewed_at,
              g.name AS group_name, p.title AS proposal_title,
              u.full_name AS funder_name, u.email AS funder_email
         FROM external_funding_claims c
         JOIN groups g ON g.id = c.group_id
         JOIN users u ON u.id = c.claimed_by_user_id
         LEFT JOIN group_proposals p ON p.id = c.proposal_id
        WHERE c.status = $1
        ORDER BY c.created_at ASC
        LIMIT 200`,
      [status]
    );
    return NextResponse.json({
      claims: res.rows.map((r) => ({
        ...(r as object),
        amount_tzs: Number((r as { amount_tzs: string }).amount_tzs),
      })),
    });
  } catch (error) {
    console.error('External funding review GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const claimId = body?.claimId ? Number(body.claimId) : 0;
  const action = body?.action;
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

  if (!claimId) return NextResponse.json({ error: 'claimId is required' }, { status: 400 });
  if (action !== 'confirm' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'confirm' or 'reject'" }, { status: 400 });
  }

  await ensureExternalFundingSchema();
  const client = await pool.connect();
  let inTx = false;
  try {
    await ensureNtzsSchema(client);
    await client.query('BEGIN');
    inTx = true;

    // Lock the claim so two reviewers can't both confirm it.
    const res = await client.query(
      `SELECT c.id, c.group_id, c.proposal_id, c.claimed_by_user_id, c.from_address,
              c.amount_tzs, c.tx_hash, c.status, g.name AS group_name
         FROM external_funding_claims c
         JOIN groups g ON g.id = c.group_id
        WHERE c.id = $1
        FOR UPDATE OF c`,
      [claimId]
    );
    if (res.rows.length === 0) {
      await client.query('ROLLBACK');
      inTx = false;
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }
    const claim = res.rows[0] as {
      id: number; group_id: number; proposal_id: number | null; claimed_by_user_id: number;
      from_address: string; amount_tzs: string; tx_hash: string | null; status: string;
      group_name: string;
    };

    if (claim.status !== 'pending') {
      await client.query('ROLLBACK');
      inTx = false;
      return NextResponse.json(
        { error: `This claim was already ${claim.status}` },
        { status: 409 }
      );
    }

    const amountTzs = Number(claim.amount_tzs);

    if (action === 'reject') {
      await client.query(
        `UPDATE external_funding_claims
            SET status = 'rejected', reviewed_by_user_id = $1, reviewed_at = NOW(), review_reason = $2
          WHERE id = $3`,
        [auth.userId, reason, claimId]
      );
      await client.query('COMMIT');
      inTx = false;

      try {
        await notify(client, claim.claimed_by_user_id, {
          title: 'Ufadhili Haujakubaliwa',
          message: `Ufadhili wa TSh ${amountTzs.toLocaleString()} haukuthibitishwa.${reason ? ` Sababu: ${reason}` : ''}`,
          titleEn: 'Funding Not Confirmed',
          messageEn: `Your TSh ${amountTzs.toLocaleString()} funding could not be confirmed.${reason ? ` Reason: ${reason}` : ''}`,
          type: 'warning', category: 'wallet',
        });
      } catch (e) { console.error('reject notify failed:', e); }

      return NextResponse.json({ success: true, status: 'rejected' });
    }

    // ── confirm: this is where the money becomes real ──
    const newBalance = await credit(client, { ownerType: 'group', ownerId: claim.group_id }, amountTzs);

    // The nTZS itself sits in the master treasury wallet, so the platform's
    // custodial position grows with the group's claim on it.
    await credit(client, { ownerType: 'master', ownerId: 0 }, amountTzs);

    await recordTransaction(client, {
      ntzsId: null,
      type: 'deposit',
      status: 'minted',
      toGroupId: claim.group_id,
      amountTzs,
      txHash: claim.tx_hash ?? undefined,
      purpose: 'funding',
      note: `External nTZS funding from ${claim.from_address}`,
      metadata: {
        kind: 'external_funding',
        claim_id: claim.id,
        from_address: claim.from_address,
        proposal_id: claim.proposal_id,
        confirmed_by_user_id: auth.userId,
      },
      posted: true,
    });

    await client.query(
      `UPDATE external_funding_claims
          SET status = 'confirmed', reviewed_by_user_id = $1, reviewed_at = NOW(), review_reason = $2
        WHERE id = $3`,
      [auth.userId, reason, claimId]
    );

    await client.query('COMMIT');
    inTx = false;

    const amt = amountTzs.toLocaleString();
    try {
      await notifyGroupMembers(client, claim.group_id, {
        title: 'Ufadhili Umepokelewa',
        message: `TSh ${amt} zimeingia kwenye hazina ya kundi kutoka kwa mfadhili.`,
        titleEn: 'Funding Received',
        messageEn: `TSh ${amt} has landed in the group treasury from a funder.`,
        type: 'success', category: 'group',
        actionUrl: `/member-dashboard/groups/${claim.group_id}`, actionText: 'Angalia',
        metadata: { amountTzs, kind: 'external_funding_confirmed' },
      });
      await notify(client, claim.claimed_by_user_id, {
        title: 'Ufadhili Umethibitishwa',
        message: `TSh ${amt} zimefika kwa ${claim.group_name}.`,
        titleEn: 'Funding Confirmed',
        messageEn: `Your TSh ${amt} reached ${claim.group_name}.`,
        type: 'success', category: 'wallet',
      });
    } catch (e) { console.error('confirm notify failed:', e); }

    return NextResponse.json({
      success: true,
      status: 'confirmed',
      amountTzs,
      groupId: claim.group_id,
      groupBalanceTzs: newBalance,
    });
  } catch (error) {
    if (inTx) await client.query('ROLLBACK').catch(() => {});
    console.error('External funding review POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
