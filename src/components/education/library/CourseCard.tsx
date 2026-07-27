'use client';

import { useRouter } from 'next/navigation';
import { BookOpenIcon, ClockIcon } from '@heroicons/react/24/outline';

interface CourseCardProps {
  id: number;
  title: string;
  description: string | null;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  lessonCount: number;
  durationMinutes: number | null;
  progress?: { completed: number; total: number } | null;
}

const difficultyConfig = {
  beginner: { label: 'Mwanzo', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  intermediate: { label: 'Wastani', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  advanced: { label: 'Juu', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export default function CourseCard({
  id,
  title,
  description,
  difficultyLevel,
  lessonCount,
  durationMinutes,
  progress,
}: CourseCardProps) {
  const router = useRouter();
  const difficulty = difficultyConfig[difficultyLevel];
  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;
  const hasStarted = progress && progress.completed > 0;

  return (
    <button
      type="button"
      onClick={() => router.push(`/jifunze/course/${id}`)}
      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:bg-muted hover:border-primary/30 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-foreground font-semibold group-hover:text-primary transition-colors line-clamp-2 flex-1 mr-2">
          {title}
        </h3>
        <span
          className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${difficulty.color}`}
        >
          {difficulty.label}
        </span>
      </div>

      {description && (
        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{description}</p>
      )}

      <div className="flex items-center gap-4 text-muted-foreground text-xs mb-3">
        <span className="flex items-center gap-1">
          <BookOpenIcon className="w-4 h-4" />
          {lessonCount} somo
        </span>
        {durationMinutes && (
          <span className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            {durationMinutes}d
          </span>
        )}
      </div>

      {hasStarted && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Maendeleo</span>
            <span className="text-muted-foreground">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
