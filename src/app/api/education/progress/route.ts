import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import pool from '@/lib/db';
import { markLessonComplete, upsertCourseProgress, getCourseProgressForMember } from '@/lib/education/db';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Get all lesson progress for this member
    const progressRes = await pool.query(
      `SELECT lp.*, l.title AS lesson_title, l.course_id, c.title AS course_title
       FROM edu_lesson_progress lp
       JOIN edu_lessons l ON l.id = lp.lesson_id
       JOIN edu_courses c ON c.id = l.course_id
       WHERE lp.member_id = $1
       ORDER BY lp.completed_at DESC NULLS LAST`,
      [memberId],
    );

    // Also get course-level progress
    const courseProgressRes = await pool.query(
      `SELECT cp.*, c.title AS course_title
       FROM edu_course_progress cp
       JOIN edu_courses c ON c.id = cp.course_id
       WHERE cp.member_id = $1
       ORDER BY cp.started_at DESC NULLS LAST`,
      [memberId],
    );

    return NextResponse.json({
      lesson_progress: progressRes.rows,
      course_progress: courseProgressRes.rows,
    });
  } catch (error) {
    console.error('Education progress GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const lessonId = body?.lesson_id;
  if (!lessonId || typeof lessonId !== 'number') {
    return NextResponse.json({ error: 'lesson_id is required' }, { status: 400 });
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

    // Verify lesson exists and get course_id
    const lessonRes = await pool.query(
      'SELECT id, course_id FROM edu_lessons WHERE id = $1',
      [lessonId],
    );
    if (lessonRes.rows.length === 0) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }
    const courseId = lessonRes.rows[0].course_id as number;

    // Mark lesson complete
    const progress = await markLessonComplete(memberId, lessonId);

    // Update course progress
    const courseProgress = await getCourseProgressForMember(memberId, courseId);
    if (courseProgress.status === 'not_started') {
      await upsertCourseProgress(memberId, courseId, 'in_progress');
    }
    // Check if all lessons now completed
    if (courseProgress.completed >= courseProgress.total && courseProgress.total > 0) {
      await upsertCourseProgress(memberId, courseId, 'completed');
    }

    return NextResponse.json({
      success: true,
      lesson_progress: progress,
      course_progress: await getCourseProgressForMember(memberId, courseId),
    });
  } catch (error) {
    console.error('Education progress POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
