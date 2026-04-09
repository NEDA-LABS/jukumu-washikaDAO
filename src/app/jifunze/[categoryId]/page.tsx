'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CourseCard from '@/components/education/library/CourseCard';
import ProgressBar from '@/components/education/progress/ProgressBar';
import type { EduCategory, EduCourse } from '@/lib/education/types';
import {
  ArrowLeftIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';

interface CategoryDetail extends EduCategory {
  courses: (EduCourse & { lesson_count?: number; progress_pct?: number })[];
  has_placement: boolean;
  placement_taken: boolean;
  certificate_earned: boolean;
}

export default function CategoryPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params.categoryId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryDetail | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/education/categories/${categoryId}`);
        if (!res.ok) throw new Error('Imeshindikana kupakia');
        const data = await res.json();
        setCategory(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hitilafu imetokea');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [categoryId]);

  if (loading) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Haijpatikana'}</p>
          <button onClick={() => router.push('/jifunze')} className="text-orange-400 hover:underline">
            Rudi kwenye Jifunze
          </button>
        </div>
      </div>
    );
  }

  const overallProgress = category.courses.length > 0
    ? Math.round(category.courses.reduce((sum, c) => sum + (c.progress_pct ?? 0), 0) / category.courses.length)
    : 0;

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <button onClick={() => router.push('/jifunze')} className="text-white/60 hover:text-white transition-colors">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-white">{category.name}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category info */}
        <div className="mb-8 rounded-2xl bg-white/[0.02] border border-white/10 p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center border border-orange-500/20 shrink-0">
              <AcademicCapIcon className="h-7 w-7 text-orange-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-1">{category.name}</h2>
              {category.description && (
                <p className="text-sm text-white/50">{category.description}</p>
              )}
            </div>
          </div>

          {/* Progress indicator */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/50">Maendeleo ya Jumla</span>
              <span className="text-orange-400 font-medium">{overallProgress}%</span>
            </div>
            <ProgressBar completed={overallProgress} total={100} />
          </div>

          {/* Certificate indicator */}
          {category.certificate_earned && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <TrophyIcon className="h-5 w-5 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">Cheti Kimepata!</span>
            </div>
          )}
        </div>

        {/* Placement Assessment CTA */}
        {category.has_placement && !category.placement_taken && (
          <div className="mb-8 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <ClipboardDocumentCheckIcon className="h-6 w-6 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Tathmini ya Kwanza</h3>
            </div>
            <p className="text-sm text-white/50 mb-4">
              Fanya tathmini ya awali ili kupata mapendekezo ya kozi zinazokufaa zaidi.
            </p>
            <button
              onClick={() => router.push(`/jifunze/${categoryId}/tathmini`)}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
            >
              Fanya Tathmini ya Kwanza
            </button>
          </div>
        )}

        {/* Courses grid */}
        <h3 className="text-lg font-bold text-white mb-4">Kozi</h3>
        {category.courses.length === 0 ? (
          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-12 text-center">
            <p className="text-white/40">Hakuna kozi bado katika kategoria hii.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {category.courses.map((course) => (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                description={course.description}
                difficultyLevel={course.difficulty_level}
                lessonCount={course.lesson_count ?? 0}
                durationMinutes={course.estimated_duration_minutes}
                progress={course.progress_pct != null ? { completed: course.progress_pct, total: 100 } : null}
              />
            ))}
          </div>
        )}

        {/* Final exam CTA */}
        {!category.certificate_earned && overallProgress >= 80 && (
          <div className="mt-8 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 p-6 text-center">
            <TrophyIcon className="h-10 w-10 text-orange-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Uko Tayari kwa Mtihani wa Mwisho!</h3>
            <p className="text-sm text-white/50 mb-4">Kamilisha mtihani ili kupata cheti chako.</p>
            <button
              onClick={() => router.push(`/jifunze/${categoryId}/mtihani`)}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
            >
              Fanya Mtihani wa Mwisho
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
