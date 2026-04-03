import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getAssessmentsAll, createAssessment } from '@/lib/education/db';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const assessments = await getAssessmentsAll();
    return NextResponse.json(assessments);
  } catch (err) {
    console.error('GET /admin/education/assessments error:', err);
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
    if (!body.type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    const assessment = await createAssessment({
      category_id: body.category_id ?? null,
      lesson_id: body.lesson_id ?? null,
      type: body.type,
      title: body.title ?? null,
      passing_score: body.passing_score ?? 70,
    });
    return NextResponse.json(assessment, { status: 201 });
  } catch (err) {
    console.error('POST /admin/education/assessments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
