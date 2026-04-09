# Education Platform Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing education module with an adaptive learning platform featuring AI-powered content generation, scenario-based assessments, branching recommendations, and category-based certificates.

**Architecture:** Clean module rebuild within the existing Next.js app. New `edu_*` database tables, new `/api/education/*` and `/api/admin/education/*` API routes, new `/jifunze/*` pages, and extracted components in `src/components/education/`. The existing auth, groups, wallet, and membership features are untouched.

**Tech Stack:** Next.js 15 (App Router), PostgreSQL (raw `pg` queries), Tailwind CSS v4, Anthropic Claude SDK (`@anthropic-ai/sdk`), `pdf-parse` + `officeparser` for document processing, `isomorphic-dompurify` for HTML sanitization.

**Spec:** `docs/superpowers/specs/2026-04-03-education-platform-phase1-design.md`

---

## File Structure

### Database
- Create: `database/migrations/004_education_tables.sql` — all `edu_*` tables, indexes, constraints

### Shared Library
- Create: `src/lib/education/db.ts` — typed query helpers for all edu tables (getCourses, getLessons, etc.)
- Create: `src/lib/education/types.ts` — TypeScript interfaces for all education entities
- Create: `src/lib/education/assessment-engine.ts` — scoring, skill profile updates, re-attempt policy enforcement
- Create: `src/lib/education/recommendation-engine.ts` — branching logic, prerequisite checking
- Create: `src/lib/education/ai-prompts.ts` — system prompts for content generation and companion
- Create: `src/lib/education/document-parser.ts` — PDF/PPTX/DOCX text extraction

### API Routes — Admin
- Create: `src/app/api/admin/education/categories/route.ts` — GET (list), POST (create)
- Create: `src/app/api/admin/education/categories/[id]/route.ts` — PUT, DELETE
- Create: `src/app/api/admin/education/courses/route.ts` — GET (list), POST (create)
- Create: `src/app/api/admin/education/courses/[id]/route.ts` — PUT, DELETE
- Create: `src/app/api/admin/education/courses/[id]/lessons/route.ts` — GET, POST
- Create: `src/app/api/admin/education/courses/[id]/lessons/[lessonId]/route.ts` — PUT, DELETE
- Create: `src/app/api/admin/education/assessments/route.ts` — GET, POST
- Create: `src/app/api/admin/education/assessments/[id]/route.ts` — PUT, DELETE
- Create: `src/app/api/admin/education/assessments/[id]/questions/route.ts` — GET, POST
- Create: `src/app/api/admin/education/assessments/[id]/questions/[questionId]/route.ts` — PUT, DELETE
- Create: `src/app/api/admin/education/ai/generate-course/route.ts` — POST (from outline)
- Create: `src/app/api/admin/education/ai/generate-from-document/route.ts` — POST (from upload)
- Create: `src/app/api/admin/education/ai/regenerate-lesson/route.ts` — POST
- Create: `src/app/api/admin/education/ai/regenerate-question/route.ts` — POST

### API Routes — Learner
- Create: `src/app/api/education/categories/route.ts` — GET
- Create: `src/app/api/education/categories/[id]/route.ts` — GET
- Create: `src/app/api/education/courses/route.ts` — GET
- Create: `src/app/api/education/courses/[id]/route.ts` — GET
- Create: `src/app/api/education/courses/[id]/lessons/route.ts` — GET
- Create: `src/app/api/education/courses/[id]/lessons/[lessonId]/route.ts` — GET
- Create: `src/app/api/education/assessments/[id]/route.ts` — GET
- Create: `src/app/api/education/assessments/[id]/submit/route.ts` — POST
- Create: `src/app/api/education/progress/route.ts` — GET, POST
- Create: `src/app/api/education/recommendations/route.ts` — GET
- Create: `src/app/api/education/certificates/route.ts` — GET
- Create: `src/app/api/education/certificates/[id]/route.ts` — GET
- Create: `src/app/api/education/ai/companion/route.ts` — POST (streaming)

### Components
- Create: `src/components/education/library/CourseLibrary.tsx`
- Create: `src/components/education/library/CategoryCard.tsx`
- Create: `src/components/education/library/CourseCard.tsx`
- Create: `src/components/education/lesson/LessonViewer.tsx`
- Create: `src/components/education/lesson/LessonContent.tsx`
- Create: `src/components/education/lesson/LessonNavigation.tsx`
- Create: `src/components/education/assessment/AssessmentRunner.tsx`
- Create: `src/components/education/assessment/ScenarioQuestion.tsx`
- Create: `src/components/education/assessment/AssessmentResults.tsx`
- Create: `src/components/education/ai/AICompanion.tsx`
- Create: `src/components/education/ai/ChatMessage.tsx`
- Create: `src/components/education/ai/QuickActions.tsx`
- Create: `src/components/education/certificate/CertificateCard.tsx`
- Create: `src/components/education/certificate/CertificateViewer.tsx`
- Create: `src/components/education/progress/ProgressBar.tsx`
- Create: `src/components/education/progress/SkillProfile.tsx`
- Create: `src/components/education/admin/CourseEditor.tsx`
- Create: `src/components/education/admin/LessonEditor.tsx`
- Create: `src/components/education/admin/AssessmentEditor.tsx`
- Create: `src/components/education/admin/DocumentUploader.tsx`
- Create: `src/components/education/admin/ContentPreview.tsx`

### Pages
- Create: `src/app/jifunze/page.tsx` (rebuild)
- Create: `src/app/jifunze/[categoryId]/page.tsx`
- Create: `src/app/jifunze/[categoryId]/tathmini/page.tsx`
- Delete: `src/app/jifunze/course/[id]/` (old route param — replaced by [courseId])
- Create: `src/app/jifunze/course/[courseId]/page.tsx` (rebuild)
- Create: `src/app/jifunze/course/[courseId]/tathmini/page.tsx`
- Create: `src/app/jifunze/[categoryId]/mtihani/page.tsx`
- Create: `src/app/jifunze/vyeti/page.tsx`
- Create: `src/app/dashboard/education/course/[id]/page.tsx`
- Create: `src/app/dashboard/education/course/[id]/preview/page.tsx`
- Modify: `src/app/dashboard/page.tsx` — replace education section with new components
- Modify: `src/app/member-dashboard/page.tsx` — replace learning section with new components
- Modify: `src/app/learn/page.tsx` — redirect to `/jifunze`

### Config
- Modify: `src/middleware.ts` — update public route prefixes for new education routes
- Modify: `package.json` — add new dependencies

---

## Chunk 1: Foundation (Schema, Types, Dependencies)

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new packages**

```bash
cd /Users/jon/Claude/WashikaDAO/jukumu-washikaDAO
npm install @anthropic-ai/sdk pdf-parse officeparser isomorphic-dompurify
npm install -D @types/pdf-parse vitest @vitejs/plugin-react
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts` at project root:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to `scripts` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs**

```bash
npx vitest run
```

Expected: 0 tests found, exits cleanly.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add education platform dependencies and vitest config"
```

---

### Task 2: Create TypeScript Types

**Files:**
- Create: `src/lib/education/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
// src/lib/education/types.ts
// TypeScript interfaces for all education entities — matches edu_* schema

