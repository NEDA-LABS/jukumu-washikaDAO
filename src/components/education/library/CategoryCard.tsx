'use client';

import { useRouter } from 'next/navigation';
import {
  BookOpenIcon,
  ClockIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();

  const hours = Math.floor(totalDurationMinutes / 60);
  const mins = totalDurationMinutes % 60;
  const durationLabel = hours > 0
    ? `${hours}${t('edu.unit.hour')}${mins > 0 ? ` ${mins}${t('edu.unit.min')}` : ''}`
    : `${mins}${t('edu.unit.min')}`;

  return (
    <button
      type="button"
      onClick={() => router.push(`/jifunze/${id}`)}
      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:bg-muted hover:border-primary/30 transition-all duration-200 group"
    >
      <h3 className="text-foreground font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
        {name}
      </h3>
      {description && (
        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{description}</p>
      )}

      <div className="flex items-center gap-4 text-muted-foreground text-xs mb-3">
        <span className="flex items-center gap-1">
          <BookOpenIcon className="w-4 h-4" />
          {courseCount} {t('edu.courses')}
        </span>
        <span className="flex items-center gap-1">
          <ClockIcon className="w-4 h-4" />
          {durationLabel}
        </span>
      </div>

      {certProgress !== undefined && certProgress > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <AcademicCapIcon className="w-3.5 h-3.5" />
              {t('edu.certificate')}
            </span>
            <span className="text-muted-foreground">{certProgress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${certProgress}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
