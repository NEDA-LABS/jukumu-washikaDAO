import type { AssessmentType } from './types';

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
