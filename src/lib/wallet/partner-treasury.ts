import type { PoolClient } from 'pg';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { ensurePartnersSchema } from '@/lib/api/partners';

/**
 * Per-tenant treasury accounting.
 *
 * Partner data is isolated, but partner *money* is not: every deposit mints
 * into the one master wallet and every withdrawal burns from it, so all
 * tenants share a single on-chain pool. That makes two questions different:
 *
 *   "What does this partner owe its users?"  — exact. It is the ledger.
 *   "What backs it on-chain?"                — not exact. The pool is shared.
 *
 * Liabilities below are therefore real figures. Attributed float is an
 * accounting *convention*: the pool's coverage ratio applied pro-rata, which
 * is how an omnibus account is normally apportioned. It says how a shortfall
 * would land if it were shared proportionally — not that anyone's shillings
 * sit in a labelled box, because they do not.
 */

/** `null` partnerId means WashikaDAU's own first-party data. */
export interface PartnerLiability {
  partnerId: number | null;
  orgName: string;
  memberBalanceTzs: number;
  groupBalanceTzs: number;
  /** What this tenant owes its users. The sum of its ledger balances. */
  liabilitiesTzs: number;
  memberAccounts: number;
  groupAccounts: number;
  /** Lifetime settled deposits into this tenant's accounts. */
  depositedInTzs: number;
  /** Lifetime settled withdrawals out, including fees charged. */
  withdrawnOutTzs: number;
  /** Float this tenant has contributed to the shared pool, net of what it drew. */
  netContributedTzs: number;
}

export interface AttributedPartner extends PartnerLiability {
  /** Pro-rata share of the on-chain pool. Null when the balance is unknown. */
  attributedFloatTzs: number | null;
  /** Liabilities not covered by that share. Null when unknown, 0 when covered. */
  shortfallTzs: number | null;
}

export interface PartnerTreasury {
  masterOnChainTzs: number | null;
  totalLiabilitiesTzs: number;
  /** On-chain float ÷ total liabilities. 1 or more means fully backed. */
  coverageRatio: number | null;
  fullyBacked: boolean | null;
  partners: AttributedPartner[];
  onChainError: string | null;
}

/**
 * Ledger balances grouped by owning tenant.
 *
 * Wallet accounts carry no tenant of their own — they inherit it through the
 * member or group they belong to, which is exactly why the API's isolation
 * covers wallets for free. Investor and fee accounts are always first-party.
 * Master is excluded: it is the backing, not a liability.
 */
const LIABILITIES_SQL = `
  WITH acct AS (
    SELECT m.partner_id, 'member' AS kind, wa.balance_tzs
      FROM wallet_accounts wa
      JOIN members m ON m.id = wa.owner_id
     WHERE wa.owner_type = 'member'
    UNION ALL
    SELECT g.partner_id, 'group', wa.balance_tzs
      FROM wallet_accounts wa
      JOIN groups g ON g.id = wa.owner_id
     WHERE wa.owner_type = 'group'
    UNION ALL
    SELECT NULL::int, 'other', wa.balance_tzs
      FROM wallet_accounts wa
     WHERE wa.owner_type NOT IN ('member', 'group', 'master')
  )
  SELECT partner_id,
         COALESCE(SUM(balance_tzs) FILTER (WHERE kind = 'member'), 0)::bigint AS member_balance_tzs,
         COALESCE(SUM(balance_tzs) FILTER (WHERE kind = 'group'), 0)::bigint  AS group_balance_tzs,
         COALESCE(SUM(balance_tzs), 0)::bigint                                AS liabilities_tzs,
         COUNT(*) FILTER (WHERE kind = 'member')::int                         AS member_accounts,
         COUNT(*) FILTER (WHERE kind = 'group')::int                          AS group_accounts
    FROM acct
   GROUP BY partner_id
`;

/**
 * Settled external flows per tenant: what each brought into the shared pool
 * and what it took out. Only `posted` rows count — an unsettled deposit has
 * not actually landed.
 */
