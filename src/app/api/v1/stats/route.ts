import pool from '@/lib/db';
import { handle, ok } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * GET /api/v1/stats
 * Platform-wide aggregates. Queries fan out through the pool so they run
 * concurrently rather than serialising on one connection.
 */
export const GET = handle('read', async () => {
  const one = async (sql: string): Promise<number> => {
    try {
      const r = await pool.query(sql);
      return num(r.rows[0] ? Object.values(r.rows[0])[0] : 0);
    } catch {
      return 0;
    }
  };

  const [
    groups, activeGroups, members, businesses,
    volumeTzs, heldTzs, contributionsTzs, proposals, fundedProposals,
  ] = await Promise.all([
    one(`SELECT COUNT(*) FROM groups`),
    one(`SELECT COUNT(*) FROM groups WHERE status = 'active'`),
    one(`SELECT COUNT(*) FROM members`),
    one(`SELECT COUNT(*) FROM members
          WHERE COALESCE(NULLIF(TRIM(business_name), ''), NULLIF(TRIM(business_type), '')) IS NOT NULL`),
    one(`SELECT COALESCE(SUM(amount_tzs), 0) FROM ntzs_transactions
          WHERE status IN ('completed','minted','success','successful')`),
    one(`SELECT COALESCE(SUM(balance_tzs), 0) FROM wallet_accounts WHERE owner_type = 'group'`),
    one(`SELECT COALESCE(SUM(amount), 0) FROM monthly_contributions WHERE status = 'paid'`),
    one(`SELECT COUNT(*) FROM group_proposals`),
    one(`SELECT COUNT(*) FROM group_proposals WHERE funded_at IS NOT NULL`),
  ]);

  return ok({
    groups: { total: groups, active: activeGroups },
    members: { total: members, with_business: businesses },
    money: {
      volume_processed_tzs: volumeTzs,
      held_in_groups_tzs: heldTzs,
      contributions_collected_tzs: contributionsTzs,
    },
    proposals: { total: proposals, funded: fundedProposals },
    generated_at: new Date().toISOString(),
  });
});
