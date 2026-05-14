import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'investor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);
  const offset = Number(searchParams.get('offset') ?? 0);

  let client;
  try {
    client = await pool.connect();

    // Get investor's ntzs_user_id for cross-matching
    const profileRes = await client.query(
      `SELECT ntzs_user_id FROM investor_profiles WHERE user_id = $1 LIMIT 1`,
      [auth.userId]
    ) as { rows: { ntzs_user_id: string | null }[] };

    const ntzsUserId = profileRes.rows[0]?.ntzs_user_id ?? null;

    // Fetch transactions tagged with this investor_id in metadata
    // OR where the ntzs sender/receiver matches their ntzs_user_id (for transfers to/from groups)
    const res = await client.query(
      `SELECT
          t.id, t.ntzs_id, t.type, t.status,
          t.amount_tzs, t.fee_tzs, t.net_tzs,
          t.phone, t.tx_hash, t.purpose, t.note,
          t.metadata, t.created_at,
          fm.full_name AS from_member_name,
          tm.full_name AS to_member_name,
          fg.name AS from_group_name,
          tg.name AS to_group_name
        FROM ntzs_transactions t
        LEFT JOIN members fm ON fm.id = t.from_member_id
        LEFT JOIN members tm ON tm.id = t.to_member_id
        LEFT JOIN groups fg ON fg.id = t.from_group_id
        LEFT JOIN groups tg ON tg.id = t.to_group_id
        WHERE (t.metadata->>'investor_id')::int = $1
           OR ($2::text IS NOT NULL AND t.metadata->>'ntzs_from' = $2)
           OR ($2::text IS NOT NULL AND t.metadata->>'ntzs_to' = $2)
        ORDER BY t.created_at DESC
        LIMIT $3 OFFSET $4`,
      [auth.userId, ntzsUserId, limit, offset]
    );

    const countRes = await client.query(
      `SELECT COUNT(*) AS total FROM ntzs_transactions
       WHERE (metadata->>'investor_id')::int = $1
          OR ($2::text IS NOT NULL AND metadata->>'ntzs_from' = $2)
          OR ($2::text IS NOT NULL AND metadata->>'ntzs_to' = $2)`,
      [auth.userId, ntzsUserId]
    ) as { rows: { total: string }[] };

    return NextResponse.json({
      success: true,
      transactions: res.rows,
      total: Number(countRes.rows[0]?.total ?? 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error('Investor transactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client?.release();
  }
}
