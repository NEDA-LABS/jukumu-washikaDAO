'use client';

import { useLanguage } from '@/contexts/LanguageContext';
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
  const { t } = useLanguage();
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
        if (!res.ok) throw new Error(t('edu.err.loadExam'));
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
          setError(t('edu.err.noFinalExam'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('edu.err.generic'));
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
      <div className="bg-background min-h-screen text-foreground flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !assessmentId) {
    return (
      <div className="bg-background min-h-screen text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || t('edu.err.examNotFound')}</p>
          <button onClick={() => router.push(`/jifunze/${categoryId}`)} className="text-primary hover:underline">{t('edu.back')}</button>
        </div>
      </div>
    );
  }

  // Show cooldown message
  if (cooldownUntil) {
    const cooldownDate = new Date(cooldownUntil);
    return (
      <div className="bg-background min-h-screen text-foreground">
        <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-4">
              <button onClick={() => router.push(`/jifunze/${categoryId}`)} className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold text-foreground">{t('edu.finalExam')}</h1>
            </div>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <ClockIcon className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-3">{t('edu.waitAMoment')}</h2>
          <p className="text-muted-foreground mb-2">
            Unaweza kujaribu tena mtihani baada ya masaa 24.
          </p>
          <p className="text-sm text-muted-foreground">
            Unaweza kujaribu tena: {cooldownDate.toLocaleString('sw-TZ')}
          </p>
          <button
            onClick={() => router.push(`/jifunze/${categoryId}`)}
            className="mt-8 px-5 py-2.5 rounded-xl bg-muted hover:bg-border text-foreground text-sm font-medium transition-colors"
          >{t('edu.backToCategory')}</button>
        </main>
      </div>
    );
  }

  // Show results
  if (examResult) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-4">
              <button onClick={() => router.push(`/jifunze/${categoryId}`)} className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold text-foreground">{t('edu.examResults')}</h1>
            </div>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          {passed ? (
            <>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-6">
                <TrophyIcon className="h-10 w-10 text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">{t('edu.congrats')}</h2>
              <p className="text-emerald-400 text-lg font-semibold mb-2">
                {t('edu.passed')} {t('edu.score')}: {examResult.score}%
              </p>
              <p className="text-muted-foreground mb-6">
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
                  className="px-5 py-2.5 rounded-xl bg-muted hover:bg-border text-foreground text-sm font-medium transition-colors"
                >{t('edu.back')}</button>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center mx-auto mb-6">
                <ExclamationTriangleIcon className="h-10 w-10 text-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">{t('edu.notPassed')}</h2>
              <p className="text-yellow-400 text-lg font-semibold mb-2">
                {t('edu.score')}: {examResult.score}%
              </p>
              <p className="text-muted-foreground mb-2">
                Sahihi: {examResult.correct_count}/{examResult.total_questions}
              </p>
              <p className="text-muted-foreground text-sm mb-6">
                Unaweza kujaribu tena baada ya masaa 24. Pitia masomo yako tena ili kuboresha.
              </p>
              <button
                onClick={() => router.push(`/jifunze/${categoryId}`)}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors"
              >{t('edu.backToLessons')}</button>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <button onClick={() => router.push(`/jifunze/${categoryId}`)} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-foreground">{t('edu.finalExam')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AssessmentRunner assessmentId={assessmentId} onComplete={handleComplete} />
      </main>
    </div>
  );
}
