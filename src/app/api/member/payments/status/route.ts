import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getPaymentStatus } from '@/lib/snippe';
import pool from '@/lib/db';
import { ensureSnippeSchema } from '@/lib/snippe-db';

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

    // If Snippe says completed/failed, ensure DB is up to date (upsert)
    if (status === 'completed' || status === 'failed') {
      const client2 = await pool.connect();
      try {
        await ensureSnippeSchema(client2);
        // Update existing row first
        const updateRes = await client2.query(
          `UPDATE snippe_payments SET status = $1, completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
           WHERE reference = $2 AND status NOT IN ('completed', 'failed')
           RETURNING id`,
          [status, reference]
        );
        // If no row existed to update, insert a minimal record so summary queries work
        if (updateRes.rowCount === 0) {
          const existsRes = await client2.query(
            `SELECT id FROM snippe_payments WHERE reference = $1`, [reference]
          );
          if (existsRes.rows.length === 0) {
            await client2.query(
              `INSERT INTO snippe_payments (reference, event_type, status, amount_tzs, payment_type, completed_at)
               VALUES ($1, $2, $3, $4, 'contribution', CASE WHEN $3 = 'completed' THEN NOW() ELSE NULL END)
               ON CONFLICT (reference) DO NOTHING`,
              [reference, `payment.${status}`, status, snippeRes.data.amount?.value ?? 0]
            );
          }
        }
      } catch (dbErr) {
        console.error('Status endpoint DB upsert error:', dbErr);
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
