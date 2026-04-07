import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getCourseById, getLessonsByCourse, getCourseProgressForMember, getPrerequisitesForCourse } from '@/lib/education/db';
import pool from '@/lib/db';

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

    const [lessons, progress, prerequisites] = await Promise.all([
      getLessonsByCourse(courseId),
      getCourseProgressForMember(memberId, courseId),
      getPrerequisitesForCourse(courseId),
    ]);

    // Get lesson completion statuses
    const lessonProgressRes = await pool.query(
      `SELECT lesson_id, completed FROM edu_lesson_progress
       WHERE member_id = $1 AND lesson_id = ANY($2)`,
      [memberId, lessons.map(l => l.id)],
    );
    const completedLessons = new Set(
      lessonProgressRes.rows
        .filter((r: { completed: boolean }) => r.completed)
        .map((r: { lesson_id: number }) => r.lesson_id),
    );

    const lessonsWithProgress = lessons.map(l => ({
      id: l.id,
      title: l.title,
      lesson_order: l.lesson_order,
      duration_minutes: l.duration_minutes,
      completed: completedLessons.has(l.id),
    }));

    return NextResponse.json({
      course,
      lessons: lessonsWithProgress,
      progress,
      prerequisites,
    });
  } catch (error) {
    console.error('Education course detail GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
