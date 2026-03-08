import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureNtzsSchema } from '@/lib/ntzs-db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const groupId = searchParams.get('groupId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!userId && !groupId) {
    return NextResponse.json({ error: 'userId or groupId is required' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await ensureNtzsSchema(client);

    let memberId: number | null = null;

    if (userId) {
      const res = await client.query(
        `SELECT m.id FROM members m JOIN users u ON u.id = m.user_id WHERE u.id = $1 LIMIT 1`,
        [userId]
      );
      if (res.rows.length === 0) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      memberId = (res.rows[0] as { id: number }).id;
    }

    // Build query based on whether we're looking at member or group transactions
    let whereClause: string;
    let params: (number | string)[];

    if (groupId) {
      whereClause = `(t.from_group_id = $1 OR t.to_group_id = $1)`;
      params = [parseInt(groupId)];
    } else {
      whereClause = `(t.from_member_id = $1 OR t.to_member_id = $1)`;
      params = [memberId!];
    }

    const countRes = await client.query(
      `SELECT COUNT(*) as total FROM ntzs_transactions t WHERE ${whereClause}`,
      params
    );
    const total = parseInt((countRes.rows[0] as { total: string }).total);

    const txRes = await client.query(
      `SELECT
        t.id, t.ntzs_id, t.type, t.status,
        t.from_member_id, t.from_group_id, t.to_member_id, t.to_group_id,
        t.amount_tzs, t.fee_tzs, t.net_tzs,
        t.phone, t.tx_hash, t.purpose, t.note,
        t.created_at, t.updated_at,
        fm.full_name as from_member_name,
        fg.name as from_group_name,
        tm.full_name as to_member_name,
        tg.name as to_group_name
      FROM ntzs_transactions t
      LEFT JOIN members fm ON fm.id = t.from_member_id
      LEFT JOIN groups fg ON fg.id = t.from_group_id
      LEFT JOIN members tm ON tm.id = t.to_member_id
      LEFT JOIN groups tg ON tg.id = t.to_group_id
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      transactions: txRes.rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Transactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
