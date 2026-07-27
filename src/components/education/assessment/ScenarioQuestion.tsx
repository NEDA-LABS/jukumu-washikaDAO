'use client';

import type { AssessmentOption } from '@/lib/education/types';
import {
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface ScenarioQuestionProps {
  question: {
    id: number;
    scenario_text: string;
    options: AssessmentOption[];
    skill_tag: string;
    question_order: number;
  };
  selectedOption: string | null;
  onSelect: (label: string) => void;
  showResult?: {
    correct: boolean;
    correctOption: string;
    explanation: string | null;
  } | null;
}

export default function ScenarioQuestion({
  question,
  selectedOption,
  onSelect,
  showResult,
}: ScenarioQuestionProps) {
  return (
    <div className="space-y-4">
      {/* Scenario callout */}
      <div className="bg-muted border border-border rounded-xl p-4">
        <div className="flex items-start gap-2">
          <InformationCircleIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-foreground text-sm leading-relaxed">
            {question.scenario_text}
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="grid gap-2">
        {question.options.map((option) => {
          const isSelected = selectedOption === option.label;
          const isCorrect = showResult?.correctOption === option.label;
          const isWrong = showResult && isSelected && !showResult.correct;

          let borderClass = 'border-border hover:border-primary/30';
          let bgClass = 'bg-card hover:bg-muted';

          if (showResult) {
            if (isCorrect) {
              borderClass = 'border-green-500/50';
              bgClass = 'bg-green-500/10';
            } else if (isWrong) {
              borderClass = 'border-red-500/50';
              bgClass = 'bg-red-500/10';
            }
          } else if (isSelected) {
            borderClass = 'border-orange-500/50';
            bgClass = 'bg-orange-500/10';
          }

          return (
            <button
              key={option.label}
              type="button"
              onClick={() => !showResult && onSelect(option.label)}
              disabled={!!showResult}
              className={`w-full text-left flex items-start gap-3 border rounded-lg p-3 transition-all duration-200 ${borderClass} ${bgClass} ${showResult ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
                  isSelected && !showResult
                    ? 'bg-primary border-orange-500 text-white'
                    : showResult && isCorrect
                      ? 'bg-green-500 border-green-500 text-white'
                      : showResult && isWrong
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'border-border text-muted-foreground'
                }`}
              >
                {option.label}
              </span>
              <span className="text-sm text-foreground pt-0.5 flex-1">
                {option.text}
              </span>
              {showResult && isCorrect && (
                <CheckCircleIcon className="w-5 h-5 text-green-400 shrink-0" />
              )}
              {showResult && isWrong && (
                <XCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showResult && showResult.explanation && (
        <div
          className={`rounded-lg p-3 text-sm ${
            showResult.correct
              ? 'bg-green-500/10 border border-green-500/20 text-green-300'
              : 'bg-red-500/10 border border-red-500/20 text-red-300'
          }`}
        >
          <p className="font-medium mb-1">
            {showResult.correct ? 'Sahihi!' : 'Si sahihi'}
          </p>
          <p className="text-muted-foreground">{showResult.explanation}</p>
        </div>
      )}
    </div>
  );
}
