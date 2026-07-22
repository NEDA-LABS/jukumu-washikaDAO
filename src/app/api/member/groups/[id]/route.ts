import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

const LEADERSHIP_ROLES = new Set(['leader', 'mwenyekiti', 'katibu', 'mwekahazina']);

async function ensureContributionFrequencyColumn(client: { query: (sql: string) => Promise<unknown> }) {
  await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS contribution_frequency VARCHAR(10) NOT NULL DEFAULT 'monthly'`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await ensureContributionFrequencyColumn(client);

    const membershipRes = await client.query(
      `
      SELECT gm.member_id, gm.role, gm.status
      FROM group_members gm
      JOIN members m ON m.id = gm.member_id
      WHERE m.user_id = $1
        AND gm.group_id = $2
      LIMIT 1
      `,
      [auth.userId, groupId]
    );

    if (membershipRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const membership = membershipRes.rows[0] as {
      member_id: number;
      role: string;
      status: string;
    };

    const groupRes = await client.query(
      `
      SELECT
        g.id,
        g.name,
        g.founded_date,
        g.total_investment,
        g.monthly_contribution,
        g.contribution_frequency,
        g.status,
        g.created_at,
        g.group_code,
        g.join_policy,
        u.full_name AS leader_name,
        (SELECT COUNT(*)::int FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.status = 'active') AS member_count
      FROM groups g
      LEFT JOIN users u ON u.id = g.leader_id
      WHERE g.id = $1
      LIMIT 1
      `,
      [groupId]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      membership,
      group: groupRes.rows[0]
    });
  } catch (error) {
    console.error('Member group details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * PATCH /api/member/groups/[id]
 * Group settings edit (leadership only): monthly_contribution and/or
 * contribution_frequency (monthly | weekly).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const { monthlyContribution, contributionFrequency } = body || {};

  if (monthlyContribution === undefined && contributionFrequency === undefined) {
    return NextResponse.json({ error: 'Hakuna kilichobadilishwa.' }, { status: 400 });
  }
  if (contributionFrequency !== undefined && !['monthly', 'weekly'].includes(contributionFrequency)) {
    return NextResponse.json({ error: 'contributionFrequency lazima iwe monthly au weekly.' }, { status: 400 });
  }
  if (monthlyContribution !== undefined) {
    const amt = Number(monthlyContribution);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Kiasi cha mchango lazima kiwe nambari halali.' }, { status: 400 });
    }
  }

  const client = await pool.connect();
  try {
    await ensureContributionFrequencyColumn(client);

    const membershipRes = await client.query(
      `SELECT gm.role FROM group_members gm
         JOIN members m ON m.id = gm.member_id
        WHERE m.user_id = $1 AND gm.group_id = $2 AND gm.status = 'active'
        LIMIT 1`,
      [auth.userId, groupId]
    );
    const role = (membershipRes.rows[0] as { role?: string } | undefined)?.role;
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!LEADERSHIP_ROLES.has(role)) {
      return NextResponse.json({ error: 'Uongozi pekee unaweza kubadilisha mipangilio ya kundi.' }, { status: 403 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (monthlyContribution !== undefined) { sets.push(`monthly_contribution = $${i++}`); values.push(Number(monthlyContribution)); }
    if (contributionFrequency !== undefined) { sets.push(`contribution_frequency = $${i++}`); values.push(contributionFrequency); }
    values.push(groupId);

    const updated = await client.query(
      `UPDATE groups SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, monthly_contribution, contribution_frequency`,
      values
    );

    return NextResponse.json({ success: true, group: updated.rows[0] });
  } catch (error) {
    console.error('Group settings update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
