import pool from '@/lib/db';
import type {
  EduCategory, EduCourse, EduLesson, EduAssessment,
  EduAssessmentQuestion, EduLearnerProfile, EduCourseProgress,
  EduLessonProgress, EduAssessmentAttempt, EduCertificate,
  EduLearningRecommendation, EduCoursePrerequisite,
} from './types';

// --- Categories ---

export async function getCategoriesPublished(): Promise<(EduCategory & { course_count: number; total_duration: number })[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT c.*,
        COUNT(DISTINCT co.id)::int AS course_count,
        COALESCE(SUM(co.estimated_duration_minutes), 0)::int AS total_duration
      FROM edu_categories c
      LEFT JOIN edu_courses co ON co.category_id = c.id AND co.is_published = true
      WHERE c.is_published = true
      GROUP BY c.id
      ORDER BY c.display_order, c.name
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getCategoryById(id: number): Promise<EduCategory | null> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM edu_categories WHERE id = $1', [id]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function createCategory(data: Pick<EduCategory, 'name' | 'description' | 'image_url' | 'pass_threshold' | 'display_order'>): Promise<EduCategory> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO edu_categories (name, description, image_url, pass_threshold, display_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.description, data.image_url, data.pass_threshold || 70, data.display_order || 0]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateCategory(id: number, data: Partial<EduCategory>): Promise<EduCategory | null> {
  const client = await pool.connect();
  try {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (['name', 'description', 'image_url', 'pass_threshold', 'display_order', 'is_published'].includes(key)) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (fields.length === 0) return getCategoryById(id);
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const result = await client.query(
      `UPDATE edu_categories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function deleteCategory(id: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM edu_categories WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

// --- Courses ---

export async function getCoursesByCategory(categoryId: number, publishedOnly = true): Promise<(EduCourse & { lesson_count: number; total_duration: number })[]> {
  const client = await pool.connect();
  try {
    const publishedClause = publishedOnly ? 'AND co.is_published = true' : '';
    const result = await client.query(`
      SELECT co.*,
        COUNT(DISTINCT l.id)::int AS lesson_count,
        COALESCE(SUM(l.duration_minutes), 0)::int AS total_duration
      FROM edu_courses co
      LEFT JOIN edu_lessons l ON l.course_id = co.id
      WHERE co.category_id = $1 ${publishedClause}
      GROUP BY co.id
      ORDER BY co.display_order, co.title
    `, [categoryId]);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getCourseById(id: number): Promise<EduCourse | null> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM edu_courses WHERE id = $1', [id]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function createCourse(data: Omit<EduCourse, 'id' | 'created_at' | 'updated_at'>): Promise<EduCourse> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO edu_courses (category_id, title, description, difficulty_level, language, estimated_duration_minutes, display_order, source_document_url, is_published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [data.category_id, data.title, data.description, data.difficulty_level, data.language,
       data.estimated_duration_minutes, data.display_order || 0, data.source_document_url, data.is_published || false, data.created_by]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateCourse(id: number, data: Partial<EduCourse>): Promise<EduCourse | null> {
  const client = await pool.connect();
  try {
    const allowed = ['title', 'description', 'difficulty_level', 'language', 'estimated_duration_minutes', 'display_order', 'source_document_url', 'is_published', 'category_id'];
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (fields.length === 0) return getCourseById(id);
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const result = await client.query(
      `UPDATE edu_courses SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function deleteCourse(id: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM edu_courses WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

// --- Lessons ---

export async function getLessonsByCourse(courseId: number): Promise<EduLesson[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM edu_lessons WHERE course_id = $1 ORDER BY lesson_order',
      [courseId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getLessonById(id: number): Promise<EduLesson | null> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM edu_lessons WHERE id = $1', [id]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function createLesson(data: Omit<EduLesson, 'id' | 'created_at' | 'updated_at'>): Promise<EduLesson> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO edu_lessons (course_id, title, content, language, lesson_order, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.course_id, data.title, data.content, data.language || 'sw', data.lesson_order, data.duration_minutes || 15]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateLesson(id: number, data: Partial<EduLesson>): Promise<EduLesson | null> {
  const client = await pool.connect();
  try {
    const allowed = ['title', 'content', 'language', 'lesson_order', 'duration_minutes'];
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (fields.length === 0) return getLessonById(id);
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const result = await client.query(
      `UPDATE edu_lessons SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function deleteLesson(id: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM edu_lessons WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

// --- Assessments ---

export async function getAssessmentWithQuestions(assessmentId: number): Promise<(EduAssessment & { questions: EduAssessmentQuestion[] }) | null> {
  const client = await pool.connect();
  try {
    const aResult = await client.query('SELECT * FROM edu_assessments WHERE id = $1', [assessmentId]);
    if (aResult.rows.length === 0) return null;
    const qResult = await client.query(
      'SELECT * FROM edu_assessment_questions WHERE assessment_id = $1 ORDER BY question_order',
      [assessmentId]
    );
    return { ...aResult.rows[0], questions: qResult.rows };
  } finally {
    client.release();
  }
}

export async function getAssessmentByLessonId(lessonId: number): Promise<EduAssessment | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT * FROM edu_assessments WHERE lesson_id = $1 AND type = 'lesson_check'",
      [lessonId]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getAssessmentByCategoryAndType(categoryId: number, type: 'placement' | 'final_exam'): Promise<EduAssessment | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM edu_assessments WHERE category_id = $1 AND type = $2',
      [categoryId, type]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function createAssessment(data: Omit<EduAssessment, 'id' | 'created_at'>): Promise<EduAssessment> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO edu_assessments (category_id, lesson_id, type, title, passing_score)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.category_id, data.lesson_id, data.type, data.title, data.passing_score || 70]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function createAssessmentQuestion(data: Omit<EduAssessmentQuestion, 'id'>): Promise<EduAssessmentQuestion> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO edu_assessment_questions (assessment_id, scenario_text, options, correct_option, explanation, skill_tag, question_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.assessment_id, data.scenario_text, JSON.stringify(data.options), data.correct_option, data.explanation, data.skill_tag, data.question_order]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// --- Progress ---

export async function getOrCreateLearnerProfile(memberId: number): Promise<EduLearnerProfile> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO edu_learner_profiles (member_id)
       VALUES ($1)
       ON CONFLICT (member_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [memberId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateSkillScores(memberId: number, newScores: Record<string, number>): Promise<void> {
  const client = await pool.connect();
  try {
    // Merge new scores into existing using jsonb || operator
    await client.query(
      `UPDATE edu_learner_profiles
       SET skill_scores = skill_scores || $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE member_id = $2`,
      [JSON.stringify(newScores), memberId]
    );
  } finally {
    client.release();
  }
}

export async function markLessonComplete(memberId: number, lessonId: number): Promise<EduLessonProgress> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO edu_lesson_progress (member_id, lesson_id, completed, completed_at)
       VALUES ($1, $2, true, CURRENT_TIMESTAMP)
       ON CONFLICT (member_id, lesson_id)
       DO UPDATE SET completed = true, completed_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [memberId, lessonId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getCourseProgressForMember(memberId: number, courseId: number): Promise<{ completed: number; total: number; status: string }> {
  const client = await pool.connect();
  try {
    const totalResult = await client.query(
      'SELECT COUNT(*)::int AS total FROM edu_lessons WHERE course_id = $1',
      [courseId]
    );
    const completedResult = await client.query(
      `SELECT COUNT(*)::int AS completed FROM edu_lesson_progress lp
       JOIN edu_lessons l ON l.id = lp.lesson_id
       WHERE l.course_id = $1 AND lp.member_id = $2 AND lp.completed = true`,
      [courseId, memberId]
    );
    const progressResult = await client.query(
      'SELECT status FROM edu_course_progress WHERE member_id = $1 AND course_id = $2',
      [memberId, courseId]
    );
    return {
      completed: completedResult.rows[0]?.completed ?? 0,
      total: totalResult.rows[0]?.total ?? 0,
      status: progressResult.rows[0]?.status ?? 'not_started',
    };
  } finally {
    client.release();
  }
}

export async function upsertCourseProgress(memberId: number, courseId: number, status: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO edu_course_progress (member_id, course_id, status, started_at, completed_at)
       VALUES ($1, $2, $3,
         CASE WHEN $3 != 'not_started' THEN CURRENT_TIMESTAMP ELSE NULL END,
         CASE WHEN $3 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END)
       ON CONFLICT (member_id, course_id)
       DO UPDATE SET
         status = $3,
         started_at = COALESCE(edu_course_progress.started_at,
           CASE WHEN $3 != 'not_started' THEN CURRENT_TIMESTAMP ELSE NULL END),
         completed_at = CASE WHEN $3 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END`,
      [memberId, courseId, status]
    );
  } finally {
    client.release();
  }
}

export async function recordAssessmentAttempt(data: Omit<EduAssessmentAttempt, 'id' | 'attempted_at'>): Promise<EduAssessmentAttempt> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO edu_assessment_attempts (member_id, assessment_id, score, answers, passed)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.member_id, data.assessment_id, data.score, JSON.stringify(data.answers), data.passed]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getLastAttempt(memberId: number, assessmentId: number): Promise<EduAssessmentAttempt | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM edu_assessment_attempts WHERE member_id = $1 AND assessment_id = $2 ORDER BY attempted_at DESC LIMIT 1',
      [memberId, assessmentId]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getBestAttemptScore(memberId: number, assessmentId: number): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT MAX(score) AS best_score FROM edu_assessment_attempts WHERE member_id = $1 AND assessment_id = $2',
      [memberId, assessmentId]
    );
    return result.rows[0]?.best_score ?? 0;
  } finally {
    client.release();
  }
}

// --- Certificates ---

export async function issueCertificate(memberId: number, categoryId: number, memberName: string, categoryName: string): Promise<EduCertificate> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO edu_certificates (member_id, category_id, member_name, category_name)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [memberId, categoryId, memberName, categoryName]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getCertificatesForMember(memberId: number): Promise<EduCertificate[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM edu_certificates WHERE member_id = $1 ORDER BY issued_at DESC',
      [memberId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getCertificateByCredentialId(credentialId: string): Promise<EduCertificate | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM edu_certificates WHERE credential_id = $1',
      [credentialId]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

// --- Recommendations ---

export async function getRecommendationsForMember(memberId: number): Promise<(EduLearningRecommendation & { course_title: string })[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT r.*, c.title AS course_title
       FROM edu_learning_recommendations r
       JOIN edu_courses c ON c.id = r.recommended_course_id
       WHERE r.member_id = $1 AND r.dismissed = false
       ORDER BY r.priority DESC, r.created_at DESC`,
      [memberId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function createRecommendation(data: Omit<EduLearningRecommendation, 'id' | 'dismissed' | 'created_at'>): Promise<EduLearningRecommendation> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO edu_learning_recommendations (member_id, recommended_course_id, reason, skill_tag, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.member_id, data.recommended_course_id, data.reason, data.skill_tag, data.priority || 0]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function dismissRecommendation(id: number, memberId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'UPDATE edu_learning_recommendations SET dismissed = true WHERE id = $1 AND member_id = $2',
      [id, memberId]
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

// --- AI rate limiting ---

export async function checkAndIncrementAIUsage(memberId: number, dailyLimit: number = 20): Promise<{ allowed: boolean; remaining: number }> {
  const client = await pool.connect();
  try {
    // Ensure profile exists
    await client.query(
      `INSERT INTO edu_learner_profiles (member_id) VALUES ($1) ON CONFLICT (member_id) DO NOTHING`,
      [memberId]
    );
    // Atomic increment with date reset — avoids race conditions
    const result = await client.query(
      `UPDATE edu_learner_profiles SET
         daily_ai_interactions = CASE
           WHEN last_interaction_date = CURRENT_DATE THEN daily_ai_interactions + 1
           ELSE 1
         END,
         last_interaction_date = CURRENT_DATE,
         updated_at = CURRENT_TIMESTAMP
       WHERE member_id = $1
         AND (last_interaction_date < CURRENT_DATE OR last_interaction_date IS NULL OR daily_ai_interactions < $2)
       RETURNING daily_ai_interactions`,
      [memberId, dailyLimit]
    );
    if (result.rows.length === 0) {
      return { allowed: false, remaining: 0 };
    }
    const newCount = result.rows[0].daily_ai_interactions;
    return { allowed: true, remaining: dailyLimit - newCount };
  } finally {
    client.release();
  }
}

// --- Course prerequisites ---

export async function getPrerequisitesForCourse(courseId: number): Promise<EduCoursePrerequisite[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM edu_course_prerequisites WHERE course_id = $1',
      [courseId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function setPrerequisites(courseId: number, prereqs: { skill_tag: string; minimum_score: number }[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM edu_course_prerequisites WHERE course_id = $1', [courseId]);
    for (const p of prereqs) {
      await client.query(
        'INSERT INTO edu_course_prerequisites (course_id, skill_tag, minimum_score) VALUES ($1, $2, $3)',
        [courseId, p.skill_tag, p.minimum_score]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
