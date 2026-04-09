'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AssessmentRunner from '@/components/education/assessment/AssessmentRunner';
import type { SubmitAssessmentResponse } from '@/lib/education/types';
import {
  ArrowLeftIcon,
  TrophyIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

export default function FinalExamPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params.categoryId as string;

  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examResult, setExamResult] = useState<SubmitAssessmentResponse | null>(null);
  const [passed, setPassed] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);

  useEffect(() => {
    async function fetchExam() {
      try {
        const res = await fetch(`/api/education/assessments?category_id=${categoryId}&type=final_exam`);
        if (!res.ok) throw new Error('Imeshindikana kupakia mtihani');
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAssessmentId(data[0].id);
          // Check if there's a cooldown
          if (data[0].cooldown_until) {
            const cooldown = new Date(data[0].cooldown_until);
            if (cooldown > new Date()) {
              setCooldownUntil(data[0].cooldown_until);
            }
          }
        } else {
          setError('Mtihani wa mwisho haujapatikana kwa kategoria hii.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hitilafu imetokea');
      } finally {
        setLoading(false);
      }
    }
    fetchExam();
  }, [categoryId]);

  const handleComplete = (results: SubmitAssessmentResponse) => {
    setExamResult(results);
    setPassed(results.passed);
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
          <p className="text-red-400 mb-4">{error || 'Mtihani haujapatikana'}</p>
          <button onClick={() => router.push(`/jifunze/${categoryId}`)} className="text-orange-400 hover:underline">
            Rudi
          </button>
        </div>
      </div>
    );
  }

  // Show cooldown message
  if (cooldownUntil) {
    const cooldownDate = new Date(cooldownUntil);
    return (
      <div className="bg-[#0a0a0a] min-h-screen text-white">
        <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-4">
              <button onClick={() => router.push(`/jifunze/${categoryId}`)} className="text-white/60 hover:text-white transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold text-white">Mtihani wa Mwisho</h1>
            </div>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <ClockIcon className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-3">Subiri Kidogo</h2>
          <p className="text-white/50 mb-2">
            Unaweza kujaribu tena mtihani baada ya masaa 24.
          </p>
          <p className="text-sm text-white/30">
            Unaweza kujaribu tena: {cooldownDate.toLocaleString('sw-TZ')}
          </p>
          <button
            onClick={() => router.push(`/jifunze/${categoryId}`)}
            className="mt-8 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors"
          >
            Rudi kwenye Kategoria
          </button>
        </main>
      </div>
    );
  }

  // Show results
  if (examResult) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen text-white">
        <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-4">
              <button onClick={() => router.push(`/jifunze/${categoryId}`)} className="text-white/60 hover:text-white transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold text-white">Matokeo ya Mtihani</h1>
            </div>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          {passed ? (
            <>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-6">
                <TrophyIcon className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Hongera!</h2>
              <p className="text-emerald-400 text-lg font-semibold mb-2">
                Umefaulu! Alama: {examResult.score}%
              </p>
              <p className="text-white/50 mb-6">
                Cheti chako kimesajiliwa. Unaweza kukiona kwenye ukurasa wa vyeti.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => router.push('/jifunze/vyeti')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
                >
                  Tazama Vyeti
                </button>
                <button
                  onClick={() => router.push(`/jifunze/${categoryId}`)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors"
                >
                  Rudi
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center mx-auto mb-6">
                <ExclamationTriangleIcon className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Hujafaulu Bado</h2>
              <p className="text-yellow-400 text-lg font-semibold mb-2">
                Alama: {examResult.score}%
              </p>
              <p className="text-white/50 mb-2">
                Sahihi: {examResult.correct_count}/{examResult.total_questions}
              </p>
              <p className="text-white/40 text-sm mb-6">
                Unaweza kujaribu tena baada ya masaa 24. Pitia masomo yako tena ili kuboresha.
              </p>
              <button
                onClick={() => router.push(`/jifunze/${categoryId}`)}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
              >
                Rudi kwenye Masomo
              </button>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <button onClick={() => router.push(`/jifunze/${categoryId}`)} className="text-white/60 hover:text-white transition-colors">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-white">Mtihani wa Mwisho</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AssessmentRunner assessmentId={assessmentId} onComplete={handleComplete} />
      </main>
    </div>
  );
}
