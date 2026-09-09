import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/admin/ledger — where the money is, and what it has been doing.
 *
 * Balances held for every group and every member, the deposits and
 * withdrawals behind them, and how those attempts ended.
 *
 * Two rules run through all of it:
 *
 * A balance is what the wallet_accounts row says. It is not recomputed from
 * transactions here, because if the two ever disagree that is a fact worth
 * seeing rather than papering over — so both are reported and the difference
 * is left visible.
 *
 * Only settled money counts as moved. A pending or failed attempt is shown as
 * an attempt, in its own column, never folded into a total. Most of the value
 * of this screen is in that distinction: a rail that accepts requests and
 * never settles them looks healthy in a count of attempts and empty in a sum
 * of settlements.
 */

/**
 * Settlement means different words on the two rails, and getting this wrong
 * is not cosmetic. A deposit ends `minted` — the nTZS exists. A withdrawal
 * ends `burned` — the nTZS is destroyed and shillings went out to the phone.
 * Reading only `completed` as success made 28 withdrawals worth 3.28M look
 * like they had never gone through, which is the opposite of the truth.
 */
const SETTLED_DEPOSIT = `('minted', 'completed', 'confirmed', 'success', 'successful')`;
const SETTLED_WITHDRAWAL = `('burned', 'completed', 'success', 'successful')`;
const SETTLED = `('minted', 'burned', 'completed', 'confirmed', 'success', 'successful')`;
const FAILED = `('failed', 'rejected', 'cancelled')`;

async function requireAdmin(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return null;
  const res = await pool.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [auth.userId]);
  return (res.rows[0] as { role?: string } | undefined)?.role === 'admin' ? auth : null;
}

/** Per-owner movement, settled and unsettled kept apart. */
const flows = (col: 'member_id' | 'group_id') => `
  COALESCE((SELECT SUM(t.amount_tzs) FROM ntzs_transactions t
     WHERE t.to_${col} = o.id AND t.type = 'deposit' AND t.status IN ${SETTLED_DEPOSIT}), 0)::bigint AS deposited_tzs,
  (SELECT count(*) FROM ntzs_transactions t
     WHERE t.to_${col} = o.id AND t.type = 'deposit' AND t.status IN ${SETTLED_DEPOSIT})::int AS deposit_count,
  (SELECT count(*) FROM ntzs_transactions t
     WHERE t.to_${col} = o.id AND t.type = 'deposit' AND t.status IN ${FAILED})::int AS deposit_failed,
  (SELECT count(*) FROM ntzs_transactions t
     WHERE t.to_${col} = o.id AND t.type = 'deposit' AND t.status NOT IN ${SETTLED_DEPOSIT} AND t.status NOT IN ${FAILED})::int AS deposit_open,
  COALESCE((SELECT SUM(t.amount_tzs) FROM ntzs_transactions t
     WHERE t.from_${col} = o.id AND t.type = 'withdrawal' AND t.status IN ${SETTLED_WITHDRAWAL}), 0)::bigint AS withdrawn_tzs,
  (SELECT count(*) FROM ntzs_transactions t
     WHERE t.from_${col} = o.id AND t.type = 'withdrawal' AND t.status IN ${SETTLED_WITHDRAWAL})::int AS withdrawal_count,
  (SELECT count(*) FROM ntzs_transactions t
     WHERE t.from_${col} = o.id AND t.type = 'withdrawal' AND t.status IN ${FAILED})::int AS withdrawal_failed,
  (SELECT count(*) FROM ntzs_transactions t
     WHERE t.from_${col} = o.id AND t.type = 'withdrawal' AND t.status NOT IN ${SETTLED_WITHDRAWAL} AND t.status NOT IN ${FAILED})::int AS withdrawal_open
`;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const [groups, members, statuses, totals, recent] = await Promise.all([
      pool.query(`
        SELECT o.id, o.name, o.status,
               COALESCE((SELECT w.balance_tzs FROM wallet_accounts w
                          WHERE w.owner_type = 'group' AND w.owner_id = o.id), 0)::bigint AS balance_tzs,
               (SELECT count(*) FROM group_members gm
                 WHERE gm.group_id = o.id AND gm.status = 'active')::int AS member_count,
               ${flows('group_id')}
          FROM groups o
         ORDER BY balance_tzs DESC, o.name
      `),
      pool.query(`
        SELECT o.id, o.full_name AS name, o.phone, o.status,
               COALESCE((SELECT w.balance_tzs FROM wallet_accounts w
                          WHERE w.owner_type = 'member' AND w.owner_id = o.id), 0)::bigint AS balance_tzs,
               ${flows('member_id')}
          FROM members o
         ORDER BY balance_tzs DESC, o.full_name
      `),
      // Every transaction type crossed with how it ended. This is the table
      // that shows a rail failing: attempts on one line, settlements on none.
      pool.query(`
        SELECT type, status, count(*)::int AS n, COALESCE(SUM(amount_tzs), 0)::bigint AS total_tzs
          FROM ntzs_transactions
         GROUP BY type, status
         ORDER BY type, n DESC
      `),
      pool.query(`
        SELECT
          COALESCE((SELECT SUM(balance_tzs) FROM wallet_accounts WHERE owner_type = 'member'), 0)::bigint AS member_balances,
          COALESCE((SELECT SUM(balance_tzs) FROM wallet_accounts WHERE owner_type = 'group'), 0)::bigint AS group_balances,
          COALESCE((SELECT SUM(amount_tzs) FROM ntzs_transactions
                     WHERE type = 'deposit' AND status IN ${SETTLED_DEPOSIT}), 0)::bigint AS deposited_tzs,
          COALESCE((SELECT SUM(amount_tzs) FROM ntzs_transactions
                     WHERE type = 'withdrawal' AND status IN ${SETTLED_WITHDRAWAL}), 0)::bigint AS withdrawn_tzs,
          COALESCE((SELECT SUM(balance_tzs) FROM wallet_accounts
                     WHERE owner_type NOT IN ('member', 'group')), 0)::bigint AS platform_balances,
          (SELECT count(*) FROM ntzs_transactions
            WHERE status NOT IN ${SETTLED} AND status NOT IN ${FAILED})::int AS open_count
      `),
      pool.query(`
        SELECT t.id, t.type, t.status, t.amount_tzs, t.phone, t.purpose, t.created_at,
               m.full_name AS member_name, g.name AS group_name
          FROM ntzs_transactions t
          LEFT JOIN members m ON m.id = COALESCE(t.to_member_id, t.from_member_id)
          LEFT JOIN groups  g ON g.id = COALESCE(t.to_group_id, t.from_group_id)
         ORDER BY t.created_at DESC
         LIMIT 60
      `),
    ]);

    const t = totals.rows[0] as Record<string, string>;

    return NextResponse.json({
      totals: {
        memberBalances: Number(t.member_balances),
        groupBalances: Number(t.group_balances),
        platformBalances: Number(t.platform_balances),
        heldTzs: Number(t.member_balances) + Number(t.group_balances),
        depositedTzs: Number(t.deposited_tzs),
        withdrawnTzs: Number(t.withdrawn_tzs),
        openCount: Number(t.open_count),
      },
      groups: groups.rows,
      members: members.rows,
      statuses: statuses.rows,
      recent: recent.rows,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[admin/ledger]', error);
    return NextResponse.json({ error: 'Could not load balances' }, { status: 500 });
  }
}
