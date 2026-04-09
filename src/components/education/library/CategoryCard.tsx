'use client';

import { useRouter } from 'next/navigation';
import {
  BookOpenIcon,
  ClockIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

interface CategoryCardProps {
  id: number;
  name: string;
  description: string | null;
  courseCount: number;
  totalDurationMinutes: number;
  certProgress?: number; // 0-100
}

export default function CategoryCard({
  id,
  name,
  description,
  courseCount,
  totalDurationMinutes,
  certProgress,
}: CategoryCardProps) {
  const router = useRouter();

  const hours = Math.floor(totalDurationMinutes / 60);
  const mins = totalDurationMinutes % 60;
  const durationLabel =
    hours > 0 ? `${hours}s ${mins > 0 ? `${mins}d` : ''}` : `${mins}d`;

  return (
    <button
      type="button"
      onClick={() => router.push(`/jifunze/${id}`)}
      className="w-full text-left bg-white/[0.02] border border-white/10 rounded-xl p-4 hover:bg-white/5 hover:border-white/20 transition-all duration-200 group"
    >
      <h3 className="text-white font-semibold text-lg mb-1 group-hover:text-orange-400 transition-colors">
        {name}
      </h3>
      {description && (
        <p className="text-white/60 text-sm mb-3 line-clamp-2">{description}</p>
      )}

      <div className="flex items-center gap-4 text-white/40 text-xs mb-3">
        <span className="flex items-center gap-1">
          <BookOpenIcon className="w-4 h-4" />
          {courseCount} kozi
        </span>
        <span className="flex items-center gap-1">
          <ClockIcon className="w-4 h-4" />
          {durationLabel}
        </span>
      </div>

      {certProgress !== undefined && certProgress > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-white/60">
              <AcademicCapIcon className="w-3.5 h-3.5" />
              Cheti
            </span>
            <span className="text-white/40">{certProgress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-500"
              style={{ width: `${certProgress}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
