# WashikaDAO Education Platform — Phase 1 Design Spec

**Date:** 2026-04-03
**Status:** Draft
**Approach:** Clean module rebuild within existing WashikaDAO codebase

---

## Overview

Replace the existing education module (built by a third party without requirements docs) with a well-structured system designed for adaptive learning. The existing WashikaDAO app (auth, groups, wallet, membership) remains untouched. The education module gets a new schema, new pages, new API routes, and new components.

### Success Criteria

1. **Content pipeline works** — admins can efficiently create quality courses with AI assistance (from outline or uploaded documents), and content is culturally accurate after human review
2. **Learners complete courses** — members finish courses with passing assessment scores, validating that content and UX work together

### What Phase 1 Includes

- Consolidated database schema (one system, not two)
- Admin content pipeline with AI generation (from outline and from uploaded documents)
- Adaptive learner experience (placement assessments, branching recommendations)
- Scenario-based assessments throughout
- AI learning companion (lesson help + real-world scenario advisor)
- Category-based certificates with final exams
- PWA offline caching for in-progress lessons
- Mobile-first, desktop-compatible design

### What Phase 1 Defers

- Crypto sandbox environment
- Gamification (badges, streaks, leaderboards)
- Audio/video lesson support
- Full adaptive engine (real-time content generation per learner)
- Offline-first with sync (Phase 1 caches lessons for reading but does not score assessments offline)
- SMS/USSD fallback

---

## Target Users

- **Learners:** Women aged 18-45 in Tanzania, varying digital literacy, primarily smartphone on mobile data with intermittent connectivity. Swahili is the primary language.
- **Admins:** WashikaDAO administrators who create and manage educational content. May have training materials from workshops or partner organizations.
- **Secondary environment:** Computer lab (desktop), funded by the project.

---

## Content Hierarchy

```
Category (e.g., "Ujuzi wa Fedha" / Financial Literacy)
├── Course 1: "Msingi wa Bajeti" (Budgeting Basics)
│   ├── Lesson 1 + lesson check (2-3 scenario questions)
│   ├── Lesson 2 + lesson check
│   └── Lesson N + lesson check
├── Course 2: "Akiba na Uwekezaji" (Saving & Investing)
│   └── ...
├── Course N
├── Placement Assessment (entry test for the category)
└── Final Exam (must pass to earn category certificate)
```

- **Categories** group related courses and issue certificates
- **Courses** can be taken in any order within a category (branching system recommends an order)
- **Lessons** are sequential within a course
- **Assessments** are scenario-based multiple choice at every level

---

## Content Pipeline (Admin Experience)

### Entry Point 1: From Outline

1. Admin provides: topic, target difficulty, number of lessons, key concepts, local context notes (e.g., "include VICOBA examples")
2. AI (Claude Sonnet) generates: course with lessons (markdown), lesson check questions, skill tags per question, suggested final exam questions
3. Admin reviews in preview interface: edit lesson content, rewrite scenarios, adjust difficulty, reorder, add/remove
4. Admin publishes to a category

### Entry Point 2: From Document

1. Admin uploads PDF, PPTX, or DOCX (existing training materials from workshops, partners)
2. Backend extracts text content
3. AI restructures into course format: lessons, assessments, Tanzanian context adaptation
4. Original document stored as reference attachment on the course record
5. Admin reviews and refines in same preview interface
6. Admin publishes to a category

### AI Generation Details

- **System prompt** emphasizes: Tanzanian context, practical scenarios (school fees, VICOBA, M-Pesa, market day budgeting), Swahili-first, markdown formatting, 10-30 minute lesson durations
- Each generated assessment question includes a `skill_tag` (e.g., "budgeting", "saving", "mobile_money", "risk_management") used by the branching system
- Admin can regenerate individual lessons or questions without regenerating the whole course
- Content is Swahili-first; admin can generate English version of the same course

---

## Learner Experience

### Journey Flow

