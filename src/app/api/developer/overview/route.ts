import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { getPartner } from '@/lib/api/partners';
import { partnerLiabilities, attributeFloat } from '@/lib/wallet/partner-treasury';
import { ntzs } from '@/lib/ntzs';

export const dynamic = 'force-dynamic';

async function scalar(sql: string, params: unknown[] = []): Promise<number> {
  try {
    const res = await pool.query(sql, params);
    const n = Number(res.rows[0] ? Object.values(res.rows[0])[0] : 0);
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    // Never let one aggregate blank the whole panel, but do not hide it either:
    // a silent zero here would look exactly like a scoping bug.
    console.error('[developer/overview] aggregate failed', e);
    return 0;
  }
}

async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const res = await pool.query(sql, params);
    return res.rows as T[];
  } catch (e) {
    console.error('[developer/overview] query failed', e);
    return [];
  }
}

/**
 * GET /api/developer/overview
 *
 * The partner's own numbers — the dashboard equivalent of what their key
 * returns from /api/v1, and scoped identically. A partner sees the groups and
 * members it created and nothing else; only an internal first-party partner
 * sees the whole platform.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const partner = await getPartner(auth.userId);
  if (!partner) return NextResponse.json({ error: 'Register as a partner first.' }, { status: 403 });

  // Same tenant rule as lib/api/scope.ts. First-party keys bind no parameters
  // at all — Postgres rejects a statement supplying an argument it never uses.
  const fp = partner.is_first_party;
  const P: unknown[] = fp ? [] : [partner.id];
  const G = fp ? 'TRUE' : 'g.partner_id = $1';
  const M = fp ? 'TRUE' : 'm.partner_id = $1';
  const OWNS_G = (col: string) => fp ? 'TRUE' : `EXISTS (SELECT 1 FROM groups g WHERE g.id = ${col} AND ${G})`;
  const TX = fp
    ? 'TRUE'
    : `(EXISTS (SELECT 1 FROM groups g  WHERE g.id IN (t.from_group_id, t.to_group_id)   AND g.partner_id = $1)
        OR EXISTS (SELECT 1 FROM members m WHERE m.id IN (t.from_member_id, t.to_member_id) AND m.partner_id = $1))`;

  const [
    members, membersWithBusiness, membersActive,
    groups, groupsActive, groupMemberships,
    volume, heldGroups, heldMembers,
    contributionsPaid, contributionsCount,
    disbursed, deposits, withdrawals,
    proposals, proposalsOpen, proposalsFunded, votes,
    tx24h, tx7d, tx30d,
  ] = await Promise.all([
    scalar(`SELECT COUNT(*) FROM members m WHERE ${M}`, P),
    scalar(`SELECT COUNT(*) FROM members m
             WHERE COALESCE(NULLIF(TRIM(m.business_name),''), NULLIF(TRIM(m.business_type),'')) IS NOT NULL
               AND ${M}`, P),
    scalar(`SELECT COUNT(*) FROM members m WHERE m.status = 'active' AND ${M}`, P),
    scalar(`SELECT COUNT(*) FROM groups g WHERE ${G}`, P),
    scalar(`SELECT COUNT(*) FROM groups g WHERE g.status = 'active' AND ${G}`, P),
    scalar(`SELECT COUNT(*) FROM group_members gm
             WHERE gm.status = 'active' AND ${OWNS_G('gm.group_id')}`, P),
    scalar(`SELECT COALESCE(SUM(t.amount_tzs),0) FROM ntzs_transactions t
             WHERE t.status IN ('completed','minted','success','successful') AND ${TX}`, P),
    scalar(`SELECT COALESCE(SUM(wa.balance_tzs),0) FROM wallet_accounts wa
             WHERE wa.owner_type = 'group' AND ${OWNS_G('wa.owner_id')}`, P),
    scalar(`SELECT COALESCE(SUM(wa.balance_tzs),0) FROM wallet_accounts wa
             WHERE wa.owner_type = 'member'
               AND ${fp ? 'TRUE' : 'EXISTS (SELECT 1 FROM members m WHERE m.id = wa.owner_id AND m.partner_id = $1)'}`, P),
    scalar(`SELECT COALESCE(SUM(mc.amount),0) FROM monthly_contributions mc
             WHERE mc.status = 'paid' AND ${OWNS_G('mc.group_id')}`, P),
    scalar(`SELECT COUNT(*) FROM monthly_contributions mc
             WHERE mc.status = 'paid' AND ${OWNS_G('mc.group_id')}`, P),
    scalar(`SELECT COALESCE(SUM(t.amount_tzs),0) FROM ntzs_transactions t
             WHERE t.purpose = 'disbursement' AND ${TX}`, P),
    scalar(`SELECT COALESCE(SUM(t.amount_tzs),0) FROM ntzs_transactions t
             WHERE t.type = 'deposit' AND t.posted = true AND ${TX}`, P),
    scalar(`SELECT COALESCE(SUM(t.amount_tzs),0) FROM ntzs_transactions t
             WHERE t.type = 'withdrawal' AND t.posted = true AND ${TX}`, P),
    scalar(`SELECT COUNT(*) FROM group_proposals gp WHERE ${OWNS_G('gp.group_id')}`, P),
    scalar(`SELECT COUNT(*) FROM group_proposals gp
             WHERE gp.status = 'open' AND ${OWNS_G('gp.group_id')}`, P),
    scalar(`SELECT COUNT(*) FROM group_proposals gp
             WHERE gp.funded_at IS NOT NULL AND ${OWNS_G('gp.group_id')}`, P),
    scalar(`SELECT COUNT(*) FROM group_proposal_votes v
             WHERE EXISTS (SELECT 1 FROM group_proposals gp
                            WHERE gp.id = v.proposal_id AND ${OWNS_G('gp.group_id')})`, P),
    scalar(`SELECT COUNT(*) FROM ntzs_transactions t
             WHERE t.created_at > NOW() - INTERVAL '24 hours' AND ${TX}`, P),
    scalar(`SELECT COUNT(*) FROM ntzs_transactions t
             WHERE t.created_at > NOW() - INTERVAL '7 days' AND ${TX}`, P),
    scalar(`SELECT COUNT(*) FROM ntzs_transactions t
             WHERE t.created_at > NOW() - INTERVAL '30 days' AND ${TX}`, P),
  ]);

  const [topGroups, recent, dailyVolume] = await Promise.all([
    rows(`SELECT g.id, g.name, g.status,
                 COALESCE(w.balance_tzs,0)::bigint AS balance_tzs,
                 (SELECT COUNT(*)::int FROM group_members gm
                   WHERE gm.group_id = g.id AND gm.status='active') AS member_count
            FROM groups g
            LEFT JOIN wallet_accounts w ON w.owner_type='group' AND w.owner_id = g.id
           WHERE ${G}
           ORDER BY COALESCE(w.balance_tzs,0) DESC, g.id DESC LIMIT 6`, P),
    rows(`SELECT t.id, t.type, t.purpose, t.status, t.amount_tzs, t.created_at,
                 fm.full_name AS from_member, tm.full_name AS to_member,
                 fg.name AS from_group, tg.name AS to_group
            FROM ntzs_transactions t
            LEFT JOIN members fm ON fm.id = t.from_member_id
            LEFT JOIN members tm ON tm.id = t.to_member_id
            LEFT JOIN groups  fg ON fg.id = t.from_group_id
            LEFT JOIN groups  tg ON tg.id = t.to_group_id
           WHERE ${TX}
           ORDER BY t.created_at DESC LIMIT 8`, P),
    rows(`SELECT to_char(d.day,'YYYY-MM-DD') AS day,
                 COALESCE(SUM(t.amount_tzs),0)::bigint AS volume_tzs,
                 COUNT(t.id)::int AS tx_count
            FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') AS d(day)
            LEFT JOIN ntzs_transactions t
              ON t.created_at::date = d.day AND ${TX}
           GROUP BY d.day ORDER BY d.day`, P),
  ]);

  // This tenant's slice of the shared treasury.
  const client = await pool.connect();
  let treasury;
  try {
    const all = await partnerLiabilities(client);
    const masterRow = await client.query(
      `SELECT ntzs_user_id FROM wallet_accounts WHERE owner_type='master' AND owner_id=0 LIMIT 1`,
    );
    const masterUserId =
      (masterRow.rows[0] as { ntzs_user_id: string | null } | undefined)?.ntzs_user_id ?? null;

    let onChain: number | null = null;
    if (masterUserId && process.env.NTZS_API_KEY) {
      try { onChain = (await ntzs.users.getBalance(masterUserId)).balanceTzs ?? 0; } catch { onChain = null; }
    }

    const attributed = attributeFloat(all, onChain);
    const mine = attributed.partners.find((r) => r.partnerId === (fp ? null : partner.id));
    treasury = {
      liabilities_tzs: mine?.liabilitiesTzs ?? 0,
      deposited_in_tzs: mine?.depositedInTzs ?? 0,
      withdrawn_out_tzs: mine?.withdrawnOutTzs ?? 0,
      net_contributed_tzs: mine?.netContributedTzs ?? 0,
      attributed_float_tzs: mine?.attributedFloatTzs ?? null,
      shortfall_tzs: mine?.shortfallTzs ?? null,
      coverage_ratio: attributed.coverageRatio,
      fully_backed: attributed.fullyBacked,
    };
  } finally {
    client.release();
  }

  return NextResponse.json({
    partner: { id: partner.id, org_name: partner.org_name, first_party: fp },
    people: {
      members, members_active: membersActive,
      members_with_business: membersWithBusiness,
    },
    groups: {
      total: groups, active: groupsActive, memberships: groupMemberships,
      avg_members: groups > 0 ? Math.round((groupMemberships / groups) * 10) / 10 : 0,
    },
    money: {
      volume_processed_tzs: volume,
      held_in_groups_tzs: heldGroups,
      held_by_members_tzs: heldMembers,
      contributions_collected_tzs: contributionsPaid,
      contributions_count: contributionsCount,
      disbursed_tzs: disbursed,
      deposits_tzs: deposits,
      withdrawals_tzs: withdrawals,
    },
    treasury,
    governance: {
      proposals, proposals_open: proposalsOpen,
      proposals_funded: proposalsFunded, votes_cast: votes,
    },
    activity: { tx_24h: tx24h, tx_7d: tx7d, tx_30d: tx30d },
    top_groups: topGroups,
    recent_transactions: recent,
    daily_volume: dailyVolume,
    generated_at: new Date().toISOString(),
  });
}
