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
