import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'code ni lazima.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT
         g.id,
         g.name,
         g.group_code,
         g.monthly_contribution,
         g.join_policy,
         g.status,
         g.founded_date,
         u.full_name AS leader_name,
         (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id = g.id AND gm.status = 'active') AS member_count
       FROM groups g
       LEFT JOIN users u ON u.id = g.leader_id
       WHERE g.group_code = $1 AND g.status = 'active'
       LIMIT 1`,
      [code]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Hakuna kundi lenye nambari hiyo.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, group: res.rows[0] });
  } finally {
    client.release();
  }
}
