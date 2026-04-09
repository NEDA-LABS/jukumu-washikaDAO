-- Education Platform Phase 1 — Database Migration
-- Creates all edu_* tables for the new education module.
-- Run with: psql $DATABASE_URL -f database/migrations/004_education_tables.sql

BEGIN;

-- Categories group related courses and issue certificates
CREATE TABLE IF NOT EXISTS edu_categories (
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
CREATE TABLE IF NOT EXISTS edu_courses (
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
CREATE TABLE IF NOT EXISTS edu_course_prerequisites (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES edu_courses(id) ON DELETE CASCADE,
    skill_tag VARCHAR(50) NOT NULL,
    minimum_score INTEGER NOT NULL DEFAULT 70,
    UNIQUE(course_id, skill_tag)
);

-- Lessons belong to a course
CREATE TABLE IF NOT EXISTS edu_lessons (
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
CREATE TABLE IF NOT EXISTS edu_assessments (
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
CREATE TABLE IF NOT EXISTS edu_assessment_questions (
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
CREATE TABLE IF NOT EXISTS edu_learner_profiles (
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
CREATE TABLE IF NOT EXISTS edu_lesson_progress (
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
CREATE TABLE IF NOT EXISTS edu_course_progress (
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
CREATE TABLE IF NOT EXISTS edu_assessment_attempts (
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
CREATE TABLE IF NOT EXISTS edu_certificates (
    id SERIAL PRIMARY KEY,
    credential_id VARCHAR(64) NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES edu_categories(id) ON DELETE CASCADE,
    member_name VARCHAR(255) NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Branching recommendations
CREATE TABLE IF NOT EXISTS edu_learning_recommendations (
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
CREATE INDEX IF NOT EXISTS idx_edu_course_prereqs_course ON edu_course_prerequisites(course_id);
CREATE INDEX IF NOT EXISTS idx_edu_courses_category ON edu_courses(category_id);
CREATE INDEX IF NOT EXISTS idx_edu_lessons_course ON edu_lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_edu_assessments_type ON edu_assessments(type);
CREATE INDEX IF NOT EXISTS idx_edu_lesson_progress_member ON edu_lesson_progress(member_id);
CREATE INDEX IF NOT EXISTS idx_edu_course_progress_member ON edu_course_progress(member_id);
CREATE INDEX IF NOT EXISTS idx_edu_assessment_attempts_member ON edu_assessment_attempts(member_id);
CREATE INDEX IF NOT EXISTS idx_edu_certificates_member ON edu_certificates(member_id);
CREATE INDEX IF NOT EXISTS idx_edu_recommendations_member ON edu_learning_recommendations(member_id);

COMMIT;
