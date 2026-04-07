'use client';

interface SkillProfileProps {
  skillScores: Record<string, number>;
}

export default function SkillProfile({ skillScores }: SkillProfileProps) {
  const skills = Object.entries(skillScores).sort(([, a], [, b]) => b - a);

  if (skills.length === 0) {
    return (
      <div className="text-white/40 text-sm text-center py-4">
        Hakuna ujuzi bado
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {skills.map(([skill, score]) => (
        <div key={skill}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-white capitalize">{skill}</span>
            <span className="text-sm text-white/60">{score}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(score, 100)}%`,
                backgroundColor:
                  score >= 80
                    ? '#22c55e'
                    : score >= 50
                      ? '#eab308'
                      : '#ef4444',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
