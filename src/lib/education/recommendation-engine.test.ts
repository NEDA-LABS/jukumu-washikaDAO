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
    // Course 2 requires budgeting >= 70, learner has 50 -> recommend
    // Course 1 requires saving >= 70, learner has 80 -> no recommendation
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

  it('treats missing skill scores as 0', () => {
    const skillScores = {}; // no scores at all
    const recs = generateRecommendations(courses, skillScores, []);
    // Course 1 requires saving >= 70, learner has 0 -> recommend
    // Course 2 requires budgeting >= 70, learner has 0 -> recommend
    expect(recs).toHaveLength(2);
  });
});
