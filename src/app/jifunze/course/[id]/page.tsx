'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayCircleIcon,
  BookOpenIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

interface Lesson {
  id: number;
  title: string;
  content: string;
  duration_minutes: number;
  lesson_order: number;
  language: string;
  completed?: boolean;
}

interface Course {
  id: number;
  title: string;
  description: string;
  language: string;
  difficulty_level: string;
  category: string;
}

export default function CoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id;

  const [mounted, setMounted] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    loadCourseData();
  }, [courseId]);

  const loadCourseData = async () => {
    try {
      // Check if user is logged in using the app's auth pattern
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }

      // Load course details
      const courseRes = await fetch(`/api/educational-content/${courseId}`);
      if (courseRes.ok) {
        const courseData = await courseRes.json();
        setCourse(courseData);
      }

      // Load lessons via public endpoint
      const lessonsRes = await fetch(`/api/admin/educational-content/${courseId}/lessons`);
      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json();
        setLessons(Array.isArray(lessonsData) ? lessonsData : []);
        if (Array.isArray(lessonsData) && lessonsData.length > 0) {
          setCurrentLesson(lessonsData[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load course:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLessonComplete = async (lessonId: number) => {
    if (!user) return;

    try {
      await fetch('/api/training/lesson-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          lessonId,
          completed: true,
        }),
      });

      // Update local state
      setLessons(lessons.map(l => 
        l.id === lessonId ? { ...l, completed: true } : l
      ));
    } catch (error) {
      console.error('Failed to mark lesson complete:', error);
    }
  };

  const completedCount = lessons.filter(l => l.completed).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 mb-4">Course not found</p>
          <button
            onClick={() => router.push('/jifunze')}
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium"
          >
            Back to Learning Center
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.push('/jifunze')}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Back to Courses</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="text-sm text-white/60">
                {completedCount}/{lessons.length} lessons completed
              </div>
              <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Lessons Sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center border border-orange-500/20">
                  <AcademicCapIcon className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{course.title}</h2>
                  <p className="text-xs text-white/40">{lessons.length} lessons</p>
                </div>
              </div>

              <div className="space-y-2">
                {lessons.map((lesson, index) => (
                  <button
                    key={lesson.id}
                    onClick={() => setCurrentLesson(lesson)}
                    className={`w-full text-left rounded-xl p-3 transition-all ${
                      currentLesson?.id === lesson.id
                        ? 'bg-orange-500/10 border border-orange-500/20'
                        : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                        lesson.completed
                          ? 'bg-emerald-500/20 border border-emerald-500/40'
                          : 'bg-white/5 border border-white/10'
                      }`}>
                        {lesson.completed ? (
                          <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <span className="text-xs text-white/40">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium mb-1 ${
                          currentLesson?.id === lesson.id ? 'text-orange-400' : 'text-white'
                        }`}>
                          {lesson.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-white/40">
                          <ClockIcon className="h-3 w-3" />
                          {lesson.duration_minutes} min
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lesson Content */}
          <div className="lg:col-span-2">
            {currentLesson ? (
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-8">
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
                    <BookOpenIcon className="h-4 w-4" />
                    Lesson {lessons.findIndex(l => l.id === currentLesson.id) + 1} of {lessons.length}
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-4">{currentLesson.title}</h1>
                  <div className="flex items-center gap-4 text-sm text-white/60">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" />
                      {currentLesson.duration_minutes} minutes
                    </span>
                    <span className="px-2 py-1 rounded-full bg-white/5 text-xs">
                      {currentLesson.language === 'sw' ? '🇹🇿 Swahili' : '🇬🇧 English'}
                    </span>
                  </div>
                </div>

                <div
                  className="prose prose-invert max-w-none text-white/80 leading-relaxed
                    [&_h1]:text-white [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3
                    [&_h2]:text-white [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2
                    [&_h3]:text-white/90 [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2
                    [&_p]:mb-3 [&_p]:text-white/80
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_li]:text-white/80
                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
                    [&_strong]:text-white [&_strong]:font-semibold
                    [&_blockquote]:border-l-2 [&_blockquote]:border-orange-500 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-white/60
                    [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_code]:text-orange-300 [&_code]:text-sm"
                  dangerouslySetInnerHTML={{
                    __html: (marked.parse(currentLesson.content) as string)
                      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                      .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
                      .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
                  }}
                />

                {user && !currentLesson.completed && (
                  <div className="mt-8 pt-6 border-t border-white/10">
                    <button
                      onClick={() => handleLessonComplete(currentLesson.id)}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                      Mark as Complete
                    </button>
                  </div>
                )}

                {currentLesson.completed && (
                  <div className="mt-8 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircleIcon className="h-5 w-5" />
                      <span className="text-sm font-medium">Lesson completed!</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 text-center">
                <PlayCircleIcon className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/40">Select a lesson to start learning</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
