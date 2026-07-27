'use client';

import { useCallback, useEffect, useState } from 'react';
import CategoryCard from './CategoryCard';
import { useLanguage } from '@/contexts/LanguageContext';
import type { EduCategory } from '@/lib/education/types';

interface CategoryWithMeta extends EduCategory {
  course_count: number;
  total_duration_minutes: number;
}

type DifficultyFilter = '' | 'beginner' | 'intermediate' | 'advanced';
type LanguageFilter = '' | 'sw' | 'en';

export default function CourseLibrary() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<CategoryWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  // Store the i18n KEY, not a resolved string: the language context hydrates
  // from localStorage after first paint, so a message resolved at fetch-time
  // would stay frozen in whatever language was active before hydration.
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('');
  const [language, setLanguage] = useState<LanguageFilter>('');
  const error = errorKey ? t(errorKey) : null;

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setErrorKey(null);
      const params = new URLSearchParams();
      if (difficulty) params.set('difficulty', difficulty);
      if (language) params.set('language', language);

      const url = `/api/education/categories${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);

      if (!res.ok) {
        // Distinguish the causes so the screen says something actionable
        // instead of a generic failure.
        setErrorKey(
          res.status === 401 ? 'edu.err.signIn'
          : res.status >= 500 ? 'edu.err.notReady'
          : 'edu.err.load',
        );
        return;
      }

      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setErrorKey('edu.err.generic');
    } finally {
      setLoading(false);
    }
  }, [difficulty, language]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const select =
    'bg-card border border-border text-foreground rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/60 transition-colors';

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as DifficultyFilter)}
          className={select}
        >
          <option value="">{t('edu.filter.allLevels')}</option>
          <option value="beginner">{t('edu.level.beginner')}</option>
          <option value="intermediate">{t('edu.level.intermediate')}</option>
          <option value="advanced">{t('edu.level.advanced')}</option>
        </select>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as LanguageFilter)}
          className={select}
        >
          <option value="">{t('edu.filter.allLangs')}</option>
          <option value="sw">{t('edu.lang.sw')}</option>
          <option value="en">{t('edu.lang.en')}</option>
        </select>
      </div>

      {/* Content */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="h-5 bg-muted rounded w-2/3 mb-2" />
              <div className="h-4 bg-muted rounded w-full mb-1" />
              <div className="h-4 bg-muted rounded w-3/4 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={fetchCategories}
            className="mt-4 px-4 py-2 rounded-lg bg-muted hover:bg-border text-foreground text-xs font-semibold transition-colors"
          >
            {t('edu.retry')}
          </button>
        </div>
      )}

      {!loading && !error && categories.length === 0 && (
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          {t('edu.empty')}
        </div>
      )}

      {!loading && !error && categories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              id={cat.id}
              name={cat.name}
              description={cat.description}
              courseCount={cat.course_count}
              totalDurationMinutes={cat.total_duration_minutes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
