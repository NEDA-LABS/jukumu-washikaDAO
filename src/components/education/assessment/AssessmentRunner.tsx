'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import ScenarioQuestion from './ScenarioQuestion';
import AssessmentResults from './AssessmentResults';
import ProgressBar from '../progress/ProgressBar';
import type {
  EduAssessmentQuestionPublic,
  SubmitAssessmentResponse,
} from '@/lib/education/types';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface AssessmentRunnerProps {
  assessmentId: number;
  onComplete?: (results: SubmitAssessmentResponse) => void;
}

export default function AssessmentRunner({
  assessmentId,
  onComplete,
}: AssessmentRunnerProps) {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState<EduAssessmentQuestionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<SubmitAssessmentResponse | null>(null);

  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch(`/api/education/assessments/${assessmentId}`);
        if (!res.ok) throw new Error('Imeshindwa kupakia maswali');
        const data = await res.json();
        setQuestions(data.questions ?? data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hitilafu imetokea');
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, [assessmentId]);

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const handleSelect = useCallback(
    (label: string) => {
      if (!currentQuestion) return;
      setAnswers((prev) => ({
        ...prev,
        [String(currentQuestion.id)]: label,
      }));
    },
    [currentQuestion],
  );

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const res = await fetch(
        `/api/education/assessments/${assessmentId}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        },
      );
      if (!res.ok) throw new Error('Imeshindwa kutuma majibu');
      const data: SubmitAssessmentResponse = await res.json();
      setResults(data);
      onComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-border rounded w-1/3" />
        <div className="h-24 bg-muted rounded-xl" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-400 text-sm">{error}</div>;
  }

  if (results) {
    return (
      <AssessmentResults
        results={results}
        questions={questions}
        onContinue={() => onComplete?.(results)}
      />
    );
  }

  if (!currentQuestion) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">{t('edu.noQuestions')}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <ProgressBar
        completed={answeredCount}
        total={questions.length}
        label="Maendeleo"
      />

      {/* Question counter */}
      <div className="text-sm text-muted-foreground">
        {t('edu.question')} {currentIndex + 1} {t('edu.of')} {questions.length}
      </div>

      {/* Current question */}
      <ScenarioQuestion
        question={currentQuestion}
        selectedOption={answers[String(currentQuestion.id)] ?? null}
        onSelect={handleSelect}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Nyuma
        </button>

        {currentIndex === questions.length - 1 ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Inatuma...' : 'Wasilisha'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
            }
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Mbele
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
