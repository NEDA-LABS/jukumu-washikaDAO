'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import LessonViewer from '@/components/education/lesson/LessonViewer';
import AICompanion from '@/components/education/ai/AICompanion';
import type { EduCourse, EduLesson, EduLessonProgress } from '@/lib/education/types';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface LessonWithProgress extends EduLesson {
  completed: boolean;
}

export default function CourseViewerPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<EduCourse | null>(null);
  const [lessons, setLessons] = useState<LessonWithProgress[]>([]);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [showAI, setShowAI] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch course details
      const courseRes = await fetch(`/api/education/courses/${courseId}`);
      if (!courseRes.ok) throw new Error(t('edu.err.courseNotFound'));
      const courseData = await courseRes.json();
      setCourse(courseData);

      // Fetch lessons
      const lessonsRes = await fetch(`/api/education/courses/${courseId}/lessons`);
      if (!lessonsRes.ok) throw new Error(t('edu.err.lessonsNotFound'));
      const lessonsData: EduLesson[] = await lessonsRes.json();

      // Fetch progress
      const progressMap: Record<number, boolean> = {};
      try {
        const progressRes = await fetch(`/api/education/progress/course/${courseId}`);
        if (progressRes.ok) {
          const progressData = await progressRes.json();
          if (Array.isArray(progressData.lesson_progress)) {
            for (const p of progressData.lesson_progress as EduLessonProgress[]) {
              progressMap[p.lesson_id] = p.completed;
            }
          }
        }
      } catch {
        // Progress fetch is optional (user may not be logged in)
      }

      const lessonsWithProgress: LessonWithProgress[] = lessonsData
        .sort((a, b) => a.lesson_order - b.lesson_order)
        .map((l) => ({ ...l, completed: progressMap[l.id] ?? false }));

      setLessons(lessonsWithProgress);

      // Start at the first incomplete lesson
      const firstIncomplete = lessonsWithProgress.findIndex((l) => !l.completed);
      if (firstIncomplete >= 0) setCurrentLessonIndex(firstIncomplete);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('edu.err.generic'));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentLesson = lessons[currentLessonIndex];

  const handleComplete = async () => {
    if (!currentLesson) return;
    try {
      await fetch(`/api/education/progress/lesson/${currentLesson.id}/complete`, {
        method: 'POST',
      });
      // Update local state
      setLessons((prev) =>
        prev.map((l, i) => (i === currentLessonIndex ? { ...l, completed: true } : l))
      );
      // If lesson has a check assessment, navigate to it
      router.push(`/jifunze/course/${courseId}/tathmini?lesson_id=${currentLesson.id}`);
    } catch {
      // Mark as complete locally even if API fails
      setLessons((prev) =>
        prev.map((l, i) => (i === currentLessonIndex ? { ...l, completed: true } : l))
      );
    }
  };

  const handleNext = () => {
    if (currentLessonIndex < lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="bg-background min-h-screen text-foreground flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="bg-background min-h-screen text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || t('edu.err.courseNotFound')}</p>
          <button onClick={() => router.push('/jifunze')} className="text-primary hover:underline">{t('edu.backToLearn')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
              >
                {sidebarOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
              </button>
              <h1 className="text-sm font-semibold text-foreground truncate max-w-[200px] sm:max-w-none">
                {course.title}
              </h1>
            </div>
            <button
              onClick={() => setShowAI(!showAI)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showAI
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground'
              }`}
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('edu.ai.assistant')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Lesson list */}
        <aside
          className={`${
            sidebarOpen ? 'w-72' : 'w-0'
          } transition-all duration-300 overflow-hidden border-r border-border bg-card/50 flex-shrink-0`}
        >
          <div className="w-72 h-full overflow-y-auto py-4">
            <h2 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Masomo ({lessons.filter((l) => l.completed).length}/{lessons.length})
            </h2>
            <nav className="space-y-1 px-2">
              {lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  onClick={() => setCurrentLessonIndex(index)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    index === currentLessonIndex
                      ? 'bg-orange-500/10 text-primary border border-orange-500/20'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {lesson.completed ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-400 shrink-0" />
                  ) : (
                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center text-[10px] font-bold ${
                      index === currentLessonIndex ? 'border-primary text-primary' : 'border-border text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                  )}
                  <span className="truncate">{lesson.title}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {currentLesson ? (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
              <LessonViewer
                courseTitle={course.title}
                lessonTitle={currentLesson.title}
                content={currentLesson.content}
                language={currentLesson.language}
                currentLesson={currentLessonIndex + 1}
                totalLessons={lessons.length}
                isCompleted={currentLesson.completed}
                hasPrev={currentLessonIndex > 0}
                hasNext={currentLessonIndex < lessons.length - 1}
                onPrev={handlePrev}
                onComplete={handleComplete}
                onNext={handleNext}
                onToggleAI={() => setShowAI(!showAI)}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BookOpenIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">{t('edu.noLessons')}</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Companion panel */}
        {showAI && currentLesson && (
          <div className="w-80 border-l border-border bg-card/50 flex-shrink-0 hidden lg:block">
            <AICompanion
              lessonId={currentLesson.id}
              isOpen={showAI}
              onClose={() => setShowAI(false)}
            />
          </div>
        )}
      </div>

      {/* Mobile AI panel overlay */}
      {showAI && currentLesson && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-background border-l border-border">
            <AICompanion
              lessonId={currentLesson.id}
              isOpen={showAI}
              onClose={() => setShowAI(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
