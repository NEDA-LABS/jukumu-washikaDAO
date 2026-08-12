import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs } from '@/lib/ntzs';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { isDepositSuccessStatus, settleExternalTransaction } from '@/lib/wallet/ledger';
import { ensureDonationsSchema, settleDonationByNtzsId } from '@/lib/donations';
import { deliverDonationReceipts } from '@/lib/donation-receipt';

export const runtime = 'nodejs';

/**
 * GET /api/public/donate/status?reference=WD-XXXXX-XXXXX
 *
 * Whether the donor has approved the prompt yet. The certificate exists only
 * once the money has actually arrived — until then this returns pending, and
 * the page keeps waiting rather than handing out a certificate for a payment
 * nobody made.
 *
 * The reference is the certificate code, which is unguessable, so this is safe
 * to serve without a session. It returns only what the donor already knows.
 */
export async function GET(request: NextRequest) {
  const reference = (new URL(request.url).searchParams.get('reference') || '').trim();
  if (!reference) {
    return NextResponse.json({ error: 'reference is required' }, { status: 400 });
  }

  await ensureDonationsSchema();
  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const res = await client.query(
      `SELECT id, donor_name, amount_tzs, ntzs_id, status, certificate_code, created_at, settled_at,
              method, token
         FROM donations WHERE certificate_code = $1 LIMIT 1`,
      [reference]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const d = res.rows[0] as {
      donor_name: string; amount_tzs: string; ntzs_id: string | null;
      status: string; certificate_code: string; settled_at: string | null;
      method: string; token: string | null;
    };

    if (d.status === 'completed') {
      return NextResponse.json({
        status: 'completed', settled: true, failed: false,
        donorName: d.donor_name, amountTzs: Number(d.amount_tzs),
        reference: d.certificate_code, settledAt: d.settled_at,
        method: d.method, token: d.token,
      });
    }

    // A gift sent on chain has nothing to poll — it is waiting on a person to
    // match the hash against the treasury. Say so plainly rather than spinning.
    if (d.method === 'crypto') {
      return NextResponse.json({
        status: d.status,
        settled: false,
        failed: d.status === 'rejected',
        awaitingReview: d.status === 'pending_review',
        donorName: d.donor_name,
        amountTzs: Number(d.amount_tzs),
        reference: d.certificate_code,
        method: 'crypto',
        token: d.token,
      });
    }

    // Still open: ask nTZS rather than waiting on the webhook.
    let status = d.status;
    if (d.ntzs_id) {
      try {
        const remote = await ntzs.deposits.get(d.ntzs_id);
        status = remote.status;
        // The same settle step the webhook and the sweep use, rather than a
        // second copy of the rule. The old inline version only failed a
        // donation sitting at 'pending', so a bank transfer — which sits at
        // 'submitted' — could never be marked failed here.
        await settleDonationByNtzsId(client, d.ntzs_id, status, remote.txHash ?? null);
        if (isDepositSuccessStatus(status)) {
          // Mark the platform transaction settled too. Idempotent, so the
          // webhook arriving later changes nothing.
          await settleExternalTransaction(client, d.ntzs_id, status).catch(() => {});
          // The donor is on the page right now, so the receipt should already
          // be in their inbox when they go and look.
          await deliverDonationReceipts({ ntzsId: d.ntzs_id }).catch(() => {});
        }
      } catch {
        // Lookup trouble is not a failed donation — keep waiting.
      }
    }

    const after = await client.query(
      `SELECT status, settled_at FROM donations WHERE certificate_code = $1 LIMIT 1`,
      [reference]
    );
    const now = after.rows[0] as { status: string; settled_at: string | null };

    return NextResponse.json({
      status: now.status,
      settled: now.status === 'completed',
      failed: now.status === 'failed',
      donorName: d.donor_name,
      amountTzs: Number(d.amount_tzs),
      reference: d.certificate_code,
      settledAt: now.settled_at,
    });
  } catch (error) {
    console.error('[public/donate/status]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
