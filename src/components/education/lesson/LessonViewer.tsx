'use client';

import { useState } from 'react';
import LessonContent from './LessonContent';
import LessonNavigation from './LessonNavigation';
import ProgressBar from '../progress/ProgressBar';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

interface LessonViewerProps {
  courseTitle: string;
  lessonTitle: string;
  content: string;
  language: string;
  currentLesson: number;
  totalLessons: number;
  isCompleted: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onComplete: () => void;
  onNext: () => void;
  onToggleAI?: () => void;
}

export default function LessonViewer({
  courseTitle,
  lessonTitle,
  content,
  language,
  currentLesson,
  totalLessons,
  isCompleted,
  hasPrev,
  hasNext,
  onPrev,
  onComplete,
  onNext,
  onToggleAI,
}: LessonViewerProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/40 truncate">{courseTitle}</p>
            <h1 className="text-lg font-semibold text-white truncate">
              {lessonTitle}
            </h1>
          </div>
          {onToggleAI && (
            <button
              type="button"
              onClick={onToggleAI}
              className="shrink-0 ml-3 p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              title="Msaidizi wa AI"
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-orange-400" />
            </button>
          )}
        </div>
        <ProgressBar
          completed={currentLesson}
          total={totalLessons}
          label={`Somo ${currentLesson}/${totalLessons}`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <LessonContent content={content} language={language} />
      </div>

      {/* Navigation */}
      <LessonNavigation
        onPrev={onPrev}
        onComplete={onComplete}
        onNext={onNext}
        isCompleted={isCompleted}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />
    </div>
  );
}
