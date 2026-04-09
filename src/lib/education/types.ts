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
