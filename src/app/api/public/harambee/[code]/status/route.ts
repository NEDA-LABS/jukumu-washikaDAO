import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs } from '@/lib/ntzs';
import { isDepositSuccessStatus, settleExternalTransaction } from '@/lib/wallet/ledger';
import { ensureHarambeeSchema, settleHarambeeByNtzsId } from '@/lib/harambee';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { deliverHarambeeReceipts } from '@/lib/harambee-receipt';

export const runtime = 'nodejs';

/**
 * GET /api/public/harambee/<code>/status?reference=HC-…
 *
 * Whether a contribution has landed yet. The reference is unguessable and
 * returns only what the contributor already knows about their own payment.
 *
 * It asks nTZS rather than waiting for the webhook, and settles through the
 * shared path — so a contributor watching the screen gets an answer at the
 * same moment the ledger does.
 */
export async function GET(request: NextRequest) {
  const reference = (new URL(request.url).searchParams.get('reference') || '').trim();
  if (!reference) {
    return NextResponse.json({ error: 'reference is required' }, { status: 400 });
  }

  await ensureHarambeeSchema();
  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const res = await client.query(
      `SELECT id, harambee_id, amount_tzs, ntzs_id, status, contributor_name, method
         FROM harambee_contributions WHERE reference = $1 LIMIT 1`,
      [reference]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const c = res.rows[0] as {
      amount_tzs: string; ntzs_id: string | null; status: string;
      contributor_name: string; method: string;
    };

    if (c.status !== 'settled' && c.status !== 'failed' && c.ntzs_id) {
      try {
        const remote = await ntzs.deposits.get(c.ntzs_id);
        await settleHarambeeByNtzsId(client, c.ntzs_id, remote.status);
        if (isDepositSuccessStatus(remote.status)) {
          await settleExternalTransaction(client, c.ntzs_id, remote.status).catch(() => {});
          // They are on the page now; the receipt should already be waiting.
          await deliverHarambeeReceipts({ ntzsId: c.ntzs_id }).catch(() => {});
        }
      } catch {
        // A lookup that fails is not a failed payment — keep waiting.
      }
    }

    const after = await client.query(
      `SELECT status, settled_at FROM harambee_contributions WHERE reference = $1 LIMIT 1`,
      [reference]
    );
    const now = after.rows[0] as { status: string; settled_at: string | null };

    return NextResponse.json({
      status: now.status,
      settled: now.status === 'settled',
      failed: now.status === 'failed',
      amountTzs: Number(c.amount_tzs),
      contributorName: c.contributor_name,
      method: c.method,
      reference,
      settledAt: now.settled_at,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[harambee/status]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
