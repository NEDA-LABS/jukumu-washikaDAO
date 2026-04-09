import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import pool from '@/lib/db';
import { getLessonById, getAssessmentByLessonId } from '@/lib/education/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> },
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, lessonId } = await params;
  const courseId = Number(id);
  const lessonIdNum = Number(lessonId);
  if (!Number.isFinite(courseId) || !Number.isFinite(lessonIdNum)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
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

    const lesson = await getLessonById(lessonIdNum);
    if (!lesson || lesson.course_id !== courseId) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Get completion status
    const progressRes = await pool.query(
      'SELECT completed, completed_at FROM edu_lesson_progress WHERE member_id = $1 AND lesson_id = $2',
      [memberId, lessonIdNum],
    );
    const progress = progressRes.rows[0] ?? { completed: false, completed_at: null };

    // Get associated assessment if any
    const assessment = await getAssessmentByLessonId(lessonIdNum);

    return NextResponse.json({
      lesson,
      completed: progress.completed,
      completed_at: progress.completed_at,
      assessment_id: assessment?.id ?? null,
    });
  } catch (error) {
    console.error('Education lesson detail GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
