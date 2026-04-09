import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import pool from '@/lib/db';
import { getAssessmentWithQuestions, getLastAttempt } from '@/lib/education/db';
import { canRetakeAssessment } from '@/lib/education/assessment-engine';
import type { EduAssessmentQuestionPublic } from '@/lib/education/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = getAuthTokenPayload(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const assessmentId = Number(id);
  if (!Number.isFinite(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessment ID' }, { status: 400 });
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

    const assessment = await getAssessmentWithQuestions(assessmentId);
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Check re-attempt policy
    const lastAttempt = await getLastAttempt(memberId, assessmentId);
    const canRetake = canRetakeAssessment(assessment.type, lastAttempt?.attempted_at ?? null);

    if (!canRetake && lastAttempt) {
      // Calculate unlock time based on type
      const lastDate = new Date(lastAttempt.attempted_at);
      let unlockAt: Date;
      if (assessment.type === 'final_exam') {
        unlockAt = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);
      } else {
        // placement: 7 days
        unlockAt = new Date(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      return NextResponse.json({
        locked: true,
        unlock_at: unlockAt.toISOString(),
        assessment: {
          id: assessment.id,
          type: assessment.type,
          title: assessment.title,
          passing_score: assessment.passing_score,
        },
        last_score: lastAttempt.score,
        last_passed: lastAttempt.passed,
      });
    }

    // Strip correct_option and explanation from questions
    const publicQuestions: EduAssessmentQuestionPublic[] = assessment.questions.map(q => ({
      id: q.id,
      scenario_text: q.scenario_text,
      options: q.options,
      skill_tag: q.skill_tag,
      question_order: q.question_order,
    }));

    return NextResponse.json({
      locked: false,
      assessment: {
        id: assessment.id,
        type: assessment.type,
        title: assessment.title,
        passing_score: assessment.passing_score,
        category_id: assessment.category_id,
        lesson_id: assessment.lesson_id,
      },
      questions: publicQuestions,
    });
  } catch (error) {
    console.error('Education assessment GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
