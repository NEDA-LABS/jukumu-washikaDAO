import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureNtzsSchema, updateTransactionStatus } from '@/lib/ntzs-db';

/**
 * nTZS Webhook handler
 * Receives real-time notifications for deposit, transfer, and withdrawal events.
 * Set the webhook URL in the nTZS partner dashboard:
 *   https://yourdomain.com/api/webhooks/ntzs
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const event = await request.json();

    console.log('nTZS webhook received:', event.type, event);

    await ensureNtzsSchema(client);

    const resourceId = event.id || event.resourceId;
    const txHash = event.txHash || event.tx_hash;

    switch (event.type) {
      case 'deposit.completed':
      case 'deposit.minted':
        await updateTransactionStatus(client, resourceId, 'minted', txHash);
        break;

      case 'deposit.failed':
        await updateTransactionStatus(client, resourceId, 'failed');
        break;

      case 'transfer.completed':
        await updateTransactionStatus(client, resourceId, 'completed', txHash);
        break;

      case 'transfer.failed':
        await updateTransactionStatus(client, resourceId, 'failed');
        break;

      case 'withdrawal.completed':
        await updateTransactionStatus(client, resourceId, 'completed');
        break;

      case 'withdrawal.failed':
        await updateTransactionStatus(client, resourceId, 'failed');
        break;

      default:
        console.log('Unknown nTZS webhook event type:', event.type);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('nTZS webhook error:', error);
    // Always return 200 to avoid retries for processing errors
    return NextResponse.json({ received: true, error: 'processing_error' }, { status: 200 });
  } finally {
    client.release();
  }
}
