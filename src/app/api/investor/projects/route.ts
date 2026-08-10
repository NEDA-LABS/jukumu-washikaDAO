import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { ensureGroupContactColumns } from '@/lib/groups-schema';
import { ensureExternalFundingSchema } from '@/lib/wallet/external-funding';

/**
 * GET /api/investor/projects
 * Authenticated — returns Prodcast proposals with richer group financial data.
 */
export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let client;
  try {
    // The contact columns are created lazily; this route reads them, so it has
    // to guarantee they exist rather than assume another endpoint ran first.
    await ensureGroupContactColumns();
    // The raised total reads external_funding_claims, which is created lazily.
    await ensureExternalFundingSchema();
    client = await pool.connect();

    const res = await client.query(`
      SELECT
        p.id,
        p.title,
        p.description,
        p.metadata,
        p.funded_at,
        p.status,
        p.created_at,
        g.id AS group_id,
        g.name AS group_name,
        g.contact_phone AS group_phone,
        g.contact_email AS group_email,
        g.monthly_contribution,
        g.total_investment,
        g.founded_date,
        (
          SELECT COUNT(*)
          FROM group_members gm
          WHERE gm.group_id = g.id AND gm.status = 'active'
        ) AS member_count,
        (
          SELECT COUNT(*) FILTER (WHERE gpv.vote = 'yes')
          FROM group_proposal_votes gpv
          WHERE gpv.proposal_id = p.id
        ) AS yes_votes,
        (
          SELECT COUNT(*)
          FROM group_proposal_votes gpv
          WHERE gpv.proposal_id = p.id
        ) AS total_votes,
        -- What this project has actually raised. groups.total_investment used
        -- to stand in for this, but it is a manually-set per-GROUP figure that
        -- nothing about funding ever writes, so every project read 0% no
        -- matter how much money had arrived. Both real routes count here:
        -- investors spending an in-app balance, and nTZS sent on-chain to the
        -- treasury and since confirmed.
        (
          COALESCE((
            SELECT SUM(t.amount_tzs)
            FROM ntzs_transactions t
            WHERE t.purpose = 'funding'
              AND t.metadata->>'proposal_id' = p.id::text
          ), 0)
          + COALESCE((
            SELECT SUM(c.amount_tzs)
            FROM external_funding_claims c
            WHERE c.proposal_id = p.id AND c.status = 'confirmed'
          ), 0)
        )::bigint AS raised_tzs,
        -- Shown to the group as "on its way", never counted as raised.
        COALESCE((
          SELECT SUM(c.amount_tzs)
          FROM external_funding_claims c
          WHERE c.proposal_id = p.id AND c.status = 'pending'
        ), 0)::bigint AS pending_tzs
      FROM group_proposals p
      JOIN groups g ON g.id = p.group_id
      WHERE p.proposal_type = 'prodcast'
      ORDER BY
        p.funded_at DESC NULLS LAST,
        p.created_at DESC
      LIMIT 100
    `);

    return NextResponse.json({ success: true, projects: res.rows });
  } catch (error) {
    console.error('Investor projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client?.release();
  }
}
