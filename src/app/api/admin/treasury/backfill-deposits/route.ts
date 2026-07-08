import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { ensureSnippeSchema, creditSnippePaymentToLedger } from '@/lib/snippe-db';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Backfill Snippe payments that completed before the webhook credited the
 * custodial ledger. Contributions / group top-ups fund the group treasury; a
 * member-only payment funds the member. Purely a DB operation (no external
 * calls), idempotent via `ledger_posted`.
 *
 *   GET  → how many completed payments are still uncredited, and their total.
 *   POST → credit each to the ledger (exactly once) and record the deposit.
 */
async function pending(client: import('pg').PoolClient) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_tzs), 0)::bigint AS total
     FROM snippe_payments
     WHERE event_type = 'payment.completed' AND ledger_posted = false
       AND (group_id IS NOT NULL OR member_id IS NOT NULL)`
  );
  const row = r.rows[0] as { n: number; total: string };
  return { count: row.n, totalTzs: Number(row.total) };
}

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    await ensureSnippeSchema(client);
    await ensureNtzsSchema(client);
    const { count, totalTzs } = await pending(client);
    return NextResponse.json({
      success: true,
      mode: 'dry-run',
      uncreditedPayments: count,
      totalTzs,
      note: 'These completed Snippe payments were never credited to the ledger. POST to credit them.',
    });
  } catch (error) {
    console.error('Backfill deposits (dry-run) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    await ensureSnippeSchema(client);
    await ensureNtzsSchema(client);

    const refsRes = await client.query(
      `SELECT reference FROM snippe_payments
       WHERE event_type = 'payment.completed' AND ledger_posted = false
         AND (group_id IS NOT NULL OR member_id IS NOT NULL)
       ORDER BY created_at ASC`
    );

    let credited = 0, totalTzs = 0, failed = 0;
    for (const row of refsRes.rows as { reference: string }[]) {
      await client.query('BEGIN');
      try {
        const amount = await creditSnippePaymentToLedger(client, row.reference);
        await client.query('COMMIT');
        if (amount > 0) { credited++; totalTzs += amount; }
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        failed++;
        console.error('Backfill credit failed for', row.reference, e);
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'applied',
      credited,
      totalTzs,
      failed,
      note: 'Credited previously-uncredited Snippe payments to the ledger. Refresh the app; group balances now reflect them.',
    });
  } catch (error) {
    console.error('Backfill deposits (apply) error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
