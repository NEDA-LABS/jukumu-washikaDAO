'use client';

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface LessonNavigationProps {
  onPrev?: () => void;
  onComplete: () => void;
  onNext?: () => void;
  isCompleted: boolean;
  hasPrev: boolean;
  hasNext: boolean;
}

export default function LessonNavigation({
  onPrev,
  onComplete,
  onNext,
  isCompleted,
  hasPrev,
  hasNext,
}: LessonNavigationProps) {
  return (
    <div className="flex items-center justify-between border-t border-white/10 bg-[#0a0a0a] px-4 py-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        className="flex items-center gap-1 text-sm text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Nyuma
      </button>

      <button
        type="button"
        onClick={onComplete}
        className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          isCompleted
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        <CheckIcon className="w-4 h-4" />
        {isCompleted ? 'Imekamilika' : 'Nimekamilisha'}
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        className="flex items-center gap-1 text-sm text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Mbele
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
