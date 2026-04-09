'use client';

import { useEffect, useState } from 'react';
import CategoryCard from './CategoryCard';
import type { EduCategory } from '@/lib/education/types';

interface CategoryWithMeta extends EduCategory {
  course_count: number;
  total_duration_minutes: number;
}

type DifficultyFilter = '' | 'beginner' | 'intermediate' | 'advanced';
type LanguageFilter = '' | 'sw' | 'en';

export default function CourseLibrary() {
  const [categories, setCategories] = useState<CategoryWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('');
  const [language, setLanguage] = useState<LanguageFilter>('');

  useEffect(() => {
    async function fetchCategories() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (difficulty) params.set('difficulty', difficulty);
        if (language) params.set('language', language);

        const url = `/api/education/categories${params.toString() ? `?${params}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Imeshindwa kupakia makundi');
        const data = await res.json();
        setCategories(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hitilafu imetokea');
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, [difficulty, language]);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as DifficultyFilter)}
          className="bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm"
        >
          <option value="">Kiwango chote</option>
          <option value="beginner">Mwanzo</option>
          <option value="intermediate">Wastani</option>
          <option value="advanced">Juu</option>
        </select>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as LanguageFilter)}
          className="bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm"
        >
          <option value="">Lugha zote</option>
          <option value="sw">Kiswahili</option>
          <option value="en">Kiingereza</option>
        </select>
      </div>

      {/* Content */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white/[0.02] border border-white/10 rounded-xl p-4 animate-pulse"
            >
              <div className="h-5 bg-white/10 rounded w-2/3 mb-2" />
              <div className="h-4 bg-white/5 rounded w-full mb-1" />
              <div className="h-4 bg-white/5 rounded w-3/4 mb-3" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && categories.length === 0 && (
        <div className="text-center py-8 text-white/40 text-sm">
          Hakuna makundi yaliyopatikana
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
