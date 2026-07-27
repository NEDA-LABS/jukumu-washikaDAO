'use client';

import { useState } from 'react';
import LessonContent from '../lesson/LessonContent';
import ScenarioQuestion from '../assessment/ScenarioQuestion';
import type { AssessmentOption } from '@/lib/education/types';

interface PreviewLesson {
  title: string;
  content: string;
  duration_minutes: number;
  assessment_questions?: {
    id?: number;
    scenario_text: string;
    options: AssessmentOption[];
    correct_option: string;
    explanation: string;
    skill_tag: string;
  }[];
}

interface ContentPreviewProps {
  courseTitle: string;
  courseDescription: string;
  lessons: PreviewLesson[];
  language?: string;
}

export default function ContentPreview({
  courseTitle,
  courseDescription,
  lessons,
  language,
}: ContentPreviewProps) {
  const [activeLesson, setActiveLesson] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});

  const lesson = lessons[activeLesson];

  return (
    <div className="space-y-6">
      {/* Course header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-primary uppercase tracking-wider mb-1">
          Hakiki kozi
        </p>
        <h2 className="text-xl font-bold text-foreground mb-1">{courseTitle}</h2>
        <p className="text-sm text-muted-foreground">{courseDescription}</p>
      </div>

      {/* Lesson tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {lessons.map((l, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setActiveLesson(i);
              setPreviewAnswers({});
            }}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              i === activeLesson
                ? 'bg-orange-500/20 border-orange-500/30 text-primary'
                : 'bg-muted border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {l.title || `Somo ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Lesson content */}
      {lesson && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-foreground font-semibold">{lesson.title}</h3>
              <span className="text-xs text-muted-foreground">
                {lesson.duration_minutes}d
              </span>
            </div>
            <LessonContent content={lesson.content} language={language} />
          </div>

          {/* Assessment questions preview */}
          {lesson.assessment_questions && lesson.assessment_questions.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">
                Maswali ya tathmini ({lesson.assessment_questions.length})
              </h4>
              {lesson.assessment_questions.map((q, qi) => {
                const qKey = `${activeLesson}-${qi}`;
                const selected = previewAnswers[qKey] ?? null;
                const showResult = selected
                  ? {
                      correct: selected === q.correct_option,
                      correctOption: q.correct_option,
                      explanation: q.explanation,
                    }
                  : null;

                return (
                  <ScenarioQuestion
                    key={qKey}
                    question={{
                      id: q.id ?? qi,
                      scenario_text: q.scenario_text,
                      options: q.options,
                      skill_tag: q.skill_tag,
                      question_order: qi + 1,
                    }}
                    selectedOption={selected}
                    onSelect={(label) =>
                      setPreviewAnswers((prev) => ({ ...prev, [qKey]: label }))
                    }
                    showResult={showResult}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {lessons.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Hakuna masomo ya kuhakiki
        </div>
      )}
    </div>
  );
}
