import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import pool from '@/lib/db';
import { getCategoryById, getCoursesByCategory, getCertificatesForMember } from '@/lib/education/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
  }

  try {
    const memberRes = await pool.query(
      'SELECT id FROM members WHERE user_id = $1 LIMIT 1',
      [auth.userId],
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }
    const memberId = memberRes.rows[0].id as number;

    const category = await getCategoryById(categoryId);
    if (!category || !category.is_published) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Get courses with lesson counts
    const courses = await getCoursesByCategory(categoryId, true);

    // Get course progress for this member
    const progressRes = await pool.query(
      `SELECT course_id, status FROM edu_course_progress WHERE member_id = $1 AND course_id = ANY($2)`,
      [memberId, courses.map(c => c.id)],
    );
    const progressMap = new Map<number, string>();
    for (const row of progressRes.rows) {
      progressMap.set(row.course_id, row.status);
    }

    const coursesWithProgress = courses.map(c => ({
      ...c,
      progress_status: progressMap.get(c.id) ?? 'not_started',
    }));

    // Check certificate status
    const certs = await getCertificatesForMember(memberId);
    const certificate = certs.find(c => c.category_id === categoryId) ?? null;

    return NextResponse.json({
      category,
      courses: coursesWithProgress,
      certificate,
    });
  } catch (error) {
    console.error('Education category detail GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
