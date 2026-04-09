import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getCoursesAll, getCoursesByCategory, createCourse } from '@/lib/education/db';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const categoryId = request.nextUrl.searchParams.get('category_id');
    if (categoryId) {
      const parsed = parseInt(categoryId, 10);
      if (isNaN(parsed)) {
        return NextResponse.json({ error: 'Invalid category_id' }, { status: 400 });
      }
      const courses = await getCoursesByCategory(parsed, false);
      return NextResponse.json(courses);
    }

    const courses = await getCoursesAll();
    return NextResponse.json(courses);
  } catch (err) {
    console.error('GET /admin/education/courses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!body.category_id || !body.title) {
      return NextResponse.json({ error: 'category_id and title are required' }, { status: 400 });
    }

    const course = await createCourse({
      category_id: body.category_id,
      title: body.title,
      description: body.description ?? null,
      difficulty_level: body.difficulty_level ?? 'beginner',
      language: body.language ?? 'sw',
      estimated_duration_minutes: body.estimated_duration_minutes ?? null,
      display_order: body.display_order ?? 0,
      source_document_url: body.source_document_url ?? null,
      is_published: body.is_published ?? false,
      created_by: auth.userId,
    });
    return NextResponse.json(course, { status: 201 });
  } catch (err) {
    console.error('POST /admin/education/courses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