const FLOWS_SQL = `
  WITH flow AS (
    SELECT COALESCE(m.partner_id, g.partner_id) AS partner_id,
           t.amount_tzs AS amt, 'in' AS dir
      FROM ntzs_transactions t
      LEFT JOIN members m ON m.id = t.to_member_id
      LEFT JOIN groups  g ON g.id = t.to_group_id
     WHERE t.type = 'deposit' AND t.posted = true
    UNION ALL
    SELECT COALESCE(m.partner_id, g.partner_id),
           t.amount_tzs + COALESCE(t.fee_tzs, 0), 'out'
      FROM ntzs_transactions t
      LEFT JOIN members m ON m.id = t.from_member_id
      LEFT JOIN groups  g ON g.id = t.from_group_id
     WHERE t.type = 'withdrawal' AND t.posted = true
  )
  SELECT partner_id,
         COALESCE(SUM(amt) FILTER (WHERE dir = 'in'), 0)::bigint  AS deposited_in_tzs,
         COALESCE(SUM(amt) FILTER (WHERE dir = 'out'), 0)::bigint AS withdrawn_out_tzs
    FROM flow
   GROUP BY partner_id
`;

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/** One row of LIABILITIES_SQL. Sums come back as strings (bigint). */
interface BalanceRow {
  partner_id: number | null;
  member_balance_tzs: string;
  group_balance_tzs: string;
  liabilities_tzs: string;
  member_accounts: number;
  group_accounts: number;
}

/** Liabilities and flows per tenant, including first-party, biggest first. */
export async function partnerLiabilities(client: PoolClient): Promise<PartnerLiability[]> {
  await ensureNtzsSchema(client);
  await ensurePartnersSchema();

  const [balances, flows, names] = await Promise.all([
    client.query(LIABILITIES_SQL),
    client.query(FLOWS_SQL),
    client.query(`SELECT id, org_name FROM api_partners ORDER BY id`),
  ]);

  const nameById = new Map<number, string>(
    (names.rows as { id: number; org_name: string }[]).map((r) => [r.id, r.org_name]),
  );
  const flowById = new Map<number | null, { in: number; out: number }>(
    (flows.rows as { partner_id: number | null; deposited_in_tzs: string; withdrawn_out_tzs: string }[])
      .map((r) => [r.partner_id, { in: n(r.deposited_in_tzs), out: n(r.withdrawn_out_tzs) }]),
  );

  // Every registered partner appears even with an empty tenant, so a newly
  // approved integrator is visible before it has moved a shilling.
  const seen = new Set<number | null>();
  const rows: PartnerLiability[] = [];

  const push = (partnerId: number | null, b: Partial<BalanceRow> = {}) => {
    seen.add(partnerId);
    const flow = flowById.get(partnerId) ?? { in: 0, out: 0 };
    rows.push({
      partnerId,
      orgName: partnerId === null
        ? 'WashikaDAU (first-party)'
        : nameById.get(partnerId) ?? `Partner #${partnerId}`,
      memberBalanceTzs: n(b.member_balance_tzs),
      groupBalanceTzs: n(b.group_balance_tzs),
      liabilitiesTzs: n(b.liabilities_tzs),
      memberAccounts: n(b.member_accounts),
      groupAccounts: n(b.group_accounts),
      depositedInTzs: flow.in,
      withdrawnOutTzs: flow.out,
      netContributedTzs: flow.in - flow.out,
    });
  };

  for (const b of balances.rows as BalanceRow[]) push(b.partner_id, b);
  if (!seen.has(null)) push(null);
  for (const [id] of nameById) if (!seen.has(id)) push(id);

  return rows.sort((a, b) => b.liabilitiesTzs - a.liabilitiesTzs);
}

/**
 * Apply the shared pool's coverage ratio to each tenant pro-rata.
 *
 * `masterOnChainTzs` of null means the balance could not be read; every
 * attribution is then null rather than silently reported as zero, because
 * "unknown backing" and "no backing" must not look the same.
 */
export function attributeFloat(
  liabilities: PartnerLiability[],
  masterOnChainTzs: number | null,
  onChainError: string | null = null,
): PartnerTreasury {
  const total = liabilities.reduce((s, r) => s + r.liabilitiesTzs, 0);

  // With nothing owed, a pool of any size covers it; treat that as fully backed
  // rather than dividing by zero.
  const coverage = masterOnChainTzs === null
    ? null
    : total === 0 ? 1 : masterOnChainTzs / total;

  const partners: AttributedPartner[] = liabilities.map((r) => {
    if (coverage === null) {
      return { ...r, attributedFloatTzs: null, shortfallTzs: null };
    }
    // Never attribute more than a tenant is actually owed: surplus float is
    // platform reserve, not someone's balance.
    const attributed = Math.round(Math.min(coverage, 1) * r.liabilitiesTzs);
    return {
      ...r,
      attributedFloatTzs: attributed,
      shortfallTzs: Math.max(0, r.liabilitiesTzs - attributed),
    };
  });

  return {
    masterOnChainTzs,
    totalLiabilitiesTzs: total,
    coverageRatio: coverage,
    fullyBacked: coverage === null ? null : coverage >= 1,
    partners,
    onChainError,
  };
}
