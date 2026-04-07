import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import pool from '@/lib/db';
import {
  getAssessmentWithQuestions,
  getLastAttempt,
  recordAssessmentAttempt,
  getOrCreateLearnerProfile,
  updateSkillScores,
  markLessonComplete,
  getCourseProgressForMember,
  upsertCourseProgress,
  getLessonsByCourse,
  issueCertificate,
  getCategoryById,
  getCourseById,
  getPrerequisitesForCourse,
  getCoursesByCategory,
} from '@/lib/education/db';
import { scoreAssessment, canRetakeAssessment, aggregateSkillScores } from '@/lib/education/assessment-engine';
import { generateRecommendations } from '@/lib/education/recommendation-engine';
import type { SubmitAssessmentRequest, SubmitAssessmentResponse } from '@/lib/education/types';

export async function POST(
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

  const body = await request.json().catch(() => null) as SubmitAssessmentRequest | null;
  if (!body?.answers || typeof body.answers !== 'object') {
    return NextResponse.json({ error: 'Answers object is required' }, { status: 400 });
  }

  try {
    // 1. Get member
    const memberRes = await pool.query(
      'SELECT id, full_name FROM members WHERE user_id = $1 LIMIT 1',
      [auth.userId],
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }
    const memberId = memberRes.rows[0].id as number;
    const memberName = (memberRes.rows[0].full_name as string) || 'Member';

    // 2. Get assessment with questions
    const assessment = await getAssessmentWithQuestions(assessmentId);
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // 3. Check re-attempt policy
    const lastAttempt = await getLastAttempt(memberId, assessmentId);
    const canRetake = canRetakeAssessment(assessment.type, lastAttempt?.attempted_at ?? null);
    if (!canRetake) {
      return NextResponse.json({ error: 'Retake not allowed yet' }, { status: 429 });
    }

    // 4. Score the assessment
    const scoring = scoreAssessment(assessment.questions, body.answers);
    const passed = scoring.score >= assessment.passing_score;

    // 5. Record the attempt
    await recordAssessmentAttempt({
      member_id: memberId,
      assessment_id: assessmentId,
      score: scoring.score,
      answers: body.answers,
      passed,
    });

    // 6. Aggregate skill scores
    const skillScores = aggregateSkillScores(scoring.results);

    // 7. Update learner profile
    await getOrCreateLearnerProfile(memberId);
    await updateSkillScores(memberId, skillScores);

    // 8. Handle lesson_check: update course progress
    if (assessment.type === 'lesson_check' && assessment.lesson_id && passed) {
      await markLessonComplete(memberId, assessment.lesson_id);

      // Find the course for this lesson
      const lessonRes = await pool.query(
        'SELECT course_id FROM edu_lessons WHERE id = $1',
        [assessment.lesson_id],
      );
      if (lessonRes.rows.length > 0) {
        const courseId = lessonRes.rows[0].course_id as number;
        const progress = await getCourseProgressForMember(memberId, courseId);

        if (progress.status === 'not_started') {
          await upsertCourseProgress(memberId, courseId, 'in_progress');
        }

        // Check if all lessons are done
        if (progress.completed + 1 >= progress.total && progress.total > 0) {
          await upsertCourseProgress(memberId, courseId, 'completed');
        }
      }
    }

    // 9. Handle final_exam: issue certificate if passed
    let certificate = null;
    if (assessment.type === 'final_exam' && passed && assessment.category_id) {
      const category = await getCategoryById(assessment.category_id);
      if (category) {
        try {
          certificate = await issueCertificate(
            memberId,
            assessment.category_id,
            memberName,
            category.name,
          );
        } catch (certErr) {
          // Certificate may already exist (unique constraint) - not a fatal error
          console.warn('Certificate issuance note:', certErr);
        }
      }
    }

    // 10. Generate recommendations
    let recommendations: SubmitAssessmentResponse['recommendations'] = [];
    try {
      // Get updated learner profile for recommendations
      const profile = await getOrCreateLearnerProfile(memberId);

      // Get all published courses with prerequisites
      const categoryId = assessment.category_id;
      if (categoryId) {
        const courses = await getCoursesByCategory(categoryId, true);
        const coursesWithPrereqs = await Promise.all(
          courses.map(async c => ({
            id: c.id,
            title: c.title,
            prerequisites: await getPrerequisitesForCourse(c.id),
          })),
        );

        // Get completed course IDs
        const completedRes = await pool.query(
          `SELECT course_id FROM edu_course_progress WHERE member_id = $1 AND status = 'completed'`,
          [memberId],
        );
        const completedCourseIds = completedRes.rows.map((r: { course_id: number }) => r.course_id);

        const recs = generateRecommendations(
          coursesWithPrereqs,
          profile.skill_scores,
          completedCourseIds,
        );

        recommendations = recs.map(r => ({
          id: 0,
          member_id: memberId,
          recommended_course_id: r.course_id,
          reason: `Improve ${r.weak_skill} (current: ${r.current_score}%, needed: ${r.required_score}%)`,
          skill_tag: r.weak_skill,
          priority: r.required_score - r.current_score,
          dismissed: false,
          created_at: new Date().toISOString(),
        }));
      }
    } catch (recErr) {
      console.warn('Recommendation generation note:', recErr);
    }

    // Build response with explanations
    const response: SubmitAssessmentResponse = {
      score: scoring.score,
      passed,
      total_questions: scoring.total_questions,
      correct_count: scoring.correct_count,
      results: scoring.results.map(r => {
        const question = assessment.questions.find(q => q.id === r.question_id);
        return {
          question_id: r.question_id,
          correct: r.correct,
          correct_option: r.correct_option,
          selected_option: r.selected_option,
          explanation: question?.explanation ?? null,
        };
      }),
      skill_scores: skillScores,
      recommendations,
    };

    if (certificate) {
      return NextResponse.json({ ...response, certificate });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Assessment submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
