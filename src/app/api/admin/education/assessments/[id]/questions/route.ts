import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getAssessmentQuestionsByAssessment, createAssessmentQuestion } from '@/lib/education/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const assessmentId = parseInt(id, 10);
  if (isNaN(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessment ID' }, { status: 400 });
  }

  try {
    const questions = await getAssessmentQuestionsByAssessment(assessmentId);
    return NextResponse.json(questions);
  } catch (err) {
    console.error('GET /admin/education/assessments/[id]/questions error:', err);
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
  const assessmentId = parseInt(id, 10);
  if (isNaN(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessment ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    if (!body.scenario_text || !body.options || !body.correct_option || !body.skill_tag) {
      return NextResponse.json(
        { error: 'scenario_text, options, correct_option, and skill_tag are required' },
        { status: 400 }
      );
    }

    const question = await createAssessmentQuestion({
      assessment_id: assessmentId,
      scenario_text: body.scenario_text,
      options: body.options,
      correct_option: body.correct_option,
      explanation: body.explanation ?? null,
      skill_tag: body.skill_tag,
      question_order: body.question_order ?? 0,
    });
    return NextResponse.json(question, { status: 201 });
  } catch (err) {
    console.error('POST /admin/education/assessments/[id]/questions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
