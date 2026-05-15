import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureNtzsSchema } from '@/lib/ntzs-db';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  let client;
  try {
    client = await pool.connect();
    await ensureNtzsSchema(client);

    // Base group query — only columns guaranteed to exist
    const groupRes = await client.query(
      `SELECT
          g.id, g.name, g.status, g.founded_date,
          g.monthly_contribution, g.total_investment, g.created_at,
          g.voting_threshold_numerator, g.voting_threshold_denominator,
          g.ntzs_user_id,
          u.full_name AS leader_name,
          (
            SELECT COUNT(*) FROM group_members gm
            WHERE gm.group_id = g.id AND gm.status = 'active'
          ) AS member_count
        FROM groups g
        LEFT JOIN users u ON u.id = g.leader_id
        WHERE g.id = $1
        LIMIT 1`,
      [groupId]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const group = groupRes.rows[0] as Record<string, unknown>;

    // Proposal stats — only if group_proposals table exists with needed columns
    let proposalStats = { total_proposals: 0, passed_proposals: 0, executed_proposals: 0, open_proposals: 0 };
    try {
      const pRes = await client.query(
        `SELECT
            COUNT(*) AS total_proposals,
            COUNT(*) FILTER (WHERE p.status = 'closed') AS passed_proposals,
            COUNT(*) FILTER (WHERE p.payment_status = 'completed') AS executed_proposals,
            COUNT(*) FILTER (WHERE p.status = 'open') AS open_proposals
          FROM group_proposals p
          WHERE p.group_id = $1`,
        [groupId]
      );
      if (pRes.rows.length > 0) {
        const r = pRes.rows[0] as Record<string, string>;
        proposalStats = {
          total_proposals: Number(r.total_proposals ?? 0),
          passed_proposals: Number(r.passed_proposals ?? 0),
          executed_proposals: Number(r.executed_proposals ?? 0),
          open_proposals: Number(r.open_proposals ?? 0),
        };
      }
    } catch { /* group_proposals or payment_status column may not exist yet */ }

    // Activity from ntzs_transactions
    let activity = { last_activity: null as string | null, transactions_90d: 0, volume_90d_tzs: 0 };
    try {
      const tRes = await client.query(
        `SELECT
            MAX(t.created_at) AS last_activity,
            COUNT(*) FILTER (WHERE t.created_at >= NOW() - INTERVAL '90 days') AS transactions_90d,
            COALESCE(SUM(t.amount_tzs) FILTER (WHERE t.created_at >= NOW() - INTERVAL '90 days'), 0) AS volume_90d_tzs
          FROM ntzs_transactions t
          WHERE t.from_group_id = $1 OR t.to_group_id = $1`,
        [groupId]
      );
      if (tRes.rows.length > 0) {
        const r = tRes.rows[0] as Record<string, unknown>;
        activity = {
          last_activity: r.last_activity ? String(r.last_activity) : null,
          transactions_90d: Number(r.transactions_90d ?? 0),
          volume_90d_tzs: Number(r.volume_90d_tzs ?? 0),
        };
      }
    } catch { /* ntzs_transactions may not exist yet */ }

    // Prodcast projects
    let projects: unknown[] = [];
    try {
      const pjRes = await client.query(
        `SELECT p.id, p.title, p.description, p.metadata, p.funded_at, p.status
         FROM group_proposals p
         WHERE p.group_id = $1 AND p.proposal_type = 'prodcast'
         ORDER BY p.funded_at DESC NULLS LAST, p.created_at DESC
         LIMIT 10`,
        [groupId]
      );
      projects = pjRes.rows;
    } catch { /* proposal_type column may not exist yet */ }

    // Leadership roster
    let leadership: unknown[] = [];
    try {
      const lRes = await client.query(
        `SELECT m.full_name, gm.role
         FROM group_members gm
         JOIN members m ON m.id = gm.member_id
         WHERE gm.group_id = $1
           AND gm.status = 'active'
           AND gm.role IN ('leader','mwenyekiti','katibu','mwekahazina')
         ORDER BY gm.role
         LIMIT 6`,
        [groupId]
      );
      leadership = lRes.rows;
    } catch { /* safe fallback */ }

    return NextResponse.json({
      success: true,
      group: { ...group, ...proposalStats, ...activity },
      projects,
      leadership,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Investor group detail error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client?.release();
  }
}
