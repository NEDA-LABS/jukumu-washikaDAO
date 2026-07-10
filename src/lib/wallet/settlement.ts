import type { PoolClient } from 'pg';
import { ntzs } from '@/lib/ntzs';
import { settleExternalTransaction } from '@/lib/wallet/ledger';

/**
 * Self-heal a member's balance against nTZS.
 *
 * nTZS is the source of truth: a deposit only counts once it is `minted`. The
 * webhook that would tell us that may be down, so we poll on demand instead —
 * every unsettled deposit for this member is checked against nTZS and the ones
 * that landed are credited (idempotent via settleExternalTransaction's posted
 * guard). Called on balance reads so the DB balance always reflects minted
 * deposits. No-op with zero nTZS calls once everything is settled.
 *
 * Returns the number of deposits newly credited.
 */
export async function syncMemberDeposits(client: PoolClient, memberId: number): Promise<number> {
  if (!process.env.NTZS_API_KEY) return 0;

  const r = await client.query(
    `SELECT ntzs_id FROM ntzs_transactions
     WHERE type = 'deposit' AND posted = false AND ntzs_id IS NOT NULL
       AND (to_member_id = $1 OR from_member_id = $1)
     ORDER BY created_at DESC LIMIT 25`,
    [memberId]
  );
  if (r.rows.length === 0) return 0;

  let settled = 0;
  for (const row of r.rows as { ntzs_id: string }[]) {
    try {
      const status = (await ntzs.deposits.get(row.ntzs_id)).status;
      await client.query('BEGIN');
      const res = await settleExternalTransaction(client, row.ntzs_id, status);
      await client.query('COMMIT');
      if (res.applied) settled++;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('syncMemberDeposits: failed to settle', row.ntzs_id, e);
    }
  }
  return settled;
}
