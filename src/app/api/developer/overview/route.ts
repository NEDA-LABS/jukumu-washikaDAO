import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { getPartner } from '@/lib/api/partners';

export const dynamic = 'force-dynamic';

async function scalar(sql: string): Promise<number> {
  try {
    const res = await pool.query(sql);
    const n = Number(res.rows[0] ? Object.values(res.rows[0])[0] : 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function rows<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  try {
    const res = await pool.query(sql);
    return res.rows as T[];
  } catch {
    return [];
  }
}

/**
 * GET /api/developer/overview
 * The same figures a partner can pull from /api/v1, surfaced in the
 * dashboard so they can see the shape of the platform before writing a
 * line of code. Session-authenticated and partner-gated.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const partner = await getPartner(auth.userId);
  if (!partner) return NextResponse.json({ error: 'Register as a partner first.' }, { status: 403 });

  const [
    users, members, membersWithBusiness, membersActive,
    groups, groupsActive, groupMemberships,
    volume, heldGroups, heldMembers, heldMaster,
    contributionsPaid, contributionsCount,
    disbursed, deposits, withdrawals,
    proposals, proposalsOpen, proposalsFunded, votes,
    tx24h, tx7d, tx30d,
    investorCount, investments,
  ] = await Promise.all([
    scalar(`SELECT COUNT(*) FROM users`),
    scalar(`SELECT COUNT(*) FROM members`),
    scalar(`SELECT COUNT(*) FROM members WHERE COALESCE(NULLIF(TRIM(business_name),''), NULLIF(TRIM(business_type),'')) IS NOT NULL`),
    scalar(`SELECT COUNT(*) FROM members WHERE status = 'active'`),
    scalar(`SELECT COUNT(*) FROM groups`),
    scalar(`SELECT COUNT(*) FROM groups WHERE status = 'active'`),
    scalar(`SELECT COUNT(*) FROM group_members WHERE status = 'active'`),
    scalar(`SELECT COALESCE(SUM(amount_tzs),0) FROM ntzs_transactions WHERE status IN ('completed','minted','success','successful')`),
    scalar(`SELECT COALESCE(SUM(balance_tzs),0) FROM wallet_accounts WHERE owner_type = 'group'`),
    scalar(`SELECT COALESCE(SUM(balance_tzs),0) FROM wallet_accounts WHERE owner_type = 'member'`),
    scalar(`SELECT COALESCE(SUM(balance_tzs),0) FROM wallet_accounts WHERE owner_type = 'master'`),
    scalar(`SELECT COALESCE(SUM(amount),0) FROM monthly_contributions WHERE status = 'paid'`),
    scalar(`SELECT COUNT(*) FROM monthly_contributions WHERE status = 'paid'`),
    scalar(`SELECT COALESCE(SUM(amount_tzs),0) FROM ntzs_transactions WHERE purpose = 'disbursement'`),
    scalar(`SELECT COALESCE(SUM(amount_tzs),0) FROM ntzs_transactions WHERE type = 'deposit' AND posted = true`),
    scalar(`SELECT COALESCE(SUM(amount_tzs),0) FROM ntzs_transactions WHERE type = 'withdrawal' AND posted = true`),
    scalar(`SELECT COUNT(*) FROM group_proposals`),
    scalar(`SELECT COUNT(*) FROM group_proposals WHERE status = 'open'`),
    scalar(`SELECT COUNT(*) FROM group_proposals WHERE funded_at IS NOT NULL`),
    scalar(`SELECT COUNT(*) FROM group_proposal_votes`),
    scalar(`SELECT COUNT(*) FROM ntzs_transactions WHERE created_at > NOW() - INTERVAL '24 hours'`),
    scalar(`SELECT COUNT(*) FROM ntzs_transactions WHERE created_at > NOW() - INTERVAL '7 days'`),
    scalar(`SELECT COUNT(*) FROM ntzs_transactions WHERE created_at > NOW() - INTERVAL '30 days'`),
    scalar(`SELECT COUNT(*) FROM investor_profiles`),
    scalar(`SELECT COALESCE(SUM(amount),0) FROM investments`),
  ]);

  const [topGroups, recent, dailyVolume] = await Promise.all([
    rows(`SELECT g.id, g.name, g.status,
                 COALESCE(w.balance_tzs,0)::bigint AS balance_tzs,
                 (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id = g.id AND gm.status='active') AS member_count
            FROM groups g
            LEFT JOIN wallet_accounts w ON w.owner_type='group' AND w.owner_id = g.id
           ORDER BY COALESCE(w.balance_tzs,0) DESC, g.id DESC LIMIT 6`),
    rows(`SELECT t.id, t.type, t.purpose, t.status, t.amount_tzs, t.created_at,
                 fm.full_name AS from_member, tm.full_name AS to_member,
                 fg.name AS from_group, tg.name AS to_group
            FROM ntzs_transactions t
            LEFT JOIN members fm ON fm.id = t.from_member_id
            LEFT JOIN members tm ON tm.id = t.to_member_id
            LEFT JOIN groups  fg ON fg.id = t.from_group_id
            LEFT JOIN groups  tg ON tg.id = t.to_group_id
           ORDER BY t.created_at DESC LIMIT 8`),
    rows(`SELECT to_char(d.day,'YYYY-MM-DD') AS day,
                 COALESCE(SUM(t.amount_tzs),0)::bigint AS volume_tzs,
                 COUNT(t.id)::int AS tx_count
            FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') AS d(day)
            LEFT JOIN ntzs_transactions t ON t.created_at::date = d.day
           GROUP BY d.day ORDER BY d.day`),
  ]);

  return NextResponse.json({
    people: {
      users, members, members_active: membersActive,
      members_with_business: membersWithBusiness,
      investors: investorCount,
    },
    groups: {
      total: groups, active: groupsActive, memberships: groupMemberships,
      avg_members: groups > 0 ? Math.round((groupMemberships / groups) * 10) / 10 : 0,
    },
    money: {
      volume_processed_tzs: volume,
      held_in_groups_tzs: heldGroups,
      held_by_members_tzs: heldMembers,
      master_reserve_tzs: heldMaster,
      contributions_collected_tzs: contributionsPaid,
      contributions_count: contributionsCount,
      disbursed_tzs: disbursed,
      deposits_tzs: deposits,
      withdrawals_tzs: withdrawals,
      investments_tzs: investments,
    },
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
