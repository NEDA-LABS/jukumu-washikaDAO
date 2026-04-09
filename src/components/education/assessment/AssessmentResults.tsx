'use client';

import type { SubmitAssessmentResponse } from '@/lib/education/types';
import SkillProfile from '../progress/SkillProfile';
import {
  CheckCircleIcon,
  XCircleIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface AssessmentResultsProps {
  results: SubmitAssessmentResponse;
  questions: {
    id: number;
    scenario_text: string;
    options: { label: string; text: string }[];
  }[];
  onContinue: () => void;
}

export default function AssessmentResults({
  results,
  questions,
  onContinue,
}: AssessmentResultsProps) {
  const scorePct = Math.round(results.score);

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 border-2"
          style={{
            borderColor: results.passed ? '#22c55e' : '#ef4444',
            backgroundColor: results.passed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          }}
        >
          {results.passed ? (
            <TrophyIcon className="w-10 h-10 text-green-400" />
          ) : (
            <ExclamationTriangleIcon className="w-10 h-10 text-red-400" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">{scorePct}%</h2>
        <p className={`text-sm font-medium ${results.passed ? 'text-green-400' : 'text-red-400'}`}>
          {results.passed ? 'Umefaulu!' : 'Hujafaulu'}
        </p>
        <p className="text-white/40 text-sm mt-1">
          {results.correct_count}/{results.total_questions} majibu sahihi
        </p>
      </div>

      {/* Skill breakdown */}
      {Object.keys(results.skill_scores).length > 0 && (
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Ujuzi wako</h3>
          <SkillProfile skillScores={results.skill_scores} />
        </div>
      )}

      {/* Per-question results */}
      <div className="space-y-3">
        <h3 className="text-white font-medium">Majibu kwa undani</h3>
        {results.results.map((r) => {
          const q = questions.find((qu) => qu.id === r.question_id);
          return (
            <div
              key={r.question_id}
              className={`border rounded-lg p-3 ${
                r.correct
                  ? 'border-green-500/20 bg-green-500/5'
                  : 'border-red-500/20 bg-red-500/5'
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                {r.correct ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                )}
                <p className="text-sm text-white/80 line-clamp-2">
                  {q?.scenario_text ?? `Swali #${r.question_id}`}
                </p>
              </div>
              {!r.correct && (
                <div className="ml-7 text-xs text-white/50 space-y-0.5">
                  <p>Jibu lako: {r.selected_option} | Jibu sahihi: {r.correct_option}</p>
                  {r.explanation && (
                    <p className="text-white/40">{r.explanation}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {results.recommendations && results.recommendations.length > 0 && (
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
          <h3 className="text-white font-medium mb-2">Mapendekezo</h3>
          <ul className="space-y-1">
            {results.recommendations.map((rec) => (
              <li key={rec.id} className="text-sm text-white/60">
                {rec.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Continue button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onContinue}
          className="bg-orange-500 text-white rounded-lg px-6 py-2.5 font-medium hover:bg-orange-600 transition-colors"
        >
          Endelea
        </button>
      </div>
    </div>
  );
}
