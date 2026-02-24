import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getPaymentStatus } from '@/lib/snippe';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('reference');
  if (!reference) {
    return NextResponse.json({ error: 'reference is required' }, { status: 400 });
  }

  try {
    // First try DB (fastest if webhook already arrived)
    const client = await pool.connect();
    try {
      const dbRes = await client.query(
        `SELECT reference, status, amount_tzs, payment_type, failure_reason
         FROM snippe_payments WHERE reference = $1 LIMIT 1`,
        [reference]
      );
      if (dbRes.rows.length > 0) {
        const row = dbRes.rows[0] as { reference: string; status: string; amount_tzs: number; payment_type: string; failure_reason: string | null };
        if (row.status === 'completed' || row.status === 'failed') {
          return NextResponse.json({
            success: true,
            source: 'db',
            reference: row.reference,
            status: row.status,
            amount: row.amount_tzs,
            payment_type: row.payment_type,
            failure_reason: row.failure_reason,
          });
        }
      }
    } finally {
      client.release();
    }

    // Fallback: check Snippe API directly
    const snippeRes = await getPaymentStatus(reference);
    const status = snippeRes.data.status;

    // If Snippe says completed but webhook hasn't arrived yet, record it in DB
    if (status === 'completed' || status === 'failed') {
      const client2 = await pool.connect();
      try {
        await client2.query(
          `UPDATE snippe_payments SET status = $1 WHERE reference = $2 AND status NOT IN ('completed', 'failed')`,
          [status, reference]
        );
      } catch {
        // non-critical — webhook will handle it eventually
      } finally {
        client2.release();
      }
    }

    return NextResponse.json({
      success: true,
      source: 'snippe',
      reference: snippeRes.data.reference,
      status: status,
      amount: snippeRes.data.amount?.value ?? 0,
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to check payment status',
    }, { status: 500 });
  }
}
