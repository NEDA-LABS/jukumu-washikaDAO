import pool from '@/lib/db';
import { handle, ok } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * GET /api/v1/stats
 * Aggregates over the caller's own groups and members — not the platform.
 * Queries fan out through the pool so they run concurrently rather than
 * serialising on one connection.
 */
export const GET = handle('read', async (_req, { scope }) => {
  const one = async (sql: string, params: unknown[] = []): Promise<number> => {
    try {
      const r = await pool.query(sql, params);
      return num(r.rows[0] ? Object.values(r.rows[0])[0] : 0);
    } catch (e) {
      // Degrade to 0 rather than failing the whole payload, but say so — a
      // silent zero here once hid a genuine scoping bug.
      console.error('[api/v1/stats] aggregate failed', e);
      return 0;
    }
  };

  // Every aggregate is bounded by the tenant. A first-party key drops the
  // predicate to TRUE, and must then bind no parameters at all: Postgres
  // rejects a statement that supplies a parameter it never references.
  const p = scope.firstParty ? [] : [scope.partnerId];
  const g = scope.firstParty ? 'TRUE' : 'g.partner_id = $1';
  const m = scope.firstParty ? 'TRUE' : 'm.partner_id = $1';
  const mine = scope.firstParty
    ? 'TRUE'
    : `(EXISTS (SELECT 1 FROM groups g WHERE g.id IN (t.from_group_id, t.to_group_id) AND g.partner_id = $1)
        OR EXISTS (SELECT 1 FROM members m WHERE m.id IN (t.from_member_id, t.to_member_id) AND m.partner_id = $1))`;

  const [
    groups, activeGroups, members, businesses,
    volumeTzs, heldTzs, contributionsTzs, proposals, fundedProposals,
  ] = await Promise.all([
    one(`SELECT COUNT(*) FROM groups g WHERE ${g}`, p),
    one(`SELECT COUNT(*) FROM groups g WHERE g.status = 'active' AND ${g}`, p),
    one(`SELECT COUNT(*) FROM members m WHERE ${m}`, p),
    one(`SELECT COUNT(*) FROM members m
          WHERE COALESCE(NULLIF(TRIM(m.business_name), ''), NULLIF(TRIM(m.business_type), '')) IS NOT NULL
            AND ${m}`, p),
    one(`SELECT COALESCE(SUM(t.amount_tzs), 0) FROM ntzs_transactions t
          WHERE t.status IN ('completed','minted','success','successful') AND ${mine}`, p),
    one(`SELECT COALESCE(SUM(wa.balance_tzs), 0) FROM wallet_accounts wa
          WHERE wa.owner_type = 'group'
            AND EXISTS (SELECT 1 FROM groups g WHERE g.id = wa.owner_id AND ${g})`, p),
    one(`SELECT COALESCE(SUM(mc.amount), 0) FROM monthly_contributions mc
          WHERE mc.status = 'paid'
            AND EXISTS (SELECT 1 FROM groups g WHERE g.id = mc.group_id AND ${g})`, p),
    one(`SELECT COUNT(*) FROM group_proposals gp
          WHERE EXISTS (SELECT 1 FROM groups g WHERE g.id = gp.group_id AND ${g})`, p),
    one(`SELECT COUNT(*) FROM group_proposals gp
          WHERE gp.funded_at IS NOT NULL
            AND EXISTS (SELECT 1 FROM groups g WHERE g.id = gp.group_id AND ${g})`, p),
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
