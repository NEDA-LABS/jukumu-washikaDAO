import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/training/certificates?userId=123
// Returns all certificates earned by a user
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      client.release();
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const memberRes = await client.query(
      'SELECT id FROM members WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    if (memberRes.rows.length === 0) {
      client.release();
      return NextResponse.json({ certificates: [] });
    }
    const memberId = memberRes.rows[0].id;

    const result = await client.query(
      `SELECT c.*, ec.category, ec.difficulty_level, ec.duration
       FROM certificates c
       JOIN educational_content ec ON c.educational_content_id = ec.id
       WHERE c.member_id = $1
       ORDER BY c.issued_at DESC`,
      [memberId]
    );

    client.release();
    return NextResponse.json({ certificates: result.rows });
  } catch (err) {
    client.release();
    console.error('certificates GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
