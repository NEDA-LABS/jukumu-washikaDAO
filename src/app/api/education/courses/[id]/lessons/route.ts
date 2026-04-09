import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import pool from '@/lib/db';
import { getLessonsByCourse, getCourseById } from '@/lib/education/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
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

    const course = await getCourseById(courseId);
    if (!course || !course.is_published) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const lessons = await getLessonsByCourse(courseId);

    // Get completion status for each lesson
    const progressRes = await pool.query(
      `SELECT lesson_id, completed, completed_at FROM edu_lesson_progress
       WHERE member_id = $1 AND lesson_id = ANY($2)`,
      [memberId, lessons.map(l => l.id)],
    );
    const progressMap = new Map<number, { completed: boolean; completed_at: string | null }>();
    for (const row of progressRes.rows) {
      progressMap.set(row.lesson_id, { completed: row.completed, completed_at: row.completed_at });
    }

    const lessonsWithStatus = lessons.map(l => ({
      id: l.id,
      course_id: l.course_id,
      title: l.title,
      lesson_order: l.lesson_order,
      duration_minutes: l.duration_minutes,
      language: l.language,
      completed: progressMap.get(l.id)?.completed ?? false,
      completed_at: progressMap.get(l.id)?.completed_at ?? null,
    }));

    return NextResponse.json({ lessons: lessonsWithStatus });
  } catch (error) {
    console.error('Education lessons GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
