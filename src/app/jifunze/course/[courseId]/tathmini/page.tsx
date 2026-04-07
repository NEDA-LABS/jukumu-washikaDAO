'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import AssessmentRunner from '@/components/education/assessment/AssessmentRunner';
import type { SubmitAssessmentResponse } from '@/lib/education/types';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function LessonCheckAssessmentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params.courseId as string;
  const lessonId = searchParams.get('lesson_id');

  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAssessment() {
      if (!lessonId) {
        setError('Somo halikutajwa.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/education/assessments?lesson_id=${lessonId}&type=lesson_check`);
        if (!res.ok) throw new Error('Imeshindikana kupakia tathmini');
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAssessmentId(data[0].id);
        } else {
          // No assessment for this lesson, go to next lesson
          router.push(`/jifunze/course/${courseId}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hitilafu imetokea');
      } finally {
        setLoading(false);
      }
    }
    fetchAssessment();
  }, [lessonId, courseId, router]);

  const handleComplete = (results: SubmitAssessmentResponse) => {
    // Navigate back to course after viewing results
    setTimeout(() => {
      router.push(`/jifunze/course/${courseId}`);
    }, 3000);
  };

  if (loading) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !assessmentId) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Tathmini haijapatikana'}</p>
          <button onClick={() => router.push(`/jifunze/course/${courseId}`)} className="text-orange-400 hover:underline">
            Rudi kwenye Kozi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <button onClick={() => router.push(`/jifunze/course/${courseId}`)} className="text-white/60 hover:text-white transition-colors">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-white">Tathmini ya Somo</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AssessmentRunner assessmentId={assessmentId} onComplete={handleComplete} />
      </main>
    </div>
  );
}
