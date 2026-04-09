import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getLessonById, updateLesson, deleteLesson } from '@/lib/education/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { lessonId } = await params;
  const parsedLessonId = parseInt(lessonId, 10);
  if (isNaN(parsedLessonId)) {
    return NextResponse.json({ error: 'Invalid lesson ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updated = await updateLesson(parsedLessonId, body);
    if (!updated) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT /admin/education/courses/[id]/lessons/[lessonId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { lessonId } = await params;
  const parsedLessonId = parseInt(lessonId, 10);
  if (isNaN(parsedLessonId)) {
    return NextResponse.json({ error: 'Invalid lesson ID' }, { status: 400 });
  }

  try {
    const deleted = await deleteLesson(parsedLessonId);
    if (!deleted) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /admin/education/courses/[id]/lessons/[lessonId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
