import pool from '@/lib/db';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { settleExternalTransaction } from '@/lib/wallet/ledger';
import { settleDonationByNtzsId } from '@/lib/donations';
import { deliverDonationReceipts } from '@/lib/donation-receipt';
import { ntzs } from '@/lib/ntzs';

/**
 * Ask nTZS the true state of everything unfinished, and act on the answers.
 *
 * One implementation, three triggers: the schedule, the admin button, and
 * ordinary traffic. They used to be separate pieces of code with separate
 * ideas about what "settled" meant, which is how a deposit-only sweep came to
 * exist alongside withdrawals that could fail after the debit and never be
 * refunded.
 *
 * Every write goes through settleExternalTransaction, so this can do nothing
 * the webhook would not have done by itself, and running it twice changes
 * nothing the second time.
 */

const SETTLED_DEPOSIT = ['minted', 'completed', 'confirmed', 'success', 'successful'];
const SETTLED_WITHDRAWAL = ['burned', 'completed', 'success', 'successful'];
const TERMINAL_FAIL = ['failed', 'rejected', 'cancelled'];

export interface ReconcileResult {
  checked: number;
  corrected: number;
  refundedTzs: number;
  creditedTzs: number;
  receiptsSent: number;
  changes: { id: number; type: string; from: string; to: string; amountTzs: number }[];
}

export async function reconcileLedger(
  opts: { limit?: number; budgetMs?: number; batch?: number } = {}
): Promise<ReconcileResult> {
  const { limit = 120, budgetMs = 40_000, batch = 8 } = opts;
  const out: ReconcileResult = {
    checked: 0, corrected: 0, refundedTzs: 0, creditedTzs: 0, receiptsSent: 0, changes: [],
  };
  if (!process.env.NTZS_API_KEY) return out;

  const deadline = Date.now() + budgetMs;
  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    // Anything that could still move: a deposit not yet credited or not yet
    // final, or a withdrawal still holding a debit or not yet final. The
    // second half is what the deposit-only sweep never looked at.
    const rows = (await client.query(
      `SELECT id, ntzs_id, type, status, posted, amount_tzs
         FROM ntzs_transactions
        WHERE ntzs_id IS NOT NULL
          AND type IN ('deposit', 'withdrawal')
          AND (
            (type = 'deposit'
              AND (posted = false OR status NOT IN ('minted','completed','confirmed','success','successful')))
            OR (type = 'withdrawal'
              AND (posted = true OR status NOT IN ('burned','completed','success','successful','failed','rejected','cancelled')))
          )
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit]
    )).rows as { id: number; ntzs_id: string; type: string; status: string; posted: boolean; amount_tzs: string }[];

    for (let i = 0; i < rows.length; i += batch) {
      if (Date.now() > deadline) break;
      const slice = rows.slice(i, i + batch);
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
        out.checked += 1;
        if (!status) continue;

        const settled = row.type === 'deposit' ? SETTLED_DEPOSIT : SETTLED_WITHDRAWAL;
        // Nothing to do only when the status agrees AND no debit is still
        // being held against a withdrawal that did not succeed.
        const nothingToDo = status === row.status
          && !(row.type === 'withdrawal' && row.posted && !settled.includes(status));
        if (nothingToDo) continue;

        await client.query('BEGIN');
        try {
          const res = await settleExternalTransaction(client, row.ntzs_id, status);
          if (row.type === 'deposit') {
            await settleDonationByNtzsId(client, row.ntzs_id, status).catch(() => {});
          }
          await client.query('COMMIT');

          out.corrected += 1;
          out.changes.push({
            id: row.id, type: row.type, from: row.status, to: status,
            amountTzs: Math.round(Number(row.amount_tzs)),
          });
          if (row.type === 'withdrawal' && row.posted && TERMINAL_FAIL.includes(status)) {
            out.refundedTzs += Math.round(Number(row.amount_tzs));
          }
          if (res.applied) out.creditedTzs += Math.round(Number(row.amount_tzs));
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          console.error('[reconcile] failed on', row.ntzs_id, e);
        }
      }
    }
  } catch (error) {
    console.error('[reconcile]', error);
  } finally {
    client.release();
  }

  const receipts = await deliverDonationReceipts().catch(() => ({ sent: 0, failed: 0 }));
  out.receiptsSent = receipts.sent;
  return out;
}
