import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { debit, getBalanceTzs, getTotalsByOwnerType, LedgerError } from '@/lib/wallet/ledger';

export const runtime = 'nodejs';

/**
 * Reconcile a withdrawal that already settled on nTZS (master burned, recipient
 * paid) but whose DB debit rolled back due to an error — leaving the member
 * over-credited and the ledger sitting above the master's on-chain balance.
 *
 * Debits the member/group for the amount that actually left and records the
 * withdrawal so the ledger matches reality. Admin only. The debit is
 * overdraw-safe: if the amount exceeds the balance it fails loudly rather than
 * going negative. Optionally idempotent via `reference` (the nTZS withdrawal id).
 */
export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const amountTzs = Math.round(Number(body.amountTzs));
  const memberPhone = typeof body.memberPhone === 'string' ? body.memberPhone.trim() : null;
  const memberId = body.memberId != null ? Number(body.memberId) : null;
  const groupId = body.groupId != null ? Number(body.groupId) : null;
  const reference = typeof body.reference === 'string' && body.reference.trim() ? body.reference.trim() : null;

  if (!Number.isFinite(amountTzs) || amountTzs <= 0) {
    return NextResponse.json({ error: 'Weka kiasi sahihi (provide a positive amount)' }, { status: 400 });
  }

  const client = await pool.connect();
  let inTx = false;
  try {
    await ensureNtzsSchema(client);

    // Resolve the owner whose balance must be corrected.
    let owner: { ownerType: 'member' | 'group'; ownerId: number } | null = null;
    let label = '';
    if (memberId && Number.isFinite(memberId)) {
      owner = { ownerType: 'member', ownerId: memberId };
    } else if (groupId && Number.isFinite(groupId)) {
      owner = { ownerType: 'group', ownerId: groupId };
    } else if (memberPhone) {
      const norm = memberPhone.replace(/\D/g, '');
      const r = await client.query(
        `SELECT id, full_name FROM members
         WHERE right(regexp_replace(phone, '\\D', '', 'g'), 9) = right($1, 9) LIMIT 1`,
        [norm]
      );
      if (r.rows.length === 0) {
        return NextResponse.json({ error: 'Mwanachama hakupatikana kwa namba hii (no member with that phone)' }, { status: 404 });
      }
      const m = r.rows[0] as { id: number; full_name: string };
      owner = { ownerType: 'member', ownerId: m.id };
      label = m.full_name;
    }
    if (!owner) {
      return NextResponse.json({ error: 'Provide memberPhone, memberId, or groupId' }, { status: 400 });
    }

    // Idempotency: skip if this nTZS withdrawal was already reconciled.
    if (reference) {
      const dup = await client.query(`SELECT id FROM ntzs_transactions WHERE ntzs_id = $1 LIMIT 1`, [reference]);
      if (dup.rows.length > 0) {
        return NextResponse.json({ error: 'Imesharekebishwa (a transaction with this reference already exists)' }, { status: 409 });
      }
    }

    const balanceBeforeTzs = await getBalanceTzs(client, owner);

    await client.query('BEGIN');
    inTx = true;
    const balanceAfterTzs = await debit(client, owner, amountTzs);
    await recordTransaction(client, {
      ntzsId: reference,
      type: 'withdrawal',
      status: 'completed',
      fromMemberId: owner.ownerType === 'member' ? owner.ownerId : null,
      fromGroupId: owner.ownerType === 'group' ? owner.ownerId : null,
      amountTzs,
      netTzs: amountTzs,
      purpose: 'withdrawal',
      note: `Reconciliation: external withdrawal already settled on nTZS${reference ? ` (ref ${reference})` : ''}`,
      posted: true,
    });
    await client.query('COMMIT');
    inTx = false;

    // Fresh liabilities snapshot so the caller can confirm the drift closed.
    const totals = await getTotalsByOwnerType(client);
    const ledgerLiabilitiesTzs = Object.entries(totals)
      .filter(([t]) => t !== 'master')
      .reduce((s, [, v]) => s + v, 0);

    return NextResponse.json({
      success: true,
      owner,
      memberName: label || undefined,
      amountTzs,
      balanceBeforeTzs,
      balanceAfterTzs,
      ledgerLiabilitiesTzs,
      note: 'Ledger debited and withdrawal recorded. Re-check the reconcile drift — it should have closed by this amount.',
    });
  } catch (error) {
    if (inTx) await client.query('ROLLBACK').catch(() => {});
    if (error instanceof LedgerError) {
      const msg = error.code === 'insufficient_balance'
        ? 'Salio la mwanachama ni dogo kuliko kiasi kilichotoka — hakiki kiasi (balance is smaller than the amount; re-check)'
        : error.message;
      return NextResponse.json({ error: msg, code: error.code }, { status: 400 });
    }
    console.error('Record external withdrawal error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  } finally {
    client.release();
  }
}
