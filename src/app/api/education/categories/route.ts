import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import pool from '@/lib/db';
import { getCategoriesPublished } from '@/lib/education/db';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get member_id
    const memberRes = await pool.query(
      'SELECT id FROM members WHERE user_id = $1 LIMIT 1',
      [auth.userId],
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }
    const memberId = memberRes.rows[0].id as number;

    // Get published categories with course counts
    const categories = await getCategoriesPublished();

    // Enrich with learner progress: count completed courses per category
    const progressRes = await pool.query(
      `SELECT c.category_id,
              COUNT(cp.id) FILTER (WHERE cp.status = 'completed')::int AS completed_courses,
              COUNT(cp.id) FILTER (WHERE cp.status = 'in_progress')::int AS in_progress_courses
       FROM edu_courses c
       LEFT JOIN edu_course_progress cp ON cp.course_id = c.id AND cp.member_id = $1
       WHERE c.is_published = true
       GROUP BY c.category_id`,
      [memberId],
    );
    const progressMap = new Map<number, { completed_courses: number; in_progress_courses: number }>();
    for (const row of progressRes.rows) {
      progressMap.set(row.category_id, {
        completed_courses: row.completed_courses,
        in_progress_courses: row.in_progress_courses,
      });
    }

    // Check certificate status per category
    const certRes = await pool.query(
      'SELECT category_id FROM edu_certificates WHERE member_id = $1',
      [memberId],
    );
    const certifiedCategoryIds = new Set(certRes.rows.map((r: { category_id: number }) => r.category_id));

    const enriched = categories.map(cat => ({
      ...cat,
      completed_courses: progressMap.get(cat.id)?.completed_courses ?? 0,
      in_progress_courses: progressMap.get(cat.id)?.in_progress_courses ?? 0,
      certified: certifiedCategoryIds.has(cat.id),
    }));

    return NextResponse.json({ categories: enriched });
  } catch (error) {
    console.error('Education categories GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
