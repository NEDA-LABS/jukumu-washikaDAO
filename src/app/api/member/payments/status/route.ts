import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getPaymentStatus } from '@/lib/snippe';
import pool from '@/lib/db';
import { ensureSnippeSchema, creditSnippePaymentToLedger } from '@/lib/snippe-db';
import { ensureNtzsSchema } from '@/lib/ntzs-db';

/**
 * Poll a Snippe payment's status. This is the webhook's backstop, so it must
 * do everything the webhook does on completion — including CREDITING the
 * ledger. Previously it only updated the status row and returned, which left
 * every payment "completed" but never reflected on the balance whenever the
 * webhook didn't arrive. Crediting is idempotent (ledger_posted guard).
 */
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

  const client = await pool.connect();
  try {
    await ensureSnippeSchema(client);
    await ensureNtzsSchema(client);

    // Effective status: trust a terminal DB status, otherwise ask Snippe.
    const dbRes = await client.query(
      `SELECT status, amount_tzs, payment_type, failure_reason, ledger_posted
       FROM snippe_payments WHERE reference = $1 LIMIT 1`,
      [reference]
    );
    const dbRow = dbRes.rows[0] as
      | { status: string; amount_tzs: number; payment_type: string; failure_reason: string | null; ledger_posted: boolean }
      | undefined;

    let status: string;
    let amount = dbRow?.amount_tzs ?? 0;
    let payment_type = dbRow?.payment_type ?? 'contribution';
    let failure_reason = dbRow?.failure_reason ?? null;
    let source: 'db' | 'snippe';

    if (dbRow && (dbRow.status === 'completed' || dbRow.status === 'failed')) {
      status = dbRow.status;
      source = 'db';
    } else {
      // Ask Snippe directly, then persist a terminal result.
      const snippeRes = await getPaymentStatus(reference);
      status = snippeRes.data.status;
      amount = snippeRes.data.amount?.value ?? amount;
      source = 'snippe';

      if (status === 'completed' || status === 'failed') {
        // Mark terminal — set event_type too so downstream (backfill/queries)
        // that key on it stay consistent with the poll.
        // Parameters may not be reused in a second type context (e.g. status
        // assignment + string comparison) — the DB rejects the statement with
        // "inconsistent types deduced". Completion is passed as its own boolean.
        const isCompleted = status === 'completed';
        const upd = await client.query(
          `UPDATE snippe_payments
             SET status = $1,
                 event_type = $2,
                 completed_at = CASE WHEN $4::boolean THEN NOW() ELSE completed_at END
           WHERE reference = $3 AND status NOT IN ('completed', 'failed')
           RETURNING id`,
          [status, `payment.${status}`, reference, isCompleted]
        );
        if (upd.rowCount === 0 && !dbRow) {
          await client.query(
            `INSERT INTO snippe_payments (reference, event_type, status, amount_tzs, payment_type, completed_at)
             VALUES ($1, $2, $3, $4, 'contribution', CASE WHEN $5::boolean THEN NOW() ELSE NULL END)
             ON CONFLICT (reference) DO NOTHING`,
            [reference, `payment.${status}`, status, amount, isCompleted]
          );
        }
      }
    }

    // On completion, credit the ledger exactly once — the balance moves here
    // even if the webhook never arrived. No-op if already credited.
    let credited = 0;
    if (status === 'completed') {
      await client.query('BEGIN');
      try {
        credited = await creditSnippePaymentToLedger(client, reference);
        await client.query('COMMIT');
        if (credited > 0) console.log(`Snippe ${reference}: credited ${credited} TZS via status poll`);
      } catch (creditErr) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Status poll ledger credit failed for', reference, creditErr);
      }
    }

    return NextResponse.json({
      success: true,
      source,
      reference,
      status,
      amount,
      payment_type,
      failure_reason,
      credited,
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to check payment status',
    }, { status: 500 });
  } finally {
    client.release();
  }
}
