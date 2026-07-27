'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AssessmentRunner from '@/components/education/assessment/AssessmentRunner';
import type { SubmitAssessmentResponse } from '@/lib/education/types';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function PlacementAssessmentPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const categoryId = params.categoryId as string;

  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlacement() {
      try {
        const res = await fetch(`/api/education/categories/${categoryId}`);
        if (!res.ok) throw new Error(t('edu.err.loadFailed'));
        const data = await res.json();
        // Find the placement assessment for this category
        if (data.placement_assessment_id) {
          setAssessmentId(data.placement_assessment_id);
        } else {
          // Try fetching assessments directly
          const assessRes = await fetch(`/api/education/assessments?category_id=${categoryId}&type=placement`);
          if (assessRes.ok) {
            const assessments = await assessRes.json();
            if (Array.isArray(assessments) && assessments.length > 0) {
              setAssessmentId(assessments[0].id);
            } else {
              setError(t('edu.err.noPreAssessment'));
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('edu.err.generic'));
      } finally {
        setLoading(false);
      }
    }
    fetchPlacement();
  }, [categoryId]);

  const handleComplete = (results: SubmitAssessmentResponse) => {
    // Redirect back to category page after completion
    setTimeout(() => {
      router.push(`/jifunze/${categoryId}`);
    }, 3000);
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
          <p className="text-red-400 mb-4">{error || t('edu.err.assessmentNotFound')}</p>
          <button onClick={() => router.push(`/jifunze/${categoryId}`)} className="text-primary hover:underline">{t('edu.back')}</button>
        </div>
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
            <h1 className="text-lg font-bold text-foreground">{t('edu.firstAssessment')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AssessmentRunner assessmentId={assessmentId} onComplete={handleComplete} />
      </main>
    </div>
  );
}
