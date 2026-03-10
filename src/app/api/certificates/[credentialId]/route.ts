import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/certificates/[credentialId]
// Public endpoint — returns certificate data for display/verification
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  const client = await pool.connect();
  try {
    const { credentialId } = await params;
    const result = await client.query(
      `SELECT c.credential_id, c.member_name, c.course_title, c.issued_at,
              ec.category, ec.difficulty_level, ec.duration, ec.description
       FROM certificates c
       JOIN educational_content ec ON c.educational_content_id = ec.id
       WHERE c.credential_id = $1`,
      [credentialId]
    );
    client.release();
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }
    return NextResponse.json({ certificate: result.rows[0] });
  } catch (err) {
    client.release();
    console.error('certificate GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
