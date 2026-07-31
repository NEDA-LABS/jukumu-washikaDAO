import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/member/groups/[id]/wall
 *
 * The Ukuta — one brick per member per month, gold when their contribution
 * landed. Built from ntzs_transactions rather than monthly_contributions:
 * that table was never populated, and the ledger is where contributions
 * actually settle, so it is the only source that tells the truth.
 */
const MONTHS = 6;

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const meRes = await client.query(
      `SELECT m.id FROM members m
         JOIN group_members gm ON gm.member_id = m.id
        WHERE m.user_id = $1 AND gm.group_id = $2 AND gm.status = 'active'
        LIMIT 1`,
      [auth.userId, groupId],
    );
    if (meRes.rows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const myMemberId = (meRes.rows[0] as { id: number }).id;

    // Roster in a stable order so a member keeps the same column between
    // renders — the wall is only legible if bricks do not move around.
    const membersRes = await client.query(
      `SELECT m.id, m.full_name
         FROM group_members gm
         JOIN members m ON m.id = gm.member_id
        WHERE gm.group_id = $1 AND gm.status = 'active'
        ORDER BY gm.joined_date NULLS LAST, m.id`,
      [groupId],
    );

    const paidRes = await client.query(
      `SELECT DISTINCT t.from_member_id AS member_id,
              to_char(date_trunc('month', t.created_at), 'YYYY-MM') AS month
         FROM ntzs_transactions t
        WHERE t.to_group_id = $1
          AND t.purpose = 'contribution'
          AND t.from_member_id IS NOT NULL
          AND t.created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '${MONTHS - 1} months'`,
      [groupId],
    );

    const members = (membersRes.rows as { id: number; full_name: string }[]).map((m) => ({
      id: m.id,
      name: m.full_name,
      isMe: m.id === myMemberId,
    }));

    const paidSet = new Set(
      (paidRes.rows as { member_id: number; month: string }[]).map((r) => `${r.member_id}:${r.month}`),
    );

    // Oldest month first, so the wall reads bottom-up like something built.
    const now = new Date();
    const rows = Array.from({ length: MONTHS }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1 - i), 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const bricks = members.map((m) => ({
        memberId: m.id,
        paid: paidSet.has(`${m.id}:${key}`),
        isMe: m.isMe,
      }));
      return {
        month: key,
        label: d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
        bricks,
        count: bricks.filter((b) => b.paid).length,
      };
    });

    return NextResponse.json({
      members,
      total: members.length,
      rows,
      myMemberId,
    });
  } catch (error) {
    console.error('[group wall]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
