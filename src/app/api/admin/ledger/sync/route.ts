import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { settleExternalTransaction } from '@/lib/wallet/ledger';
import { settleDonationByNtzsId } from '@/lib/donations';
import { deliverDonationReceipts } from '@/lib/donation-receipt';
import { ntzs } from '@/lib/ntzs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/admin/ledger/sync — ask nTZS about everything unfinished, and act
 * on the answers.
 *
 * This is the scheduled reconciliation, with a button on it. The schedule is
 * meant to make this unnecessary and currently does not run, and the cost of
 * that has not been theoretical: two members had 350,000 taken from their
 * balances for payouts that nTZS had already reverted, and neither was
 * refunded until someone went looking. A screen that can show the drift should
 * be able to fix it.
 *
 * Deposits and withdrawals are both checked, which the deposit-only sweep
 * never did — a withdrawal that fails after the debit is the case where doing
 * nothing costs a member real money.
 *
 * Every write goes through settleExternalTransaction, so this button cannot
 * do anything the webhook would not have done on its own: a failed withdrawal
 * is refunded exactly once, a settled deposit credited exactly once, and
 * running it twice changes nothing the second time.
 */

const LIMIT = 120;
const BATCH = 8;
const BUDGET_MS = 40_000;

async function requireAdmin(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return null;
  const res = await pool.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [auth.userId]);
  return (res.rows[0] as { role?: string } | undefined)?.role === 'admin' ? auth : null;
}

const SETTLED_DEPOSIT = ['minted', 'completed', 'confirmed', 'success', 'successful'];
const SETTLED_WITHDRAWAL = ['burned', 'completed', 'success', 'successful'];

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!process.env.NTZS_API_KEY) {
    return NextResponse.json({ error: 'nTZS is not configured' }, { status: 503 });
  }

  const deadline = Date.now() + BUDGET_MS;
  const client = await pool.connect();
  let checked = 0, corrected = 0, refundedTzs = 0, creditedTzs = 0;
  const changes: { id: number; type: string; from: string; to: string; amountTzs: number }[] = [];

  try {
    await ensureNtzsSchema(client);

    // Anything that could still move: not yet in a terminal state, or terminal
    // in a way that has not been acted on (a withdrawal still marked posted
    // after failing is precisely that).
    const rows = (await client.query(
      `SELECT id, ntzs_id, type, status, posted, amount_tzs
         FROM ntzs_transactions
        WHERE ntzs_id IS NOT NULL
          AND type IN ('deposit', 'withdrawal')
          AND (
            (type = 'deposit'    AND (posted = false OR status NOT IN ('minted','completed','confirmed','success','successful')))
            OR (type = 'withdrawal' AND (posted = true OR status NOT IN ('burned','completed','success','successful','failed','rejected','cancelled')))
          )
        ORDER BY created_at DESC
        LIMIT $1`,
      [LIMIT]
    )).rows as { id: number; ntzs_id: string; type: string; status: string; posted: boolean; amount_tzs: string }[];

    for (let i = 0; i < rows.length; i += BATCH) {
      if (Date.now() > deadline) break;
      const slice = rows.slice(i, i + BATCH);
      const results = await Promise.all(slice.map(async (row) => {
        try {
          const remote = row.type === 'deposit'
            ? await ntzs.deposits.get(row.ntzs_id)
            : await ntzs.withdrawals.get(row.ntzs_id);
          return { row, status: (remote as { status?: string }).status ?? null };
        } catch {
          return { row, status: null };
        }
      }));

      for (const { row, status } of results) {
        checked += 1;
        if (!status) continue;

        const settledSet = row.type === 'deposit' ? SETTLED_DEPOSIT : SETTLED_WITHDRAWAL;
        const alreadyRight = status === row.status
          && !(row.type === 'withdrawal' && row.posted && !settledSet.includes(status));
        if (alreadyRight) continue;

        await client.query('BEGIN');
        try {
          const res = await settleExternalTransaction(client, row.ntzs_id, status);
          // A donation shares the deposit but has no ledger owner, so it needs
          // its own step — the same one the webhook makes.
          if (row.type === 'deposit') {
            await settleDonationByNtzsId(client, row.ntzs_id, status).catch(() => {});
          }
          await client.query('COMMIT');

          corrected += 1;
          changes.push({
            id: row.id, type: row.type, from: row.status, to: status,
            amountTzs: Math.round(Number(row.amount_tzs)),
          });
          if (row.type === 'withdrawal' && !settledSet.includes(status) && row.posted) {
            refundedTzs += Math.round(Number(row.amount_tzs));
          }
          if (res.applied) creditedTzs += Math.round(Number(row.amount_tzs));
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          console.error('[ledger/sync] failed on', row.ntzs_id, e);
        }
      }
    }
  } catch (error) {
    console.error('[ledger/sync]', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  } finally {
    client.release();
  }

  // A donation settled above is owed its receipt.
  const receipts = await deliverDonationReceipts().catch(() => ({ sent: 0, failed: 0 }));

  return NextResponse.json({
    checked, corrected, refundedTzs, creditedTzs,
    receiptsSent: receipts.sent,
    changes: changes.slice(0, 20),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
