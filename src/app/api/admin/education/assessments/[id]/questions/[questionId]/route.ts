import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { updateAssessmentQuestion, deleteAssessmentQuestion } from '@/lib/education/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { questionId } = await params;
  const parsedQuestionId = parseInt(questionId, 10);
  if (isNaN(parsedQuestionId)) {
    return NextResponse.json({ error: 'Invalid question ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updated = await updateAssessmentQuestion(parsedQuestionId, body);
    if (!updated) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT /admin/education/assessments/[id]/questions/[questionId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { questionId } = await params;
  const parsedQuestionId = parseInt(questionId, 10);
  if (isNaN(parsedQuestionId)) {
    return NextResponse.json({ error: 'Invalid question ID' }, { status: 400 });
  }

  try {
    const deleted = await deleteAssessmentQuestion(parsedQuestionId);
    if (!deleted) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /admin/education/assessments/[id]/questions/[questionId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
