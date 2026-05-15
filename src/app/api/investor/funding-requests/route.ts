import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/investor/funding-requests
 * Public endpoint — returns Prodcast proposals that passed voting (funded_at IS NOT NULL).
 * Powers the investor portal's match-funding section.
 */
export async function GET() {
  let client;
  try {
    client = await pool.connect();

    const res = await client.query(`
      SELECT
        p.id,
        p.title,
        p.description,
        p.metadata,
        p.funded_at,
        p.created_at,
        g.id AS group_id,
        g.name AS group_name,
        g.monthly_contribution,
        (
          SELECT COUNT(*)
          FROM group_members gm
          WHERE gm.group_id = g.id AND gm.status = 'active'
        ) AS member_count
      FROM group_proposals p
      JOIN groups g ON g.id = p.group_id
      WHERE p.proposal_type = 'prodcast'
        AND p.funded_at IS NOT NULL
      ORDER BY p.funded_at DESC
      LIMIT 50
    `);

    return NextResponse.json({ success: true, requests: res.rows });
  } catch (error) {
    console.error('Funding requests error:', error);
    return NextResponse.json({ success: false, requests: [] }, { status: 500 });
  } finally {
    client?.release();
  }
}