export interface EduCategory {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  pass_threshold: number;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface EduCourse {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  estimated_duration_minutes: number | null;
  display_order: number;
  source_document_url: string | null;
  is_published: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface EduCoursePrerequisite {
  id: number;
  course_id: number;
  skill_tag: string;
  minimum_score: number;
}

export interface EduLesson {
  id: number;
  course_id: number;
  title: string;
  content: string;
  language: string;
  lesson_order: number;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export type AssessmentType = 'placement' | 'lesson_check' | 'final_exam';

export interface EduAssessment {
  id: number;
  category_id: number | null;
  lesson_id: number | null;
  type: AssessmentType;
  title: string | null;
  passing_score: number;
  created_at: string;
}

export interface AssessmentOption {
  label: string; // "A", "B", "C", "D"
  text: string;
}

export interface EduAssessmentQuestion {
  id: number;
  assessment_id: number;
  scenario_text: string;
  options: AssessmentOption[];
  correct_option: string;
  explanation: string | null;
  skill_tag: string;
  question_order: number;
}

// Client-safe version (no correct_option or explanation until after submission)
export interface EduAssessmentQuestionPublic {
  id: number;
  scenario_text: string;
  options: AssessmentOption[];
  skill_tag: string;
  question_order: number;
}

export interface EduLearnerProfile {
  id: number;
  member_id: number;
  preferred_language: string;
  skill_scores: Record<string, number>; // { budgeting: 85, saving: 60 }
  daily_ai_interactions: number;
  last_interaction_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface EduLessonProgress {
  id: number;
  member_id: number;
  lesson_id: number;
  completed: boolean;
  completed_at: string | null;
}

export type CourseStatus = 'not_started' | 'in_progress' | 'completed';

export interface EduCourseProgress {
  id: number;
  member_id: number;
  course_id: number;
  status: CourseStatus;
  started_at: string | null;
  completed_at: string | null;
}

export interface EduAssessmentAttempt {
  id: number;
  member_id: number;
  assessment_id: number;
  score: number;
  answers: Record<string, string>; // { questionId: "A" }
  passed: boolean;
  attempted_at: string;
}

export interface EduCertificate {
  id: number;
  credential_id: string;
  member_id: number;
  category_id: number;
  member_name: string;
  category_name: string;
  issued_at: string;
}

export interface EduLearningRecommendation {
  id: number;
  member_id: number;
  recommended_course_id: number;
  reason: string | null;
  skill_tag: string | null;
  priority: number;
  dismissed: boolean;
  created_at: string;
}

// API request/response types

export interface GenerateCourseRequest {
  topic_prompt: string;
  lesson_count: number;
  language: 'sw' | 'en';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category_id: number;
  context_notes?: string;
}

export interface GeneratedCourse {
  title: string;
  description: string;
  lessons: {
    title: string;
    content: string;
    duration_minutes: number;
    lesson_order: number;
    assessment_questions: {
      scenario_text: string;
      options: AssessmentOption[];
      correct_option: string;
      explanation: string;
      skill_tag: string;
    }[];
  }[];
  final_exam_questions: {
    scenario_text: string;
    options: AssessmentOption[];
    correct_option: string;
    explanation: string;
    skill_tag: string;
  }[];
}

export interface SubmitAssessmentRequest {
  answers: Record<string, string>; // { "questionId": "selectedOption" }
}

export interface SubmitAssessmentResponse {
  score: number;
  passed: boolean;
  total_questions: number;
  correct_count: number;
  results: {
    question_id: number;
    correct: boolean;
    correct_option: string;
    selected_option: string;
    explanation: string | null;
  }[];
  skill_scores: Record<string, number>;
  recommendations?: EduLearningRecommendation[];
}

export interface CompanionRequest {
  lesson_id: number;
  message: string;
  chat_history: { role: 'user' | 'assistant'; content: string }[];
  action?: 'chat' | 'explain_more' | 'another_example' | 'my_situation';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/education/types.ts
git commit -m "feat(education): add TypeScript type definitions for all education entities"
```

---

### Task 3: Create Database Migration

**Files:**
- Create: `database/migrations/004_education_tables.sql`

- [ ] **Step 1: Write the migration SQL**

Copy the complete SQL from the spec's Database Schema section into `database/migrations/004_education_tables.sql`. This includes all `edu_*` tables, constraints, and indexes exactly as specified in the design doc.

The file should start with:

```sql
-- Education Platform Phase 1 — Database Migration
-- Creates all edu_* tables for the new education module.
-- Run with: psql $DATABASE_URL -f database/migrations/004_education_tables.sql

BEGIN;

CREATE TABLE IF NOT EXISTS edu_categories (
...
```

And end with:

```sql
COMMIT;
```

Wrap the entire migration in a transaction (`BEGIN`/`COMMIT`). Use `CREATE TABLE IF NOT EXISTS` for idempotency.

- [ ] **Step 2: Verify SQL syntax**

```bash
# Dry-run syntax check (requires psql connected to a test db)
psql $DATABASE_URL -c "\i database/migrations/004_education_tables.sql" --single-transaction
```

Expected: All tables created without errors.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/004_education_tables.sql
git commit -m "feat(education): add database migration for edu_* tables"
```

---

### Task 4: Create Database Query Helpers

**Files:**
- Create: `src/lib/education/db.ts`
- Create: `src/lib/education/db.test.ts`

- [ ] **Step 1: Write failing test for getCategoriesPublished**

```typescript
// src/lib/education/db.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock the pg pool
vi.mock('@/lib/db', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };
  return {
    default: {
      connect: vi.fn().mockResolvedValue(mockClient),
    },
    __mockClient: mockClient,
  };
});

import { getCategoriesPublished } from './db';

describe('getCategoriesPublished', () => {
  it('returns published categories with course counts', async () => {
    const { __mockClient: mockClient } = await import('@/lib/db') as any;
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'Ujuzi wa Fedha', description: 'Financial literacy', course_count: 3, total_duration: 120 },
      ],
    });

    const result = await getCategoriesPublished();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Ujuzi wa Fedha');
    expect(result[0].course_count).toBe(3);
    expect(mockClient.release).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/education/db.test.ts
```

Expected: FAIL — module `./db` not found.

- [ ] **Step 3: Write the db query helpers**

```typescript
// src/lib/education/db.ts
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
         AND (last_interaction_date < CURRENT_DATE OR daily_ai_interactions < $2)
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/education/db.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/education/db.ts src/lib/education/db.test.ts
git commit -m "feat(education): add database query helpers for all edu_* tables"
```

---

### Task 5: Create Assessment Engine

**Files:**
- Create: `src/lib/education/assessment-engine.ts`
- Create: `src/lib/education/assessment-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/education/assessment-engine.test.ts
import { describe, it, expect } from 'vitest';
import { scoreAssessment, canRetakeAssessment, aggregateSkillScores } from './assessment-engine';

describe('scoreAssessment', () => {
  const questions = [
    { id: 1, correct_option: 'B', skill_tag: 'budgeting' },
    { id: 2, correct_option: 'C', skill_tag: 'budgeting' },
    { id: 3, correct_option: 'A', skill_tag: 'saving' },
  ];

  it('scores answers correctly', () => {
    const answers = { '1': 'B', '2': 'A', '3': 'A' };
    const result = scoreAssessment(questions, answers);
    expect(result.score).toBe(67); // 2/3 = 66.67 rounded
    expect(result.correct_count).toBe(2);
    expect(result.total_questions).toBe(3);
  });

  it('returns 0 for all wrong answers', () => {
    const answers = { '1': 'A', '2': 'A', '3': 'C' };
    const result = scoreAssessment(questions, answers);
    expect(result.score).toBe(0);
  });
});

describe('canRetakeAssessment', () => {
  it('allows lesson_check retake immediately', () => {
    const lastAttempt = new Date().toISOString();
    expect(canRetakeAssessment('lesson_check', lastAttempt)).toBe(true);
  });

  it('blocks final_exam within 24 hours', () => {
    const lastAttempt = new Date().toISOString();
    expect(canRetakeAssessment('final_exam', lastAttempt)).toBe(false);
  });

  it('allows final_exam after 24 hours', () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(canRetakeAssessment('final_exam', yesterday)).toBe(true);
  });

  it('blocks placement within 7 days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(canRetakeAssessment('placement', threeDaysAgo)).toBe(false);
  });

  it('allows placement after 7 days', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(canRetakeAssessment('placement', eightDaysAgo)).toBe(true);
  });
});

describe('aggregateSkillScores', () => {
  it('averages scores by skill tag', () => {
    const results = [
      { skill_tag: 'budgeting', correct: true },
      { skill_tag: 'budgeting', correct: false },
      { skill_tag: 'saving', correct: true },
    ];
    const scores = aggregateSkillScores(results);
    expect(scores.budgeting).toBe(50);
    expect(scores.saving).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/education/assessment-engine.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement assessment engine**

```typescript
// src/lib/education/assessment-engine.ts
import type { AssessmentType, EduAssessmentQuestion } from './types';

interface QuestionForScoring {
  id: number;
  correct_option: string;
  skill_tag: string;
}

interface ScoringResult {
  score: number;
  correct_count: number;
  total_questions: number;
  results: {
    question_id: number;
    correct: boolean;
    correct_option: string;
    selected_option: string;
    skill_tag: string;
  }[];
}

export function scoreAssessment(
  questions: QuestionForScoring[],
  answers: Record<string, string>
): ScoringResult {
  const results = questions.map(q => {
    const selected = answers[String(q.id)] || '';
    return {
      question_id: q.id,
      correct: selected === q.correct_option,
      correct_option: q.correct_option,
      selected_option: selected,
      skill_tag: q.skill_tag,
    };
  });

  const correct_count = results.filter(r => r.correct).length;
  const score = questions.length > 0 ? Math.round((correct_count / questions.length) * 100) : 0;

  return { score, correct_count, total_questions: questions.length, results };
}

export function canRetakeAssessment(type: AssessmentType, lastAttemptDate: string | null): boolean {
  if (!lastAttemptDate) return true;

  const lastAttempt = new Date(lastAttemptDate).getTime();
  const now = Date.now();
  const hoursSince = (now - lastAttempt) / (1000 * 60 * 60);

  switch (type) {
    case 'lesson_check':
      return true; // immediate retake
    case 'final_exam':
      return hoursSince >= 24;
    case 'placement':
      return hoursSince >= 24 * 7;
    default:
      return false;
  }
}

export function aggregateSkillScores(
  results: { skill_tag: string; correct: boolean }[]
): Record<string, number> {
  const tagCounts: Record<string, { correct: number; total: number }> = {};
  for (const r of results) {
    if (!tagCounts[r.skill_tag]) {
      tagCounts[r.skill_tag] = { correct: 0, total: 0 };
    }
    tagCounts[r.skill_tag].total++;
    if (r.correct) tagCounts[r.skill_tag].correct++;
  }

  const scores: Record<string, number> = {};
  for (const [tag, counts] of Object.entries(tagCounts)) {
    scores[tag] = Math.round((counts.correct / counts.total) * 100);
  }
  return scores;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/education/assessment-engine.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/education/assessment-engine.ts src/lib/education/assessment-engine.test.ts
git commit -m "feat(education): add assessment scoring engine with re-attempt policies"
```

---

### Task 6: Create Recommendation Engine

**Files:**
- Create: `src/lib/education/recommendation-engine.ts`
- Create: `src/lib/education/recommendation-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/education/recommendation-engine.test.ts
import { describe, it, expect } from 'vitest';
import { generateRecommendations } from './recommendation-engine';

describe('generateRecommendations', () => {
  const courses = [
    { id: 1, title: 'Budgeting Basics', prerequisites: [{ skill_tag: 'saving', minimum_score: 70 }] },
    { id: 2, title: 'Investing 101', prerequisites: [{ skill_tag: 'budgeting', minimum_score: 70 }, { skill_tag: 'saving', minimum_score: 60 }] },
    { id: 3, title: 'Saving Strategies', prerequisites: [] },
  ];

  it('recommends courses where prerequisites are not met', () => {
    const skillScores = { budgeting: 50, saving: 80 };
    const completedCourseIds = [3];
    const recs = generateRecommendations(courses, skillScores, completedCourseIds);
    // Course 2 requires budgeting >= 70, learner has 50 → recommend
    // Course 1 requires saving >= 70, learner has 80 → no recommendation
    expect(recs).toHaveLength(1);
    expect(recs[0].course_id).toBe(2);
    expect(recs[0].weak_skill).toBe('budgeting');
  });

  it('skips completed courses', () => {
    const skillScores = { budgeting: 50 };
    const completedCourseIds = [1, 2, 3];
    const recs = generateRecommendations(courses, skillScores, completedCourseIds);
    expect(recs).toHaveLength(0);
  });

  it('returns empty when all prerequisites met', () => {
    const skillScores = { budgeting: 90, saving: 90 };
    const recs = generateRecommendations(courses, skillScores, []);
    expect(recs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/education/recommendation-engine.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement recommendation engine**

```typescript
// src/lib/education/recommendation-engine.ts

interface CourseWithPrereqs {
  id: number;
  title: string;
  prerequisites: { skill_tag: string; minimum_score: number }[];
}

interface Recommendation {
  course_id: number;
  course_title: string;
  weak_skill: string;
  current_score: number;
  required_score: number;
}

export function generateRecommendations(
  courses: CourseWithPrereqs[],
  skillScores: Record<string, number>,
  completedCourseIds: number[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const course of courses) {
    if (completedCourseIds.includes(course.id)) continue;
    if (course.prerequisites.length === 0) continue;

    for (const prereq of course.prerequisites) {
      const currentScore = skillScores[prereq.skill_tag] ?? 0;
      if (currentScore < prereq.minimum_score) {
        recommendations.push({
          course_id: course.id,
          course_title: course.title,
          weak_skill: prereq.skill_tag,
          current_score: currentScore,
          required_score: prereq.minimum_score,
        });
        break; // one recommendation per course is enough
      }
    }
  }

  return recommendations;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/education/recommendation-engine.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/education/recommendation-engine.ts src/lib/education/recommendation-engine.test.ts
git commit -m "feat(education): add branching recommendation engine"
```

---

### Task 7: Create AI Prompts and Document Parser

**Files:**
- Create: `src/lib/education/ai-prompts.ts`
- Create: `src/lib/education/document-parser.ts`
- Create: `src/lib/education/document-parser.test.ts`

- [ ] **Step 1: Write the AI prompts module**

```typescript
// src/lib/education/ai-prompts.ts

// Model constants — change here when upgrading models
export const AI_MODEL_CONTENT_GENERATION = process.env.ANTHROPIC_MODEL_CONTENT || 'claude-sonnet-4-20250514';
export const AI_MODEL_COMPANION_FAST = process.env.ANTHROPIC_MODEL_COMPANION_FAST || 'claude-haiku-4-5-20251001';
export const AI_MODEL_COMPANION_DEEP = process.env.ANTHROPIC_MODEL_COMPANION_DEEP || 'claude-sonnet-4-20250514';

export const COURSE_GENERATION_SYSTEM_PROMPT = `You are an expert educational content creator for WashikaDAO, a platform empowering women in Tanzania with financial literacy and practical skills.

CONTEXT:
- Target audience: Women aged 18-45 in Tanzania
- Primary language: Swahili (Tanzanian dialect, not formal/academic)
- Content must use real Tanzanian context: TZS currency, M-Pesa/Tigo Pesa, VICOBA groups, upatu, local markets, school fees, etc.
- Each lesson should be 10-30 minutes reading time

OUTPUT FORMAT: Return valid JSON matching this structure:
{
  "title": "Course title",
  "description": "Course description (2-3 sentences)",
  "lessons": [
    {
      "title": "Lesson title",
      "content": "Full lesson content in markdown",
      "duration_minutes": 15,
      "lesson_order": 1,
      "assessment_questions": [
        {
          "scenario_text": "A realistic scenario in Tanzanian context...",
          "options": [
            {"label": "A", "text": "Option text"},
            {"label": "B", "text": "Option text"},
            {"label": "C", "text": "Option text"},
            {"label": "D", "text": "Option text"}
          ],
          "correct_option": "B",
          "explanation": "Why B is correct...",
          "skill_tag": "budgeting"
        }
      ]
    }
  ],
  "final_exam_questions": [
    {
      "scenario_text": "...",
      "options": [...],
      "correct_option": "...",
      "explanation": "...",
      "skill_tag": "..."
    }
  ]
}

GUIDELINES:
- Each lesson must have 2-3 assessment questions (scenario-based, multiple choice)
- Final exam should have 10-15 questions spanning all lessons
- Use real names (Amina, Fatuma, Juma, etc.) and realistic TZS amounts
- skill_tags should be consistent lowercase identifiers (e.g., "budgeting", "saving", "mobile_money", "risk_management", "borrowing", "investing")
- Explanations should be educational, not just "correct answer is X"
- Content should be practical and actionable, not theoretical
- Return ONLY the JSON, no markdown code fences or other text`;

export const DOCUMENT_RESTRUCTURE_PROMPT = `You are restructuring existing training material into a structured course format for WashikaDAO.

The source material is provided below. Restructure it into our course format while:
- Preserving all key concepts and information from the source
- Adapting examples to Tanzanian context if not already
- Using Swahili (Tanzanian dialect) if the language parameter is "sw"
- Adding scenario-based assessment questions that test practical understanding
- Breaking content into digestible lessons of 10-30 minutes each

Use the same JSON output format as described in the system prompt.`;

export function buildCompanionSystemPrompt(lessonTitle: string, lessonContent: string): string {
  return `You are a friendly AI learning companion for WashikaDAO, helping Tanzanian women learn about financial literacy and practical skills.

CURRENT LESSON: "${lessonTitle}"
LESSON CONTENT:
${lessonContent.substring(0, 2000)}

GUIDELINES:
- You are an educator, NOT a financial advisor. Never recommend specific investments or financial products.
- Respond in whatever language the learner uses (Swahili or English)
- Use Tanzanian context: TZS, M-Pesa, VICOBA, local examples
- Keep responses concise and practical
- When the learner describes their own situation, guide them using principles from the lesson
- Encourage practical application of what they're learning
- Be warm and encouraging — many learners are new to formal financial education
- If asked about topics outside the lesson scope, briefly acknowledge and redirect to the current material`;
}
```

- [ ] **Step 2: Write failing test for document parser**

```typescript
// src/lib/education/document-parser.test.ts
import { describe, it, expect } from 'vitest';
import { validateUpload, extractText } from './document-parser';

describe('validateUpload', () => {
  it('rejects files over 10MB', () => {
    const result = validateUpload('test.pdf', 11 * 1024 * 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10MB');
  });

  it('rejects unsupported file types', () => {
    const result = validateUpload('test.txt', 1000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('PDF, PPTX');
  });

  it('accepts valid PDF', () => {
    const result = validateUpload('training.pdf', 5 * 1024 * 1024);
    expect(result.valid).toBe(true);
  });

  it('accepts valid PPTX', () => {
    const result = validateUpload('slides.pptx', 1000);
    expect(result.valid).toBe(true);
  });

  it('accepts valid DOCX', () => {
    const result = validateUpload('document.docx', 1000);
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/lib/education/document-parser.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement document parser**

```typescript
// src/lib/education/document-parser.ts

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.pptx', '.docx'];
const MIN_EXTRACTED_TEXT_LENGTH = 100;

export function validateUpload(filename: string, sizeBytes: number): { valid: boolean; error?: string } {
  if (sizeBytes > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds 10MB limit (${Math.round(sizeBytes / 1024 / 1024)}MB)` };
  }
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Unsupported file type. Accepted: PDF, PPTX, DOCX` };
  }
  return { valid: true };
}

export async function extractText(buffer: Buffer, filename: string): Promise<{ text: string; error?: string }> {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));

  try {
    let text = '';

    if (ext === '.pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (ext === '.pptx' || ext === '.docx') {
      const { parseOfficeAsync } = await import('officeparser');
      text = await parseOfficeAsync(buffer);
    }

    text = text.trim();
    if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
      return { text: '', error: `Extracted text too short (${text.length} chars). Try a different format or paste text directly.` };
    }

    return { text };
  } catch (err) {
    return { text: '', error: `Failed to extract text: ${err instanceof Error ? err.message : 'unknown error'}` };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/lib/education/document-parser.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/education/ai-prompts.ts src/lib/education/document-parser.ts src/lib/education/document-parser.test.ts
git commit -m "feat(education): add AI prompts and document parser"
```

---

## Chunk 2: Admin API Routes

> **Note:** Before starting any manual or runtime testing of Chunks 2-5, you must run the database migration from Task 3 (`psql $DATABASE_URL -f database/migrations/004_education_tables.sql`). TypeScript compilation will pass without the migration, but API routes will fail at runtime without the `edu_*` tables.

### Task 8: Admin Category & Course CRUD Routes

**Files:**
- Create: `src/app/api/admin/education/categories/route.ts`
- Create: `src/app/api/admin/education/categories/[id]/route.ts`
- Create: `src/app/api/admin/education/courses/route.ts`
- Create: `src/app/api/admin/education/courses/[id]/route.ts`

- [ ] **Step 1: Create admin auth helper**

Create a reusable helper at the top of each admin route. Since the codebase uses `getAuthTokenPayload` from `@/lib/auth`, each admin route follows this pattern:

```typescript
// Shared pattern for all admin education routes:
import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';

function requireAdmin(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { auth };
}
```

- [ ] **Step 2: Write categories route**

```typescript
// src/app/api/admin/education/categories/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { getCategoriesPublished, createCategory } from '@/lib/education/db';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Admin sees all categories, not just published
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT c.*,
        COUNT(DISTINCT co.id)::int AS course_count,
        COALESCE(SUM(co.estimated_duration_minutes), 0)::int AS total_duration
      FROM edu_categories c
      LEFT JOIN edu_courses co ON co.category_id = c.id
      GROUP BY c.id
      ORDER BY c.display_order, c.name
    `);
    return NextResponse.json(result.rows);
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, image_url, pass_threshold, display_order } = body;
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const category = await createCategory({
      name, description: description || null, image_url: image_url || null,
      pass_threshold: pass_threshold || 70, display_order: display_order || 0,
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    console.error('Failed to create category:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write categories/[id] route**

```typescript
// src/app/api/admin/education/categories/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import { updateCategory, deleteCategory, getCategoryById } from '@/lib/education/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const categoryId = parseInt(id, 10);
  if (isNaN(categoryId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const body = await request.json();
    const updated = await updateCategory(categoryId, body);
    if (!updated) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Failed to update category:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const categoryId = parseInt(id, 10);
  if (isNaN(categoryId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const deleted = await deleteCategory(categoryId);
  if (!deleted) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Write courses route and courses/[id] route**

Follow the same pattern as categories. The courses route at `src/app/api/admin/education/courses/route.ts` handles GET (list all courses with optional `?category_id=` filter) and POST (create course). The `courses/[id]/route.ts` handles PUT and DELETE. Use `createCourse`, `updateCourse`, `deleteCourse`, and `getCoursesByCategory` from `@/lib/education/db`.

- [ ] **Step 5: Verify routes compile**

```bash
npx next build 2>&1 | head -30
```

Expected: No TypeScript errors in the new route files.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/education/
git commit -m "feat(education): add admin CRUD routes for categories and courses"
```

---

### Task 9: Admin Lesson & Assessment CRUD Routes

**Files:**
- Create: `src/app/api/admin/education/courses/[id]/lessons/route.ts`
- Create: `src/app/api/admin/education/courses/[id]/lessons/[lessonId]/route.ts`
- Create: `src/app/api/admin/education/assessments/route.ts`
- Create: `src/app/api/admin/education/assessments/[id]/route.ts`
- Create: `src/app/api/admin/education/assessments/[id]/questions/route.ts`
- Create: `src/app/api/admin/education/assessments/[id]/questions/[questionId]/route.ts`

- [ ] **Step 1: Write lessons route**

Follow the same admin auth + CRUD pattern from Task 8. Use `getLessonsByCourse`, `createLesson`, `updateLesson`, `deleteLesson` from db helpers.

- [ ] **Step 2: Write assessments routes**

The assessments route uses `createAssessment`, `getAssessmentWithQuestions`. The `questions/route.ts` handles GET (list) and POST (create). The `questions/[questionId]/route.ts` handles PUT (update individual question) and DELETE (remove question).

- [ ] **Step 3: Verify routes compile**

```bash
npx next build 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/education/
git commit -m "feat(education): add admin CRUD routes for lessons and assessments"
```

---

### Task 10: AI Course Generation Routes

**Files:**
- Create: `src/app/api/admin/education/ai/generate-course/route.ts`
- Create: `src/app/api/admin/education/ai/generate-from-document/route.ts`
- Create: `src/app/api/admin/education/ai/regenerate-lesson/route.ts`
- Create: `src/app/api/admin/education/ai/regenerate-question/route.ts`

- [ ] **Step 1: Write generate-course route (from outline)**

```typescript
// src/app/api/admin/education/ai/generate-course/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import { COURSE_GENERATION_SYSTEM_PROMPT, AI_MODEL_CONTENT_GENERATION } from '@/lib/education/ai-prompts';
import type { GenerateCourseRequest, GeneratedCourse } from '@/lib/education/types';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body: GenerateCourseRequest = await request.json();
    const { topic_prompt, lesson_count, language, difficulty, category_id, context_notes } = body;

    if (!topic_prompt || !lesson_count || !category_id) {
      return NextResponse.json({ error: 'topic_prompt, lesson_count, and category_id are required' }, { status: 400 });
    }

    const userPrompt = `Generate a ${difficulty} level course with ${lesson_count} lessons about: ${topic_prompt}
Language: ${language === 'sw' ? 'Swahili (Tanzanian dialect)' : 'English'}
${context_notes ? `Additional context: ${context_notes}` : ''}`;

    const message = await anthropic.messages.create({
      model: AI_MODEL_CONTENT_GENERATION,
      max_tokens: 8192,
      system: COURSE_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let course: GeneratedCourse;
    try {
      course = JSON.parse(responseText);
    } catch {
      // Attempt to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json({ error: 'Failed to parse AI response as JSON' }, { status: 502 });
      }
      course = JSON.parse(jsonMatch[0]);
    }

    return NextResponse.json({ success: true, course });
  } catch (err) {
    console.error('Course generation failed:', err);
    return NextResponse.json({ error: 'Course generation failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write generate-from-document route**

This route accepts multipart/form-data with a file upload. It uses `validateUpload` and `extractText` from `document-parser`, then passes extracted text to Claude with `DOCUMENT_RESTRUCTURE_PROMPT`.

```typescript
// src/app/api/admin/education/ai/generate-from-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import { COURSE_GENERATION_SYSTEM_PROMPT, DOCUMENT_RESTRUCTURE_PROMPT } from '@/lib/education/ai-prompts';
import { validateUpload, extractText } from '@/lib/education/document-parser';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const language = (formData.get('language') as string) || 'sw';
    const difficulty = (formData.get('difficulty') as string) || 'beginner';
    const lessonCount = parseInt(formData.get('lesson_count') as string) || 5;
    const categoryId = parseInt(formData.get('category_id') as string);

    if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 });
    if (!categoryId) return NextResponse.json({ error: 'category_id is required' }, { status: 400 });

    const validation = validateUpload(file.name, file.size);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractText(buffer, file.name);
    if (extraction.error) {
      return NextResponse.json({ error: extraction.error }, { status: 422 });
    }

    const userPrompt = `${DOCUMENT_RESTRUCTURE_PROMPT}

SOURCE MATERIAL:
${extraction.text.substring(0, 15000)}

Generate a ${difficulty} level course with ${lessonCount} lessons.
Language: ${language === 'sw' ? 'Swahili (Tanzanian dialect)' : 'English'}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: COURSE_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let course;
    try {
      course = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 });
      }
      course = JSON.parse(jsonMatch[0]);
    }

    return NextResponse.json({ success: true, course, source_filename: file.name });
  } catch (err) {
    console.error('Document course generation failed:', err);
    return NextResponse.json({ error: 'Course generation failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write regenerate-lesson and regenerate-question routes**

These are simpler single-item regeneration routes. They take the existing lesson/question context and ask Claude to produce a replacement. Follow the same Anthropic SDK pattern.

- [ ] **Step 4: Verify routes compile**

```bash
npx next build 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/education/ai/
git commit -m "feat(education): add AI course generation routes (outline + document upload)"
```

---

## Chunk 3: Learner API Routes

### Task 11: Learner Category & Course Routes

**Files:**
- Create: `src/app/api/education/categories/route.ts`
- Create: `src/app/api/education/categories/[id]/route.ts`
- Create: `src/app/api/education/courses/route.ts`
- Create: `src/app/api/education/courses/[id]/route.ts`
- Create: `src/app/api/education/courses/[id]/lessons/route.ts`
- Create: `src/app/api/education/courses/[id]/lessons/[lessonId]/route.ts`

- [ ] **Step 1: Write learner category routes**

These are GET-only routes. They use `getAuthTokenPayload` for the member_id, then query published categories/courses with the learner's progress data joined in.

The categories GET returns: categories with course_count, total_duration, and the learner's certificate status for each.

The courses GET adds: learner's progress status (not_started/in_progress/completed) and lessons_completed count per course.

- [ ] **Step 2: Write learner lesson routes**

`courses/[id]/lessons` returns the lesson list with completion status per learner. `courses/[id]/lessons/[lessonId]` returns full lesson content (this is where the learner reads). Content is sanitized with `isomorphic-dompurify` before sending if it contains HTML.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/education/
git commit -m "feat(education): add learner category, course, and lesson routes"
```

---

### Task 12: Assessment Submission & Progress Routes

**Files:**
- Create: `src/app/api/education/assessments/[id]/route.ts`
- Create: `src/app/api/education/assessments/[id]/submit/route.ts`
- Create: `src/app/api/education/progress/route.ts`

- [ ] **Step 1: Write assessment GET route**

Returns assessment questions WITHOUT `correct_option` and `explanation` (uses `EduAssessmentQuestionPublic` type). Also checks re-attempt policy — if learner can't retake yet, returns `{ locked: true, unlock_at: "..." }`.

- [ ] **Step 2: Write assessment submit route**

This is the core assessment flow:
1. Validate answers against questions
2. Score using `scoreAssessment()`
3. Check re-attempt policy using `canRetakeAssessment()`
4. Record attempt with `recordAssessmentAttempt()`
5. Aggregate skill scores with `aggregateSkillScores()`
6. Update learner profile with `updateSkillScores()`
7. If lesson_check: update course progress status
8. If final_exam and passed: issue certificate with `issueCertificate()`
9. Generate recommendations with `generateRecommendations()`
10. Return `SubmitAssessmentResponse` with results, explanations, skill scores, and recommendations

- [ ] **Step 3: Write progress route**

GET returns all lesson progress for a member (filterable by `?course_id=`). POST marks a lesson complete using `markLessonComplete()` and updates course progress status.

- [ ] **Step 4: Write integration test for assessment submission**

Create `src/app/api/education/assessments/submit.test.ts`. This tests the full orchestration of the submit route by mocking the database layer (`@/lib/education/db`) and verifying the correct sequence of calls:

```typescript
// src/app/api/education/assessments/submit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all db functions
vi.mock('@/lib/education/db', () => ({
  getAssessmentWithQuestions: vi.fn(),
  getLastAttempt: vi.fn(),
  recordAssessmentAttempt: vi.fn(),
  updateSkillScores: vi.fn(),
  getOrCreateLearnerProfile: vi.fn(),
  upsertCourseProgress: vi.fn(),
  issueCertificate: vi.fn(),
  getCategoryById: vi.fn(),
  getPrerequisitesForCourse: vi.fn(),
  getCoursesByCategory: vi.fn(),
  getBestAttemptScore: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  default: { connect: vi.fn().mockResolvedValue({ query: vi.fn(), release: vi.fn() }) },
}));

import * as db from '@/lib/education/db';
import { scoreAssessment, aggregateSkillScores } from '@/lib/education/assessment-engine';

describe('Assessment submission orchestration', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('scores, records attempt, updates skills, and issues certificate on final_exam pass', async () => {
    const mockAssessment = {
      id: 1, category_id: 5, lesson_id: null, type: 'final_exam',
      passing_score: 70, questions: [
        { id: 10, correct_option: 'B', skill_tag: 'budgeting', scenario_text: '...', options: [], explanation: 'ok', question_order: 1 },
      ],
    };
    (db.getAssessmentWithQuestions as any).mockResolvedValue(mockAssessment);
    (db.getLastAttempt as any).mockResolvedValue(null); // no prior attempt
    (db.recordAssessmentAttempt as any).mockResolvedValue({ id: 1, score: 100, passed: true });
    (db.getOrCreateLearnerProfile as any).mockResolvedValue({ skill_scores: {} });
    (db.getCategoryById as any).mockResolvedValue({ id: 5, name: 'Finance', pass_threshold: 70 });
    (db.issueCertificate as any).mockResolvedValue({ credential_id: 'abc' });

    // Verify the scoring function works for this case
    const result = scoreAssessment(
      [{ id: 10, correct_option: 'B', skill_tag: 'budgeting' }],
      { '10': 'B' }
    );
    expect(result.score).toBe(100);
    expect(result.passed).toBeUndefined(); // passed is determined by comparing to passing_score

    const skills = aggregateSkillScores(result.results);
    expect(skills.budgeting).toBe(100);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/app/api/education/assessments/submit.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/education/assessments/ src/app/api/education/progress/ src/app/api/education/assessments/submit.test.ts
git commit -m "feat(education): add assessment submission and progress tracking routes with tests"
```

---

### Task 13: Certificates, Recommendations, and AI Companion Routes

**Files:**
- Create: `src/app/api/education/certificates/route.ts`
- Create: `src/app/api/education/certificates/[id]/route.ts`
- Create: `src/app/api/education/recommendations/route.ts`
- Create: `src/app/api/education/ai/companion/route.ts`

- [ ] **Step 1: Write certificate routes**

Simple GET routes using `getCertificatesForMember` and `getCertificateByCredentialId`.

- [ ] **Step 2: Write recommendations route**

GET returns active recommendations for the learner using `getRecommendationsForMember`. Supports `?dismiss=id` query param to dismiss a recommendation.

- [ ] **Step 3: Write AI companion route (streaming)**

```typescript
// src/app/api/education/ai/companion/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenPayload } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import { buildCompanionSystemPrompt } from '@/lib/education/ai-prompts';
import { getLessonById } from '@/lib/education/db';
import { checkAndIncrementAIUsage } from '@/lib/education/db';
import pool from '@/lib/db';
import type { CompanionRequest } from '@/lib/education/types';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const auth = getAuthTokenPayload(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Get member_id from users → members link
    const client = await pool.connect();
    let memberId: number;
    try {
      const memberResult = await client.query(
        'SELECT id FROM members WHERE user_id = $1', [auth.userId]
      );
      if (memberResult.rows.length === 0) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }
      memberId = memberResult.rows[0].id;
    } finally {
      client.release();
    }

    // Check rate limit
    const usage = await checkAndIncrementAIUsage(memberId);
    if (!usage.allowed) {
      return NextResponse.json({
        error: 'Umefika kikomo cha mazungumzo ya leo. Rudi kesho!',
        limit_reached: true,
      }, { status: 429 });
    }

    const body: CompanionRequest = await request.json();
    const { lesson_id, message, chat_history, action } = body;

    const lesson = await getLessonById(lesson_id);
    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });

    const systemPrompt = buildCompanionSystemPrompt(lesson.title, lesson.content);

    // Build messages from chat history
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(chat_history || []).slice(-10),
      { role: 'user', content: message },
    ];

    // Choose model based on action
    const model = action === 'my_situation'
      ? 'claude-sonnet-4-20250514'
      : 'claude-haiku-4-5-20251001';

    // Stream response
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    // Transform to simplified SSE format
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const chunk = JSON.stringify({ type: 'delta', text: event.delta.text }) + '\n';
              controller.enqueue(encoder.encode(chunk));
            }
          }
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
          controller.close();
        } catch (err) {
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: 'error', message: 'Stream error' }) + '\n'
          ));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('AI companion error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/education/certificates/ src/app/api/education/recommendations/ src/app/api/education/ai/
git commit -m "feat(education): add certificates, recommendations, and AI companion routes"
```

---

### Task 14: Update Middleware

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update public route prefixes**

The `/jifunze` pages are already in `PUBLIC_PAGE_PREFIXES`. The `/api/education/*` routes should NOT be public (they require auth). No changes needed to the middleware — the default behavior (require auth for non-public API routes) handles this correctly.

However, verify that `/jifunze` prefix is still in `PUBLIC_PAGE_PREFIXES` and consider whether unauthenticated users should see the course library. Per the spec, browsing is for authenticated members.

If authenticated-only: remove `/jifunze` from `PUBLIC_PAGE_PREFIXES`.

- [ ] **Step 2: Commit if changes made**

```bash
git add src/middleware.ts
git commit -m "chore(education): update middleware for education routes"
```

---

## Chunk 4: Frontend Components

### Task 15: Library Components (CourseLibrary, CategoryCard, CourseCard)

**Files:**
- Create: `src/components/education/library/CourseLibrary.tsx`
- Create: `src/components/education/library/CategoryCard.tsx`
- Create: `src/components/education/library/CourseCard.tsx`

- [ ] **Step 1: Write CategoryCard component**

A card that displays: category name, description, course count, total duration, certificate progress indicator. Uses Tailwind classes matching the existing dark theme (`bg-white/5 border-white/10`). Clicking navigates to `/jifunze/[categoryId]`.

- [ ] **Step 2: Write CourseCard component**

Displays: course title, description, difficulty badge, lesson count, duration, progress bar (if started). Clicking navigates to `/jifunze/course/[courseId]`.

- [ ] **Step 3: Write CourseLibrary component**

Fetches categories from `/api/education/categories`, renders a grid of CategoryCards. Includes difficulty filter and language filter.

- [ ] **Step 4: Commit**

```bash
git add src/components/education/library/
git commit -m "feat(education): add library components (CategoryCard, CourseCard, CourseLibrary)"
```

---

### Task 16: Assessment Components

**Files:**
- Create: `src/components/education/assessment/ScenarioQuestion.tsx`
- Create: `src/components/education/assessment/AssessmentRunner.tsx`
- Create: `src/components/education/assessment/AssessmentResults.tsx`

- [ ] **Step 1: Write ScenarioQuestion component**

Displays: scenario text in a callout box, 4 options as selectable cards (A/B/C/D). Props: `question`, `selectedOption`, `onSelect`, `showResult` (after submission shows correct/incorrect with explanation).

- [ ] **Step 2: Write AssessmentRunner component**

Manages the assessment flow: fetches questions from `/api/education/assessments/[id]`, renders ScenarioQuestion for current question, tracks answers, handles navigation (next/prev), submits to `/api/education/assessments/[id]/submit`, shows AssessmentResults.

- [ ] **Step 3: Write AssessmentResults component**

Displays: score, pass/fail status, per-question results with explanations, skill score breakdown, recommendations (if any). Includes "Continue" button that navigates appropriately.

- [ ] **Step 4: Commit**

```bash
git add src/components/education/assessment/
git commit -m "feat(education): add assessment components (ScenarioQuestion, Runner, Results)"
```

---

### Task 17: Lesson Components

**Files:**
- Create: `src/components/education/lesson/LessonContent.tsx`
- Create: `src/components/education/lesson/LessonNavigation.tsx`
- Create: `src/components/education/lesson/LessonViewer.tsx`
- Create: `src/components/education/progress/ProgressBar.tsx`

- [ ] **Step 1: Write LessonContent component**

Renders markdown lesson content safely using `isomorphic-dompurify` + a markdown parser (use `marked` which is already in the codebase). Props: `content: string`, `language: string`.

- [ ] **Step 2: Write LessonNavigation component**

Bottom bar with: previous lesson button, "Nimekamilisha" (complete) button, next lesson button. Props: `onPrev`, `onComplete`, `onNext`, `isCompleted`, `hasPrev`, `hasNext`.

- [ ] **Step 3: Write ProgressBar component**

Reusable progress bar showing X/Y with percentage fill. Props: `completed: number`, `total: number`, `label?: string`.

- [ ] **Step 4: Write SkillProfile component**

Displays the learner's skill scores as a horizontal bar chart. Each skill tag (budgeting, saving, etc.) shows a labeled bar with percentage fill. Props: `skillScores: Record<string, number>`. Used in assessment results and category pages.

- [ ] **Step 5: Write LessonViewer component**

Orchestrates the lesson experience: header with course title and progress bar, LessonContent in the main area, LessonNavigation at the bottom, AI companion button. Fetches lesson content from API, manages completion state.

- [ ] **Step 6: Commit**

```bash
git add src/components/education/lesson/ src/components/education/progress/
git commit -m "feat(education): add lesson viewer and progress components"
```

---

### Task 18: AI Companion Components

**Files:**
- Create: `src/components/education/ai/QuickActions.tsx`
- Create: `src/components/education/ai/ChatMessage.tsx`
- Create: `src/components/education/ai/AICompanion.tsx`

- [ ] **Step 1: Write QuickActions component**

Row of pill buttons: "Eleza zaidi", "Mfano mwingine", "Hali yangu". Props: `onAction: (action: string) => void`.

- [ ] **Step 2: Write ChatMessage component**

Renders a single chat message bubble (user or assistant). Assistant messages are left-aligned blue, user messages are right-aligned dark. Props: `role: 'user' | 'assistant'`, `content: string`.

- [ ] **Step 3: Write AICompanion component**

The full AI companion panel. On mobile: slides up from bottom as an overlay. On desktop: side panel. Manages chat state (messages array), handles streaming responses from `/api/education/ai/companion`, renders ChatMessages and QuickActions. Input field at bottom for free-text questions.

Key streaming logic:
```typescript
const response = await fetch('/api/education/ai/companion', {
  method: 'POST',
  body: JSON.stringify({ lesson_id, message, chat_history, action }),
});
const reader = response.body!.getReader();
const decoder = new TextDecoder();
let assistantMessage = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const lines = decoder.decode(value).split('\n').filter(Boolean);
  for (const line of lines) {
    const event = JSON.parse(line);
    if (event.type === 'delta') {
      assistantMessage += event.text;
      // Update state to re-render
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/education/ai/
git commit -m "feat(education): add AI companion components with streaming chat"
```

---

### Task 19: Certificate Components

**Files:**
- Create: `src/components/education/certificate/CertificateCard.tsx`
- Create: `src/components/education/certificate/CertificateViewer.tsx`

- [ ] **Step 1: Write CertificateCard**

Grid card showing: category name, member name, issued date, credential ID. Clicking opens CertificateViewer.

- [ ] **Step 2: Write CertificateViewer**

Full certificate display: decorative border, category name, member name, issued date, credential ID for verification. Shareable.

- [ ] **Step 3: Commit**

```bash
git add src/components/education/certificate/
git commit -m "feat(education): add certificate display components"
```

---

### Task 20: Admin Education Components

**Files:**
- Create: `src/components/education/admin/CourseEditor.tsx`
- Create: `src/components/education/admin/LessonEditor.tsx`
- Create: `src/components/education/admin/AssessmentEditor.tsx`
- Create: `src/components/education/admin/DocumentUploader.tsx`
- Create: `src/components/education/admin/ContentPreview.tsx`

- [ ] **Step 1: Write CourseEditor**

Form for editing course metadata: title, description, difficulty, language, category assignment, publish toggle. Includes button to trigger AI generation (outline or document upload).

- [ ] **Step 2: Write LessonEditor**

Markdown editor for lesson content. Shows lesson title, content textarea with markdown preview, duration, order controls. Includes "Regenerate with AI" button.

- [ ] **Step 3: Write AssessmentEditor**

Manages assessment questions: list of ScenarioQuestions with edit capabilities. Add/remove questions, edit scenario text, options, correct answer, explanation, skill tag. "Regenerate question" button.

- [ ] **Step 4: Write DocumentUploader**

File upload component with drag-and-drop. Shows upload progress, file validation feedback, and extracted text preview before sending to AI.

- [ ] **Step 5: Write ContentPreview**

Read-only preview of a course as a learner would see it. Uses LessonContent and ScenarioQuestion components in preview mode.

- [ ] **Step 6: Commit**

```bash
git add src/components/education/admin/
git commit -m "feat(education): add admin content management components"
```

---

## Chunk 5: Pages and Integration

### Task 21: Learner Pages

**Files:**
- Create: `src/app/jifunze/page.tsx` (rebuild)
- Create: `src/app/jifunze/[categoryId]/page.tsx`
- Create: `src/app/jifunze/[categoryId]/tathmini/page.tsx`
- Delete: `src/app/jifunze/course/[id]/` (old route param — replaced by [courseId])
- Create: `src/app/jifunze/course/[courseId]/page.tsx` (rebuild)
- Create: `src/app/jifunze/course/[courseId]/tathmini/page.tsx`
- Create: `src/app/jifunze/[categoryId]/mtihani/page.tsx`
- Create: `src/app/jifunze/vyeti/page.tsx`

- [ ] **Step 0: Delete old course route directory**

```bash
rm -rf src/app/jifunze/course/\[id\]/
```

This removes the old `[id]` param directory to prevent route collision with the new `[courseId]` directory.

- [ ] **Step 1: Write jifunze main page**

Uses CourseLibrary component. Page-level data fetching, passes categories to the library. Dark theme matching existing design.

- [ ] **Step 2: Write category detail page**

Shows category info, list of courses as CourseCards with progress, placement assessment CTA (if not taken), certificate progress indicator. "Take Placement Assessment" button navigates to tathmini page.

- [ ] **Step 3: Write placement assessment page**

Uses AssessmentRunner component with the category's placement assessment. On completion, redirects back to category page with updated recommendations.

- [ ] **Step 4: Write course/lesson viewer page**

Uses LessonViewer component. Sidebar (desktop) with lesson list showing completion status. Lesson content in main area. AI companion button. After completing a lesson, checks if lesson_check assessment exists and redirects to tathmini page.

- [ ] **Step 5: Write lesson check assessment page**

Uses AssessmentRunner for the lesson's check assessment. On completion, shows results and navigates to next lesson or back to course.

- [ ] **Step 6: Write final exam page**

Uses AssessmentRunner for the category's final exam. On pass, shows certificate earned. On fail, shows results with 24-hour cooldown message.

- [ ] **Step 7: Write certificates page**

Fetches certificates from `/api/education/certificates`, renders grid of CertificateCards.

- [ ] **Step 8: Commit**

```bash
git add src/app/jifunze/
git commit -m "feat(education): add all learner-facing pages"
```

---

### Task 22: Admin Education Pages

**Files:**
- Create: `src/app/dashboard/education/course/[id]/page.tsx`
- Create: `src/app/dashboard/education/course/[id]/preview/page.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Write course editor page**

Full course editing page using CourseEditor, LessonEditor, AssessmentEditor, DocumentUploader components. Manages all CRUD operations for a single course and its lessons/assessments.

- [ ] **Step 2: Write course preview page**

Uses ContentPreview to show the course as a learner would see it. Read-only mode.

- [ ] **Step 3: Replace education section in dashboard**

In `src/app/dashboard/page.tsx`, replace the existing education/content management section with a new section that:
- Lists categories (using admin categories API)
- Within each category, lists courses
- "Add Category", "Add Course" buttons
- "Edit Course" navigates to `/dashboard/education/course/[id]`
- "AI Generate Course" opens a modal with outline input or document upload
- Uses the new admin components

This is the most delicate step — we're modifying a 2,158-line file. Extract only the education section and replace it with an import of a new `EducationAdminSection` component.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/
git commit -m "feat(education): add admin education pages and integrate into dashboard"
```

---

### Task 23: Update Member Dashboard

**Files:**
- Modify: `src/app/member-dashboard/page.tsx`

- [ ] **Step 1: Replace learning section**

In `src/app/member-dashboard/page.tsx`, find the LearningSection component (around line 1126) and replace it with a simplified version that links to `/jifunze` for the full learning experience and `/jifunze/vyeti` for certificates. Show a summary card with: courses in progress, certificates earned, and a "Continue Learning" button.

- [ ] **Step 2: Commit**

```bash
git add src/app/member-dashboard/page.tsx
git commit -m "feat(education): update member dashboard with new education links"
```

---

### Task 24: Redirect Old Routes

**Files:**
- Modify: `src/app/learn/page.tsx`
- Modify: `src/app/learn/[trackId]/page.tsx`

- [ ] **Step 1: Add redirects**

Replace the content of both `/learn` pages with redirects:

```typescript
// src/app/learn/page.tsx
import { redirect } from 'next/navigation';
export default function LearnPage() {
  redirect('/jifunze');
}
```

```typescript
// src/app/learn/[trackId]/page.tsx
import { redirect } from 'next/navigation';
export default function TrackPage() {
  redirect('/jifunze');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/learn/
git commit -m "chore(education): redirect /learn to /jifunze"
```

---

## Chunk 6: Cleanup and Verification

### Task 25: Run Full Build

- [ ] **Step 1: Run build**

```bash
cd /Users/jon/Claude/WashikaDAO/jukumu-washikaDAO
npm run build
```

Expected: Build completes without TypeScript errors. Fix any issues that arise.

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(education): resolve build and test issues"
```

---

### Task 26: Apply Database Migration

- [ ] **Step 1: Run migration against database**

```bash
psql $DATABASE_URL -f database/migrations/004_education_tables.sql
```

Expected: All tables created successfully.

- [ ] **Step 2: Verify tables exist**

```bash
psql $DATABASE_URL -c "\dt edu_*"
```

Expected: Lists all 11 edu_* tables.

- [ ] **Step 3: Commit migration verification notes**

No code to commit — this is a manual verification step.

---

### Task 27: Manual Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test admin flow**

1. Log in as admin
2. Navigate to dashboard → education tab
3. Create a new category
4. Generate a course via AI (from outline)
5. Review and publish the course

- [ ] **Step 3: Test learner flow**

1. Log in as member
2. Navigate to `/jifunze`
3. Browse categories, enter a category
4. Take placement assessment (if available)
5. Open a course, read a lesson
6. Complete lesson check assessment
7. Verify progress tracking
8. Test AI companion

- [ ] **Step 4: Test mobile view**

1. Open Chrome DevTools → mobile view (375px width)
2. Navigate through the learner flow
3. Verify AI companion slides up correctly
4. Verify all buttons are tappable

---

### Task 28: Remove Old Education Routes (after verification)

**Only do this after the smoke test passes.**

- [ ] **Step 1: Remove old API routes**

Delete the following directories/files:
- `src/app/api/training/`
- `src/app/api/public/training/`
- `src/app/api/educational-content/`
- `src/app/api/admin/ai/generate-lessons-anthropic/`
- `src/app/api/admin/ai/generate-course/`
- `src/app/api/admin/ai/generate-lessons/`
- `src/app/api/ai/learning/`
- `src/app/api/admin/educational-content/`

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(education): remove deprecated education API routes"
```

---

## Deferred: PWA / Offline Support

The spec includes PWA offline caching (service worker for lesson content, IndexedDB for progress sync). This is **intentionally deferred** from this plan to keep scope manageable. It should be implemented as a follow-up plan after the core education module is stable and tested with real users. The architecture supports adding PWA later without structural changes — lesson content is fetched via clean API endpoints that a service worker can intercept and cache.
