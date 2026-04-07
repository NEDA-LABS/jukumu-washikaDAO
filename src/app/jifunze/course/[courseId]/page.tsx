'use client';

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
      if (!courseRes.ok) throw new Error('Kozi haijapatikana');
      const courseData = await courseRes.json();
      setCourse(courseData);

      // Fetch lessons
      const lessonsRes = await fetch(`/api/education/courses/${courseId}/lessons`);
      if (!lessonsRes.ok) throw new Error('Masomo hayajapatikana');
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
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea');
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
      <div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Kozi haijapatikana'}</p>
          <button onClick={() => router.push('/jifunze')} className="text-orange-400 hover:underline">
            Rudi kwenye Jifunze
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="text-white/60 hover:text-white transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-white/60 hover:text-white transition-colors"
              >
                {sidebarOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
              </button>
              <h1 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-none">
                {course.title}
              </h1>
            </div>
            <button
              onClick={() => setShowAI(!showAI)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showAI
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              <span className="hidden sm:inline">AI Msaidizi</span>
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
          } transition-all duration-300 overflow-hidden border-r border-white/5 bg-black/30 flex-shrink-0`}
        >
          <div className="w-72 h-full overflow-y-auto py-4">
            <h2 className="px-4 text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              Masomo ({lessons.filter((l) => l.completed).length}/{lessons.length})
            </h2>
            <nav className="space-y-1 px-2">
              {lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  onClick={() => setCurrentLessonIndex(index)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    index === currentLessonIndex
                      ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {lesson.completed ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-400 shrink-0" />
                  ) : (
                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center text-[10px] font-bold ${
                      index === currentLessonIndex ? 'border-orange-400 text-orange-400' : 'border-white/20 text-white/30'
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
                <BookOpenIcon className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/40">Hakuna masomo bado.</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Companion panel */}
        {showAI && currentLesson && (
          <div className="w-80 border-l border-white/5 bg-black/30 flex-shrink-0 hidden lg:block">
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
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-[#0a0a0a] border-l border-white/10">
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
