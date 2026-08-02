import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/member/groups/[id]/screen
 *
 * Feeds the Kikundi and Utawala screens in one round trip: treasury, the
 * roster with each member's streak and whether they have paid this month,
 * and the proposals split into open and closed.
 */
const LEADERSHIP = new Set(['leader', 'mwenyekiti', 'katibu', 'mwekahazina']);

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });

  const client = await pool.connect();
  try {
    const meRes = await client.query(
      `SELECT m.id, gm.role FROM members m
         JOIN group_members gm ON gm.member_id = m.id
        WHERE m.user_id = $1 AND gm.group_id = $2 AND gm.status = 'active' LIMIT 1`,
      [auth.userId, groupId],
    );
    if (meRes.rows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const me = meRes.rows[0] as { id: number; role: string };

    const [grpRes, treasuryRes, rosterRes, paidRes, streakRes, propRes] = await Promise.all([
      client.query(`SELECT id, name, group_code, monthly_contribution FROM groups WHERE id = $1`, [groupId]),
      client.query(
        `SELECT COALESCE(balance_tzs, 0)::bigint AS b FROM wallet_accounts
          WHERE owner_type = 'group' AND owner_id = $1 LIMIT 1`,
        [groupId],
      ),
      client.query(
        `SELECT m.id, m.full_name, m.avatar_url, gm.role
           FROM group_members gm JOIN members m ON m.id = gm.member_id
          WHERE gm.group_id = $1 AND gm.status = 'active'
          ORDER BY gm.joined_date NULLS LAST, m.id`,
        [groupId],
      ),
      // Who has paid in the current month.
      client.query(
        `SELECT DISTINCT from_member_id AS member_id FROM ntzs_transactions
          WHERE to_group_id = $1 AND purpose = 'contribution'
            AND created_at >= date_trunc('month', CURRENT_DATE)`,
        [groupId],
      ),
      // Distinct contribution months per member, newest first, for streaks.
      client.query(
        `SELECT from_member_id AS member_id,
                to_char(date_trunc('month', created_at), 'YYYY-MM') AS m
           FROM ntzs_transactions
          WHERE to_group_id = $1 AND purpose = 'contribution' AND from_member_id IS NOT NULL
          GROUP BY 1, 2`,
        [groupId],
      ),
      client.query(
        `SELECT p.id, p.title, p.status, p.proposal_type, p.created_at, p.funded_at,
                COALESCE(p.payment_amount_tzs, 0)::bigint AS amount,
                a.full_name AS by_name,
                (SELECT COUNT(*)::int FROM group_proposal_votes v
                  WHERE v.proposal_id = p.id AND v.vote IN ('yes','for','approve')) AS yes,
                (SELECT COUNT(*)::int FROM group_proposal_votes v
                  WHERE v.proposal_id = p.id AND v.vote IN ('no','against','reject')) AS no,
                (SELECT v.vote FROM group_proposal_votes v
                  WHERE v.proposal_id = p.id AND v.member_id = $2 LIMIT 1) AS my_vote
           FROM group_proposals p
           LEFT JOIN members a ON a.id = p.created_by_member_id
          WHERE p.group_id = $1
          ORDER BY p.created_at DESC LIMIT 40`,
        [groupId, me.id],
      ),
    ]);

    const group = grpRes.rows[0] as { id: number; name: string; group_code: string | null; monthly_contribution: string | null } | undefined;
    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const paidNow = new Set((paidRes.rows as { member_id: number }[]).map((r) => r.member_id));

    const monthsBy = new Map<number, Set<string>>();
    for (const r of streakRes.rows as { member_id: number; m: string }[]) {
      if (!monthsBy.has(r.member_id)) monthsBy.set(r.member_id, new Set());
      monthsBy.get(r.member_id)!.add(r.m);
    }
    // A streak only counts if it reaches the current month; otherwise it is
    // history, not a run someone is currently keeping.
    const streakOf = (memberId: number) => {
      const months = monthsBy.get(memberId);
      if (!months) return 0;
      let n = 0;
      const d = new Date();
      for (;;) {
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        if (!months.has(key)) break;
        n += 1;
        d.setUTCMonth(d.getUTCMonth() - 1);
      }
      return n;
    };

    const members = (rosterRes.rows as { id: number; full_name: string; avatar_url: string | null; role: string }[])
      .map((m) => ({
        id: m.id,
        name: m.full_name,
        avatarUrl: m.avatar_url,
        role: m.role,
        isLeader: LEADERSHIP.has(m.role),
        isMe: m.id === me.id,
        paid: paidNow.has(m.id),
        streak: streakOf(m.id),
      }));

    const total = members.length;
    const rows = propRes.rows as {
      id: number; title: string; status: string; proposal_type: string | null;
      created_at: string; funded_at: string | null; amount: string;
      by_name: string | null; yes: number; no: number; my_vote: string | null;
    }[];

    const shape = (p: (typeof rows)[number]) => ({
      id: p.id,
      title: p.title,
      kind: p.proposal_type || 'proposal',
      amountTzs: Number(p.amount),
      by: p.by_name,
      yes: p.yes,
      no: p.no,
      pending: Math.max(0, total - (p.yes + p.no)),
      myVote: p.my_vote,
      status: p.status,
      funded: !!p.funded_at,
      at: p.created_at,
    });

    return NextResponse.json({
      group: {
        id: group.id, name: group.name, code: group.group_code,
        monthlyContribution: Number(group.monthly_contribution ?? 0),
      },
      isLeader: LEADERSHIP.has(me.role),
      myMemberId: me.id,
      treasuryTzs: Number((treasuryRes.rows[0] as { b?: string } | undefined)?.b ?? 0),
      paidThisMonth: paidNow.size,
      total,
      members,
      openProposals: rows.filter((p) => p.status === 'open').map(shape),
      closedProposals: rows.filter((p) => p.status !== 'open').map(shape),
    });
  } catch (error) {
    console.error('[group screen]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
