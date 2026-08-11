import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { settleExternalTransaction, isDepositSuccessStatus } from '@/lib/wallet/ledger';
import { getActor } from '@/lib/wallet/authorize';

export const runtime = 'nodejs';

/**
 * GET /api/wallet/deposit/status?depositId=<nTZS id>
 *
 * Where a mobile-money top-up has got to. The deposit endpoint only sends the
 * STK push — the money does not exist until the person approves it on their
 * handset and nTZS calls our webhook, which can be seconds or minutes later.
 * The client polls this so it can keep saying "waiting" instead of claiming
 * success the instant the push was dispatched.
 *
 * The webhook is the normal settlement path. This also settles as a backstop,
 * for the case where the webhook is delayed or never arrives; settlement is
 * idempotent, so the two cannot double-credit.
 */
export async function GET(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const depositId = new URL(request.url).searchParams.get('depositId');
  if (!depositId) {
    return NextResponse.json({ error: 'depositId is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    // Bind the deposit to the caller. Without this, anyone could watch anyone
    // else's top-ups by guessing an id.
    const res = await client.query(
      `SELECT t.id, t.ntzs_id, t.status, t.posted, t.amount_tzs
         FROM ntzs_transactions t
         JOIN members m ON m.id = t.to_member_id
        WHERE t.ntzs_id = $1 AND m.user_id = $2
        LIMIT 1`,
      [depositId, actor.userId]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const row = res.rows[0] as { status: string; posted: boolean; amount_tzs: string };

    // Already settled — nothing to ask nTZS about.
    if (row.posted) {
      return NextResponse.json({
        status: row.status, settled: true, failed: false,
        amountTzs: Number(row.amount_tzs),
      });
    }

    // Not settled yet: ask nTZS directly rather than waiting on the webhook.
    let status = row.status;
    try {
      const remote = await ntzs.deposits.get(depositId);
      status = remote.status;
      if (status !== row.status || isDepositSuccessStatus(status)) {
        await settleExternalTransaction(client, depositId, status);
      }
    } catch (e) {
      // A lookup failure must not read as a failed deposit — the person may
      // still be about to approve it. Report what we last knew.
      if (!(e instanceof NtzsApiError)) console.error('[deposit status]', e);
    }

    const after = await client.query(
      `SELECT status, posted FROM ntzs_transactions WHERE ntzs_id = $1 LIMIT 1`,
      [depositId]
    );
    const now = after.rows[0] as { status: string; posted: boolean } | undefined;

    return NextResponse.json({
      status: now?.status ?? status,
      settled: !!now?.posted,
      failed: (now?.status ?? status) === 'failed',
      amountTzs: Number(row.amount_tzs),
    });
  } catch (error) {
    console.error('Deposit status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
