import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getLessonsByCourse, createLesson, getCourseById } from '@/lib/education/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const courseId = parseInt(id, 10);
  if (isNaN(courseId)) {
    return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
  }

  try {
    const lessons = await getLessonsByCourse(courseId);
    return NextResponse.json(lessons);
  } catch (err) {
    console.error('GET /admin/education/courses/[id]/lessons error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const courseId = parseInt(id, 10);
  if (isNaN(courseId)) {
    return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
  }

  try {
    const course = await getCourseById(courseId);
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const body = await request.json();
    if (!body.title || !body.content) {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
    }

    const lesson = await createLesson({
      course_id: courseId,
      title: body.title,
      content: body.content,
      language: body.language ?? 'sw',
      lesson_order: body.lesson_order ?? 0,
      duration_minutes: body.duration_minutes ?? 15,
    });
    return NextResponse.json(lesson, { status: 201 });
  } catch (err) {
    console.error('POST /admin/education/courses/[id]/lessons error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
