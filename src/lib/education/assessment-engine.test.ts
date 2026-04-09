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

  it('returns 100 for all correct answers', () => {
    const answers = { '1': 'B', '2': 'C', '3': 'A' };
    const result = scoreAssessment(questions, answers);
    expect(result.score).toBe(100);
    expect(result.correct_count).toBe(3);
  });

  it('handles missing answers as wrong', () => {
    const answers = { '1': 'B' };
    const result = scoreAssessment(questions, answers);
    expect(result.score).toBe(33); // 1/3
    expect(result.correct_count).toBe(1);
  });

  it('returns results with per-question details', () => {
    const answers = { '1': 'B', '2': 'A', '3': 'A' };
    const result = scoreAssessment(questions, answers);
    expect(result.results).toHaveLength(3);
    expect(result.results[0].correct).toBe(true);
    expect(result.results[1].correct).toBe(false);
    expect(result.results[2].correct).toBe(true);
  });
});

describe('canRetakeAssessment', () => {
  it('allows retake when no previous attempt', () => {
    expect(canRetakeAssessment('final_exam', null)).toBe(true);
  });

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

  it('returns empty object for empty results', () => {
    const scores = aggregateSkillScores([]);
    expect(Object.keys(scores)).toHaveLength(0);
  });
});
