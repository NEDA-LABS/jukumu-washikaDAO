'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ContentPreview from '@/components/education/admin/ContentPreview';
import type { AssessmentOption } from '@/lib/education/types';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface PreviewLesson {
  title: string;
  content: string;
  duration_minutes: number;
  assessment_questions?: {
    id?: number;
    scenario_text: string;
    options: AssessmentOption[];
    correct_option: string;
    explanation: string;
    skill_tag: string;
  }[];
}

export default function CoursePreviewPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseLanguage, setCourseLanguage] = useState('sw');
  const [lessons, setLessons] = useState<PreviewLesson[]>([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // Fetch course
        const courseRes = await fetch(`/api/education/courses/${courseId}`);
        if (!courseRes.ok) throw new Error('Kozi haijapatikana');
        const courseData = await courseRes.json();
        setCourseTitle(courseData.title);
        setCourseDescription(courseData.description ?? '');
        setCourseLanguage(courseData.language ?? 'sw');

        // Fetch lessons
        const lessonsRes = await fetch(`/api/education/courses/${courseId}/lessons`);
        if (lessonsRes.ok) {
          const lessonsData = await lessonsRes.json();
          const sorted = Array.isArray(lessonsData)
            ? lessonsData.sort((a: { lesson_order: number }, b: { lesson_order: number }) => a.lesson_order - b.lesson_order)
            : [];

          // Fetch assessments for each lesson
          const previewLessons: PreviewLesson[] = await Promise.all(
            sorted.map(async (lesson: { id: number; title: string; content: string; duration_minutes: number }) => {
              let assessment_questions: PreviewLesson['assessment_questions'] = [];
              try {
                const assessRes = await fetch(`/api/admin/education/assessments?lesson_id=${lesson.id}&type=lesson_check`);
                if (assessRes.ok) {
                  const assessData = await assessRes.json();
                  if (Array.isArray(assessData) && assessData.length > 0 && assessData[0].questions) {
                    assessment_questions = assessData[0].questions;
                  }
                }
              } catch {
                // ignore
              }
              return {
                title: lesson.title,
                content: lesson.content,
                duration_minutes: lesson.duration_minutes,
                assessment_questions,
              };
            })
          );
          setLessons(previewLessons);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hitilafu imetokea');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  if (loading) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => router.back()} className="text-orange-400 hover:underline">
            Rudi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="text-white/60 hover:text-white transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">Hakiki Kozi</h1>
                <p className="text-xs text-white/40">Hali ya kusoma tu</p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/dashboard/education/course/${courseId}`)}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
            >
              Hariri
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ContentPreview
          courseTitle={courseTitle}
          courseDescription={courseDescription}
          lessons={lessons}
          language={courseLanguage}
        />
      </main>
    </div>
  );
}
