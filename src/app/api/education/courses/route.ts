import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('category_id');
  const difficulty = searchParams.get('difficulty');

  try {
    const memberRes = await pool.query(
      'SELECT id FROM members WHERE user_id = $1 LIMIT 1',
      [auth.userId],
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }
    const memberId = memberRes.rows[0].id as number;

    // Build dynamic query with filters
    const conditions: string[] = ['co.is_published = true'];
    const values: unknown[] = [];
    let idx = 1;

    if (categoryId) {
      conditions.push(`co.category_id = $${idx++}`);
      values.push(Number(categoryId));
    }
    if (difficulty && ['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
      conditions.push(`co.difficulty_level = $${idx++}`);
      values.push(difficulty);
    }

    values.push(memberId);
    const memberIdx = idx++;

    const result = await pool.query(
      `SELECT co.*,
              COUNT(DISTINCT l.id)::int AS lesson_count,
              COALESCE(SUM(l.duration_minutes), 0)::int AS total_duration,
              COALESCE(cp.status, 'not_started') AS progress_status
       FROM edu_courses co
       LEFT JOIN edu_lessons l ON l.course_id = co.id
       LEFT JOIN edu_course_progress cp ON cp.course_id = co.id AND cp.member_id = $${memberIdx}
       WHERE ${conditions.join(' AND ')}
       GROUP BY co.id, cp.status
       ORDER BY co.display_order, co.title`,
      values,
    );

    return NextResponse.json({ courses: result.rows });
  } catch (error) {
    console.error('Education courses GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
