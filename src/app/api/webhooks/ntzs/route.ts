import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { settleExternalTransaction } from '@/lib/wallet/ledger';
import { ensureDonationsSchema, settleDonationByNtzsId } from '@/lib/donations';

/**
 * nTZS webhook handler. Settles deposits/withdrawals against the ledger:
 * a confirmed deposit credits the recipient's balance, a failed withdrawal
 * refunds it — both exactly once (idempotent under re-delivery).
 *
 * Set the webhook URL in the nTZS partner dashboard:
 *   https://yourdomain.com/api/webhooks/ntzs
 */
const STATUS_BY_EVENT: Record<string, string> = {
  'deposit.completed': 'minted',
  'deposit.minted': 'minted',
  'deposit.failed': 'failed',
  'transfer.completed': 'completed',
  'transfer.failed': 'failed',
  'withdrawal.completed': 'completed',
  'withdrawal.failed': 'failed',
};

export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const event = await request.json();
    console.log('nTZS webhook received:', event.type);

    await ensureNtzsSchema(client);

    const resourceId = event.id || event.resourceId;
    const txHash = event.txHash || event.tx_hash;
    const finalStatus = STATUS_BY_EVENT[event.type];

    if (!finalStatus || !resourceId) {
      console.log('Unknown/ignored nTZS webhook event type:', event.type);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    await ensureDonationsSchema();

    await client.query('BEGIN');
    await settleExternalTransaction(client, resourceId, finalStatus, txHash);
    // A donation is not held on anyone's behalf, so it has no ledger owner and
    // settleExternalTransaction has nothing to credit for it. Its record still
    // has to move — a bank donor is long gone from the page by the time this
    // fires, and the webhook is the only thing left that knows the money came.
    await settleDonationByNtzsId(client, resourceId, finalStatus, txHash);
    await client.query('COMMIT');

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('nTZS webhook error:', error);
    // Always 200 so the provider doesn't hammer retries on a processing bug.
    return NextResponse.json({ received: true, error: 'processing_error' }, { status: 200 });
  } finally {
    client.release();
  }
}