1. **Browse Library** — see available categories and courses, filtered by difficulty. Each card shows lesson count, duration, description.
2. **Placement Assessment** — 5-8 scenario questions when entering a category. Gauges existing knowledge, recommends starting courses, identifies courses the learner can skip.
3. **Learn** — read lesson content, ask the AI companion questions, work through real-world scenarios.
4. **Lesson Check** — 2-3 scenario questions after each lesson. Scores feed into skill profile and branching recommendations.
5. **Branch or Continue** — strong score → next lesson. Weak in a skill area → system recommends a supplementary course or review.
6. **Final Exam** — after completing courses in a category, take the final exam. Scenario-based questions pulling from all courses.
7. **Certificate** — pass the final exam → earn category certificate.

### Placement Assessment Behavior

The placement assessment is **recommended but not mandatory**. When a learner enters a category:
- If they take the placement assessment: scores populate their skill profile and the system recommends a starting course. Courses where the learner already demonstrates competency are marked "suggested to skip" but remain accessible.
- If they skip the placement: they start with no skill scores and the system recommends courses in display_order (the default sequence set by the admin). Skill scores build up as they complete lesson checks.

### Assessment Design

- All assessments are **scenario-based multiple choice**
- Scenarios use Tanzanian context: real names, TZS amounts, local institutions, cultural practices
- Each question has: scenario text, 4 options, correct answer, explanation (shown after answering), skill tag
- **Placement assessments:** 5-8 questions spanning the category's skill areas
- **Lesson checks:** 2-3 questions focused on the lesson's content
- **Final exams:** 10-15 questions across all courses in the category. Pass threshold uses the `passing_score` on the assessment record (which defaults to the category's `pass_threshold` when the assessment is created). The assessment's `passing_score` is the canonical source.

**Re-attempt policy:**
- **Placement assessments:** Can be retaken once per 7 days (to prevent gaming). First attempt's scores are used for initial recommendations.
- **Lesson checks:** Can be retaken immediately, unlimited attempts. Only the best score counts toward skill profile.
- **Final exams:** Can be retaken after a 24-hour cooldown period, unlimited attempts. This encourages review between attempts rather than brute-forcing.

### Branching Recommendations

- After each lesson check, system aggregates scores by skill tag in the learner profile
- Rule-based engine: "if budgeting score < 70%, recommend budgeting course before investing course"
- AI generates a short encouraging message in Swahili explaining the recommendation
- Recommendations are suggestions, not gates — learner can proceed in any order
- **Phase 2 hook:** rule engine interface can be replaced with AI-driven adaptive engine

### AI Learning Companion

Available during lessons via a slide-up panel (mobile) or side panel (desktop).

**Two modes:**
1. **Lesson help** — explain concepts from current lesson, give additional examples, rephrase in simpler terms
2. **Scenario advisor** — learner describes their own financial situation ("I want to save for my daughter's school fees"), AI provides contextual guidance using principles from the curriculum

**Quick actions** (reduce typing on mobile):
- "Eleza zaidi" (Explain more)
- "Mfano mwingine" (Another example)
- "Hali yangu" (My situation)

**Context:** The companion knows which lesson the learner is viewing, their assessment history, and skill profile.

**Model selection:**
- Claude Haiku for fast, low-cost responses (lesson help, quick actions)
- Claude Sonnet for complex scenario analysis (personal financial situations)

**Rate limiting:** Cap per learner per day to manage API costs.

---

## Language Strategy

- **Swahili-first** — UI defaults to Swahili, content generated primarily in Swahili (Tanzanian dialect)
- **English available** — learner can switch language per-lesson for terminology or preference
- **Admin review** ensures natural Tanzanian Swahili, not formal/academic Swahili
- AI companion responds in whichever language the learner uses

---

## Technical Architecture

### Pages (replacing existing education pages)

| Route | Purpose |
|-------|---------|
| `/jifunze` | Course library, browse by category, see progress |
| `/jifunze/[categoryId]` | Category view with courses and certificate progress |
| `/jifunze/[categoryId]/tathmini` | Placement assessment for a category |
| `/jifunze/course/[courseId]` | Lesson viewer + AI companion |
| `/jifunze/course/[courseId]/tathmini` | Lesson checks / course assessment |
| `/jifunze/[categoryId]/mtihani` | Category final exam |
| `/jifunze/vyeti` | Learner's earned certificates |

**Admin pages (within existing dashboard):**

| Route | Purpose |
|-------|---------|
| `/dashboard` (education tab) | Category and course management, content pipeline |
| `/dashboard/education/course/[id]` | Course editor with lessons, assessments, preview |
| `/dashboard/education/course/[id]/preview` | Full course preview as learner would see it |

The admin education UI is rendered as a tab/section within the existing admin dashboard, using the new component structure (`CourseEditor`, `LessonEditor`, `AssessmentEditor`, `DocumentUploader`, `ContentPreview`). This avoids creating a separate admin app while keeping components focused.

The existing `/learn` routes redirect to `/jifunze`.

### API Routes

**Public/learner routes (`/api/education/*`):**

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/education/categories` | GET | List categories with learner's progress |
| `/api/education/categories/[id]` | GET | Category detail with courses and cert status |
| `/api/education/courses` | GET | List courses (filterable by category, difficulty) |
| `/api/education/courses/[id]` | GET | Course detail with lessons |
| `/api/education/courses/[id]/lessons` | GET | Lesson list for a course |
| `/api/education/courses/[id]/lessons/[lessonId]` | GET | Single lesson content |
| `/api/education/assessments/[id]` | GET | Get assessment questions |
| `/api/education/assessments/[id]/submit` | POST | Submit assessment answers, get score |
| `/api/education/progress` | GET, POST | Get/record lesson completion |
| `/api/education/recommendations` | GET | Get branching suggestions for learner |
| `/api/education/certificates` | GET | List learner's earned certificates |
| `/api/education/certificates/[id]` | GET | Single certificate detail |
| `/api/education/ai/companion` | POST | AI learning assistant (streaming) |

**Admin routes (`/api/admin/education/*`):**

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/admin/education/categories` | GET, POST | List/create categories |
| `/api/admin/education/categories/[id]` | PUT, DELETE | Update/delete category |
| `/api/admin/education/courses` | GET, POST | List/create courses |
| `/api/admin/education/courses/[id]` | PUT, DELETE | Update/delete course |
| `/api/admin/education/courses/[id]/lessons` | GET, POST | List/create lessons |
| `/api/admin/education/courses/[id]/lessons/[id]` | PUT, DELETE | Update/delete lesson |
| `/api/admin/education/assessments` | GET, POST | List/create assessments |
| `/api/admin/education/assessments/[id]` | PUT, DELETE | Update/delete assessment |
| `/api/admin/education/assessments/[id]/questions` | GET, POST | Manage questions |
| `/api/admin/education/ai/generate-course` | POST | Generate course from outline |
| `/api/admin/education/ai/generate-from-document` | POST | Generate course from uploaded file |
| `/api/admin/education/ai/regenerate-lesson` | POST | Regenerate a single lesson |
| `/api/admin/education/ai/regenerate-question` | POST | Regenerate a single question |

### Component Structure

Each page imports focused components instead of containing all logic inline:

```
src/components/education/
├── library/
│   ├── CourseLibrary.tsx
│   ├── CategoryCard.tsx
│   └── CourseCard.tsx
├── lesson/
│   ├── LessonViewer.tsx
│   ├── LessonContent.tsx
│   └── LessonNavigation.tsx
├── assessment/
│   ├── AssessmentRunner.tsx
│   ├── ScenarioQuestion.tsx
│   └── AssessmentResults.tsx
├── ai/
│   ├── AICompanion.tsx
│   ├── ChatMessage.tsx
│   └── QuickActions.tsx
├── certificate/
│   ├── CertificateCard.tsx
│   └── CertificateViewer.tsx
├── progress/
│   ├── ProgressBar.tsx
│   └── SkillProfile.tsx
└── admin/
    ├── CourseEditor.tsx
    ├── LessonEditor.tsx
    ├── AssessmentEditor.tsx
    ├── DocumentUploader.tsx
    └── ContentPreview.tsx
```

### Routes to Remove

The following existing routes and pages are replaced by the new education module:

- `/api/training/*` → replaced by `/api/education/*`
- `/api/public/training/*` → replaced by `/api/education/*`
- `/api/educational-content/*` → replaced by `/api/admin/education/*`
- `/api/admin/ai/generate-lessons-anthropic` → replaced by `/api/admin/education/ai/generate-course`
- `/api/admin/ai/generate-course` → replaced by `/api/admin/education/ai/generate-course`
- `/api/admin/ai/generate-lessons` → removed
- `/api/ai/learning` → replaced by `/api/education/ai/companion`
- `/src/app/learn/*` → redirect to `/jifunze`
- `/src/app/jifunze/*` → rebuilt

Education-related sections of `/src/app/dashboard/page.tsx` and `/src/app/member-dashboard/page.tsx` are extracted into the new component structure.

---

## Database Schema

### New Tables

```sql
-- Categories group related courses and issue certificates
CREATE TABLE edu_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    pass_threshold INTEGER DEFAULT 70,
    display_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses belong to a category
CREATE TABLE edu_courses (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES edu_categories(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty_level VARCHAR(20) DEFAULT 'beginner'
        CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    language VARCHAR(5) DEFAULT 'sw',
    estimated_duration_minutes INTEGER,
    display_order INTEGER DEFAULT 0,
    source_document_url TEXT,
    is_published BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Course prerequisites: skill tags and minimum scores needed before a course
-- Used by the branching recommendation engine
CREATE TABLE edu_course_prerequisites (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES edu_courses(id) ON DELETE CASCADE,
    skill_tag VARCHAR(50) NOT NULL,
    minimum_score INTEGER NOT NULL DEFAULT 70,
    UNIQUE(course_id, skill_tag)
);

-- Lessons belong to a course
CREATE TABLE edu_lessons (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES edu_courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    language VARCHAR(5) DEFAULT 'sw',
    lesson_order INTEGER NOT NULL,
    duration_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assessments belong to a category (placement, final_exam) or lesson (lesson_check)
CREATE TABLE edu_assessments (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES edu_categories(id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES edu_lessons(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL
        CHECK (type IN ('placement', 'lesson_check', 'final_exam')),
    title VARCHAR(255),
    passing_score INTEGER DEFAULT 70,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT assessment_has_parent CHECK (
        (category_id IS NOT NULL AND lesson_id IS NULL) OR
        (category_id IS NULL AND lesson_id IS NOT NULL)
    ),
    CONSTRAINT assessment_type_parent CHECK (
        (type IN ('placement', 'final_exam') AND category_id IS NOT NULL) OR
        (type = 'lesson_check' AND lesson_id IS NOT NULL)
    )
);

-- Scenario-based questions
CREATE TABLE edu_assessment_questions (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES edu_assessments(id) ON DELETE CASCADE,
    scenario_text TEXT NOT NULL,
    options JSONB NOT NULL,  -- [{label: "A", text: "..."}, ...]
    correct_option VARCHAR(1) NOT NULL,
    explanation TEXT,
    skill_tag VARCHAR(50) NOT NULL,
    question_order INTEGER NOT NULL
);

-- Learner skill profile
CREATE TABLE edu_learner_profiles (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    preferred_language VARCHAR(5) DEFAULT 'sw',
    skill_scores JSONB DEFAULT '{}',
    daily_ai_interactions INTEGER DEFAULT 0,
    last_interaction_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id)
);

-- Lesson completion tracking
CREATE TABLE edu_lesson_progress (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL REFERENCES edu_lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    UNIQUE(member_id, lesson_id)
);

-- Course-level progress
-- Both lessons_completed and total_lessons are computed at query time via JOINs,
-- NOT stored as columns. This avoids stale data when admins modify published courses.
-- Status transitions:
--   not_started → in_progress: when learner completes their first lesson in the course
--   in_progress → completed: when all lesson checks are passed (not just lessons read)
--   Learners can re-enter completed courses to review content.
CREATE TABLE edu_course_progress (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES edu_courses(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(member_id, course_id)
);

-- Assessment attempt history
CREATE TABLE edu_assessment_attempts (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    assessment_id INTEGER NOT NULL REFERENCES edu_assessments(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    answers JSONB NOT NULL,
    passed BOOLEAN NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Category certificates
-- credential_id is a UUID v4 used for external verification and sharing.
-- member_name and category_name are intentionally denormalized: certificates are
-- historical records and should reflect the name at time of issuance, not current values.
CREATE TABLE edu_certificates (
    id SERIAL PRIMARY KEY,
    credential_id VARCHAR(64) NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES edu_categories(id) ON DELETE CASCADE,
    member_name VARCHAR(255) NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Branching recommendations
CREATE TABLE edu_learning_recommendations (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    recommended_course_id INTEGER NOT NULL REFERENCES edu_courses(id) ON DELETE CASCADE,
    reason TEXT,
    skill_tag VARCHAR(50),
    priority INTEGER DEFAULT 0,
    dismissed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_edu_course_prereqs_course ON edu_course_prerequisites(course_id);
CREATE INDEX idx_edu_courses_category ON edu_courses(category_id);
CREATE INDEX idx_edu_lessons_course ON edu_lessons(course_id);
CREATE INDEX idx_edu_assessments_type ON edu_assessments(type);
CREATE INDEX idx_edu_lesson_progress_member ON edu_lesson_progress(member_id);
CREATE INDEX idx_edu_course_progress_member ON edu_course_progress(member_id);
CREATE INDEX idx_edu_assessment_attempts_member ON edu_assessment_attempts(member_id);
CREATE INDEX idx_edu_certificates_member ON edu_certificates(member_id);
CREATE INDEX idx_edu_recommendations_member ON edu_learning_recommendations(member_id);
```

### Deprecated Tables

The following tables are replaced and should be migrated then dropped:

- `training_modules` → `edu_categories` + `edu_courses`
- `educational_content` → `edu_courses`
- `training_lessons` → `edu_lessons`
- `member_training` → `edu_course_progress`
- `content_progress` → `edu_course_progress`
- `lesson_progress` → `edu_lesson_progress`

A migration script maps existing content data to the new schema before the old tables are dropped.

---

## AI Integration

### SDK and Streaming

**Anthropic SDK:** Add `@anthropic-ai/sdk` as a dependency. The existing codebase uses raw `fetch()` for Anthropic calls, but the SDK provides better streaming support, error handling, and type safety.

**Streaming implementation (AI companion):** Use the Anthropic SDK's streaming API with Next.js App Router's `ReadableStream` pattern:

```typescript
// API route returns a ReadableStream
const stream = await anthropic.messages.stream({...});
return new Response(stream.toReadableStream(), {
  headers: { 'Content-Type': 'text/event-stream' }
});
```

The route handler transforms Anthropic's native SSE events into a simplified format before sending to the client. Each chunk sent to the client is a JSON line: `{ type: 'delta', text: string }` for content, `{ type: 'done' }` for completion. This abstraction isolates the client from Anthropic's event structure and allows switching AI providers without frontend changes.

**Content generation (non-streaming):** Standard request/response. Admin sees a loading spinner with "Generating course..." message. Timeout: 120 seconds (course generation can be slow). On timeout or partial failure, return whatever was generated with an error message for the missing parts, allowing admin to regenerate individual lessons.

### New Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Anthropic API client with streaming support |
| `pdf-parse` | PDF text extraction for document upload |
| `officeparser` | PPTX and DOCX text extraction (single package handles both) |

### 1. Content Generation (Admin)

**Model:** Claude Sonnet (content generation and document restructuring).

**From outline prompt structure:**
- System prompt: Tanzanian context, practical scenarios, Swahili-first, markdown, 10-30 min lessons, skill-tagged assessment questions
- User prompt: admin's topic, difficulty, lesson count, context notes
- Output: JSON with course metadata, lessons array, assessment questions array

**From document prompt structure:**
- System prompt: same as above, plus "restructure the following training material into our course format"
- User prompt: extracted document text + admin's parameters
- Output: same JSON structure

**Document upload handling:**
- **Max file size:** 10MB (enforced server-side)
- **Accepted types:** PDF, PPTX, DOCX (validated by file header/magic bytes, not just extension)
- **Storage:** Files are processed in memory only — text is extracted, sent to Claude, then the file is discarded. The `source_document_url` field on `edu_courses` stores an optional external link (e.g., Google Drive URL) for reference, not the uploaded file itself.
- **Text extraction:** `pdf-parse` for PDF, `officeparser` for PPTX/DOCX
- **Error handling:** If extraction fails or produces < 100 characters of text, return error asking admin to try a different format or paste text directly

### 2. Learning Companion (Learner)

**Model:** Claude Haiku (lesson help, quick actions), Claude Sonnet (scenario analysis).

**Context provided to the companion:**
- Current lesson title and content
- Learner's skill profile (skill_scores from learner_profiles)
- Recent assessment scores
- Chat history (last 10 messages, stored in client-side session state only — not persisted to DB. Chat resets on page refresh. This is intentional for Phase 1 to keep costs and complexity low.)

**System prompt emphasizes:**
- Educational role (not financial advisor)
- Use principles from the curriculum
- Tanzanian context and examples
- Respond in learner's language
- No specific investment recommendations
- Encourage practical application

**Rate limiting:** Track daily interaction count in `edu_learner_profiles` via a `daily_ai_interactions` INTEGER column and `last_interaction_date` DATE column. Reset count when date changes. Default cap: 20 interactions/day. When limit is reached, show a friendly Swahili message: "Umefika kikomo cha mazungumzo ya leo. Rudi kesho!" (You've reached today's conversation limit. Come back tomorrow!)

### 3. Branching Recommendations (System)

**Rule-based engine (Phase 1):**
- After lesson check: update skill_scores in learner_profiles
- Compare scores against course prerequisites stored in `edu_course_prerequisites` table
- If learner's score for a prerequisite skill_tag < the course's minimum_score, generate a recommendation for the course that teaches that skill
- AI generates short encouraging recommendation message in Swahili

**Phase 2 hook:** The `learner_profiles.skill_scores` JSONB, `edu_course_prerequisites` table, and `edu_learning_recommendations` table provide clean interfaces for a future AI-driven adaptive engine.

---

## Authorization

All education API routes enforce auth using the existing middleware pattern:

**Learner routes (`/api/education/*`):** Require a valid `auth-token` cookie. The middleware already protects these routes (any `/api/` route not in the public allowlist requires auth). The route handler extracts `member_id` from the JWT to scope all queries to the authenticated user.

**Admin routes (`/api/admin/education/*`):** Require a valid `auth-token` cookie AND `role = 'admin'` on the user record. Each admin route handler verifies the role after JWT validation:

```typescript
const user = verifyToken(token);
if (user.role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Placement assessments:** Accessible to authenticated members. No special role required — any member can take assessments for published categories.

---

## PWA / Offline Strategy

- Service worker caches lesson content for courses the learner has started
- Lesson text cached for offline reading
- Progress updates (lesson completion) queued in IndexedDB and synced when connectivity returns
- AI companion requires connectivity (show friendly Swahili offline message)
- **Assessments require connectivity** — scoring happens server-side to prevent answer inspection. If offline, show message: "Unahitaji mtandao kufanya tathmini" (You need internet to take assessments). Lesson reading remains available offline.

---

## Device Strategy

- **Mobile-first** — all layouts designed for 320px+ width
- **Desktop-compatible** — lesson view expands to show sidebar lesson list, AI companion as side panel
- Lightweight pages: minimal JS, optimized images, lazy loading
- Target: < 3 second load on 3G

---

## Migration Plan

1. Create new `edu_*` tables alongside existing tables
2. Write migration script to copy existing educational_content → edu_courses, training_lessons → edu_lessons, etc.
3. Deploy new education module pages and API routes
4. Redirect old `/learn` routes to `/jifunze`
5. Remove old education API routes
6. Extract education sections from dashboard and member-dashboard pages into new components
7. Drop deprecated tables after confirming new system works
