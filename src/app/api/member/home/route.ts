import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/member/home — everything the Home screen shows, in one round trip.
 *
 * The screen is a single scroll, so it should be a single request; five
 * parallel fetches from the client would just reproduce the old dashboard's
 * waterfall behind a new layout.
 *
 * Note on "yield": the prototype shows accrued interest, but the platform has
 * no yield product, so this reports 0 rather than inventing a number. A figure
 * on a savings screen is a promise; it has to come from somewhere real.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    const meRes = await client.query(
      `SELECT id, full_name, created_at FROM members WHERE user_id = $1 LIMIT 1`,
      [auth.userId],
    );
    if (meRes.rows.length === 0) {
      return NextResponse.json({ member: null, group: null, balanceTzs: 0, activity: [] });
    }
    const me = meRes.rows[0] as { id: number; full_name: string; created_at: string };

    const [balRes, groupRes] = await Promise.all([
      client.query(
        `SELECT COALESCE(balance_tzs, 0)::bigint AS b FROM wallet_accounts
          WHERE owner_type = 'member' AND owner_id = $1 LIMIT 1`,
        [me.id],
      ),
      // The group whose wall this member is building. With several, the one
      // they joined first is the one Home speaks for.
      client.query(
        `SELECT g.id, g.name, g.group_code, g.monthly_contribution,
                (SELECT COUNT(*)::int FROM group_members x
                  WHERE x.group_id = g.id AND x.status = 'active') AS member_count
           FROM group_members gm JOIN groups g ON g.id = gm.group_id
          WHERE gm.member_id = $1 AND gm.status = 'active'
          ORDER BY gm.joined_date NULLS LAST, g.id LIMIT 1`,
        [me.id],
      ),
    ]);

    const balanceTzs = Number((balRes.rows[0] as { b?: string } | undefined)?.b ?? 0);
    const group = groupRes.rows[0] as
      | { id: number; name: string; group_code: string | null; member_count: number | null; monthly_contribution: string | null }
      | undefined;

    // Streak: consecutive months ending at the current one in which this member
    // contributed. Counted in SQL-fed JS rather than a window function so the
    // "must end at this month" rule stays obvious.
    const monthsRes = await client.query(
      `SELECT DISTINCT to_char(date_trunc('month', created_at), 'YYYY-MM') AS m
         FROM ntzs_transactions
        WHERE from_member_id = $1 AND purpose = 'contribution'
        ORDER BY m DESC LIMIT 36`,
      [me.id],
    );
    const paidMonths = new Set((monthsRes.rows as { m: string }[]).map((r) => r.m));
    let streak = 0;
    const cur = new Date();
    for (;;) {
      const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!paidMonths.has(key)) break;
      streak += 1;
      cur.setUTCMonth(cur.getUTCMonth() - 1);
    }

    let collectedTzs = 0;
    let targetTzs = 0;
    let proposal = null;

    if (group) {
      const [collRes, propRes] = await Promise.all([
        client.query(
          `SELECT COALESCE(SUM(amount_tzs), 0)::bigint AS s
             FROM ntzs_transactions
            WHERE to_group_id = $1 AND purpose = 'contribution'
              AND created_at >= date_trunc('month', CURRENT_DATE)`,
          [group.id],
        ),
        // No closing deadline exists on group_proposals, so Home reports the
        // tally without a countdown rather than inventing one.
        client.query(
          `SELECT p.id, p.title, COALESCE(p.payment_amount_tzs, 0)::bigint AS amount,
                  (SELECT COUNT(*)::int FROM group_proposal_votes v
                    WHERE v.proposal_id = p.id AND v.vote IN ('yes','for','approve')) AS yes,
                  (SELECT COUNT(*)::int FROM group_proposal_votes v
                    WHERE v.proposal_id = p.id AND v.vote IN ('no','against','reject')) AS no
             FROM group_proposals p
            WHERE p.group_id = $1 AND p.status = 'open'
            ORDER BY p.created_at DESC LIMIT 1`,
          [group.id],
        ),
      ]);

      collectedTzs = Number((collRes.rows[0] as { s: string }).s);
      const members = Number(group.member_count ?? 0);
      targetTzs = members * Number(group.monthly_contribution ?? 0);

      const p = propRes.rows[0] as
        | { id: number; title: string; amount: string; yes: number; no: number }
        | undefined;
      if (p) {
        proposal = {
          id: p.id,
          groupId: group.id,
          title: p.title,
          amountTzs: Number(p.amount),
          closesInDays: null,
          yes: p.yes,
          no: p.no,
          pending: Math.max(0, members - (p.yes + p.no)),
        };
      }
    }

    const actRes = await client.query(
      `SELECT t.id, t.type, t.purpose, t.amount_tzs, t.created_at,
              g.name AS group_name
         FROM ntzs_transactions t
         LEFT JOIN groups g ON g.id = COALESCE(t.to_group_id, t.from_group_id)
        WHERE t.from_member_id = $1 OR t.to_member_id = $1
        ORDER BY t.created_at DESC LIMIT 6`,
      [me.id],
    );

    return NextResponse.json({
      member: {
        id: me.id,
        firstName: (me.full_name || '').trim().split(/\s+/)[0] || '',
        since: me.created_at,
      },
      balanceTzs,
      streakMonths: streak,
      yieldTzs: 0,
      group: group
        ? { id: group.id, name: group.name, code: group.group_code, memberCount: group.member_count ?? 0 }
        : null,
      collectedTzs,
      targetTzs,
      proposal,
      activity: (actRes.rows as {
        id: number; type: string; purpose: string | null; amount_tzs: string;
        created_at: string; group_name: string | null;
      }[]).map((r) => ({
        id: String(r.id),
        type: r.type,
        purpose: r.purpose,
        amountTzs: Number(r.amount_tzs),
        groupName: r.group_name,
        at: r.created_at,
      })),
    });
  } catch (error) {
    console.error('[member/home]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
