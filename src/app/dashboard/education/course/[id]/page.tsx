'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CourseEditor from '@/components/education/admin/CourseEditor';
import LessonEditor from '@/components/education/admin/LessonEditor';
import AssessmentEditor from '@/components/education/admin/AssessmentEditor';
import DocumentUploader from '@/components/education/admin/DocumentUploader';
import type { EduCategory, EduCourse, EduLesson, AssessmentOption } from '@/lib/education/types';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  AcademicCapIcon,
  ClipboardDocumentCheckIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface QuestionData {
  id?: number;
  scenario_text: string;
  options: AssessmentOption[];
  correct_option: string;
  explanation: string;
  skill_tag: string;
}

interface AssessmentData {
  id: number;
  type: string;
  title: string | null;
  passing_score: number;
  questions: QuestionData[];
}

type Tab = 'info' | 'lessons' | 'assessments';

export default function CourseEditorPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const isNew = courseId === 'new';

  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [categories, setCategories] = useState<EduCategory[]>([]);
  const [course, setCourse] = useState<EduCourse | null>(null);
  const [lessons, setLessons] = useState<EduLesson[]>([]);
  const [assessments, setAssessments] = useState<AssessmentData[]>([]);
  const [editingLessonIndex, setEditingLessonIndex] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch categories
      const catRes = await fetch('/api/education/categories');
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(Array.isArray(catData) ? catData : []);
      }

      if (!isNew) {
        // Fetch course
        const courseRes = await fetch(`/api/education/courses/${courseId}`);
        if (!courseRes.ok) throw new Error('Kozi haijapatikana');
        setCourse(await courseRes.json());

        // Fetch lessons
        const lessonsRes = await fetch(`/api/education/courses/${courseId}/lessons`);
        if (lessonsRes.ok) {
          const lessonsData = await lessonsRes.json();
          setLessons(Array.isArray(lessonsData) ? lessonsData.sort((a: EduLesson, b: EduLesson) => a.lesson_order - b.lesson_order) : []);
        }

        // Fetch assessments
        const assessRes = await fetch(`/api/admin/education/courses/${courseId}/assessments`);
        if (assessRes.ok) {
          const assessData = await assessRes.json();
          setAssessments(Array.isArray(assessData) ? assessData : []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea');
    } finally {
      setLoading(false);
    }
  }, [courseId, isNew]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showMessage = (msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setSuccess(null);
    } else {
      setSuccess(msg);
      setError(null);
    }
    setTimeout(() => { setError(null); setSuccess(null); }, 3000);
  };

  const handleSaveCourse = async (data: {
    title: string;
    description: string;
    difficulty_level: 'beginner' | 'intermediate' | 'advanced';
    language: string;
    category_id: number;
    is_published: boolean;
  }) => {
    setSaving(true);
    try {
      const url = isNew ? '/api/admin/education/courses' : `/api/admin/education/courses/${courseId}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Imeshindikana kuhifadhi');
      const saved = await res.json();
      setCourse(saved);
      if (isNew) {
        router.replace(`/dashboard/education/course/${saved.id}`);
      }
      showMessage('Kozi imehifadhiwa!');
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Hitilafu', true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLesson = async (data: {
    title: string;
    content: string;
    duration_minutes: number;
    lesson_order: number;
  }, existingId?: number) => {
    setSaving(true);
    try {
      const url = existingId
        ? `/api/admin/education/lessons/${existingId}`
        : `/api/admin/education/courses/${courseId}/lessons`;
      const method = existingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Imeshindikana kuhifadhi somo');
      showMessage('Somo limehifadhiwa!');
      // Reload lessons
      const lessonsRes = await fetch(`/api/education/courses/${courseId}/lessons`);
      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json();
        setLessons(Array.isArray(lessonsData) ? lessonsData.sort((a: EduLesson, b: EduLesson) => a.lesson_order - b.lesson_order) : []);
      }
      setEditingLessonIndex(null);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Hitilafu', true);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (!confirm('Una uhakika unataka kufuta somo hili?')) return;
    try {
      const res = await fetch(`/api/admin/education/lessons/${lessonId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Imeshindikana kufuta');
      setLessons((prev) => prev.filter((l) => l.id !== lessonId));
      showMessage('Somo limefutwa.');
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Hitilafu', true);
    }
  };

  const handleAssessmentQuestionsChange = async (assessmentIndex: number, questions: QuestionData[]) => {
    const assessment = assessments[assessmentIndex];
    if (!assessment) return;
    try {
      const res = await fetch(`/api/admin/education/assessments/${assessment.id}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });
      if (!res.ok) throw new Error('Imeshindikana kuhifadhi maswali');
      setAssessments((prev) =>
        prev.map((a, i) => (i === assessmentIndex ? { ...a, questions } : a))
      );
      showMessage('Maswali yamehifadhiwa!');
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Hitilafu', true);
    }
  };

  const handleDocUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('course_id', courseId);
    try {
      const res = await fetch('/api/admin/education/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Kupakia imeshindikana');
      const data = await res.json();
      return { preview: data.preview };
    } catch {
      return { error: 'Kupakia imeshindikana' };
    }
  };

  const handleGenerateAI = async () => {
    if (!course) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/education/courses/${courseId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_prompt: course.title,
          lesson_count: 5,
          language: course.language,
          difficulty: course.difficulty_level,
          category_id: course.category_id,
        }),
      });
      if (!res.ok) throw new Error('AI generation imeshindikana');
      showMessage('Maudhui yametengenezwa na AI!');
      await loadData();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Hitilafu', true);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof BookOpenIcon }[] = [
    { id: 'info', label: 'Taarifa za Kozi', icon: BookOpenIcon },
    { id: 'lessons', label: 'Masomo', icon: AcademicCapIcon },
    { id: 'assessments', label: 'Tathmini', icon: ClipboardDocumentCheckIcon },
  ];

  if (loading) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/dashboard')} className="text-white/60 hover:text-white transition-colors">
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold text-white">
                {isNew ? 'Kozi Mpya' : (course?.title ?? 'Hariri Kozi')}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {!isNew && (
                <button
                  onClick={() => router.push(`/dashboard/education/course/${courseId}/preview`)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-colors"
                >
                  <EyeIcon className="h-4 w-4" />
                  Hakiki
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      {(error || success) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-400">{success}</div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex gap-1 border-b border-white/5 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !isNew && setActiveTab(tab.id)}
              disabled={isNew && tab.id !== 'info'}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-white/40 hover:text-white/60'
              } ${isNew && tab.id !== 'info' ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Course Info Tab */}
        {activeTab === 'info' && (
          <div className="max-w-2xl">
            <CourseEditor
              categories={categories}
              initialData={course ? {
                title: course.title,
                description: course.description ?? '',
                difficulty_level: course.difficulty_level,
                language: course.language,
                category_id: course.category_id,
                is_published: course.is_published,
              } : undefined}
              onSave={handleSaveCourse}
              onGenerateAI={!isNew ? handleGenerateAI : undefined}
              saving={saving}
            />

            {!isNew && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-white/60 mb-3">Pakia Hati</h3>
                <DocumentUploader onUpload={handleDocUpload} />
              </div>
            )}
          </div>
        )}

        {/* Lessons Tab */}
        {activeTab === 'lessons' && !isNew && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Masomo ({lessons.length})</h2>
              <button
                onClick={() => setEditingLessonIndex(-1)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Ongeza Somo
              </button>
            </div>

            {/* New lesson form */}
            {editingLessonIndex === -1 && (
              <div className="rounded-xl bg-white/[0.02] border border-orange-500/20 p-4">
                <h3 className="text-sm font-semibold text-orange-400 mb-3">Somo Jipya</h3>
                <LessonEditor
                  initialData={{
                    title: '',
                    content: '',
                    duration_minutes: 10,
                    lesson_order: lessons.length + 1,
                  }}
                  onSave={(data) => handleSaveLesson(data)}
                  saving={saving}
                />
              </div>
            )}

            {/* Existing lessons */}
            {lessons.map((lesson, index) => (
              <div key={lesson.id} className="rounded-xl bg-white/[0.02] border border-white/10 p-4">
                {editingLessonIndex === index ? (
                  <LessonEditor
                    initialData={{
                      title: lesson.title,
                      content: lesson.content,
                      duration_minutes: lesson.duration_minutes,
                      lesson_order: lesson.lesson_order,
                    }}
                    onSave={(data) => handleSaveLesson(data, lesson.id)}
                    onReorder={(dir) => {
                      // Simple reorder: swap with adjacent
                      const swapIdx = dir === 'up' ? index - 1 : index + 1;
                      if (swapIdx >= 0 && swapIdx < lessons.length) {
                        const updated = [...lessons];
                        [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
                        setLessons(updated);
                      }
                    }}
                    saving={saving}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm font-bold text-white/40">
                        {lesson.lesson_order}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{lesson.title}</h3>
                        <p className="text-xs text-white/40">{lesson.duration_minutes} dakika</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingLessonIndex(index)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition-colors"
                      >
                        Hariri
                      </button>
                      <button
                        onClick={() => handleDeleteLesson(lesson.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Assessments Tab */}
        {activeTab === 'assessments' && !isNew && (
          <div className="space-y-6">
            {assessments.length === 0 ? (
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-12 text-center">
                <ClipboardDocumentCheckIcon className="h-12 w-12 text-white/15 mx-auto mb-4" />
                <p className="text-white/40 text-sm">
                  Hakuna tathmini bado. Tumia AI kutengeneza maudhui ya kozi na tathmini zitaongezwa moja kwa moja.
                </p>
                <button
                  onClick={handleGenerateAI}
                  disabled={saving}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors mx-auto disabled:opacity-50"
                >
                  <SparklesIcon className="h-4 w-4" />
                  {saving ? 'Inaendelea...' : 'Tengeneza na AI'}
                </button>
              </div>
            ) : (
              assessments.map((assessment, idx) => (
                <div key={assessment.id} className="rounded-xl bg-white/[0.02] border border-white/10 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {assessment.title || `Tathmini #${assessment.id}`}
                      </h3>
                      <p className="text-xs text-white/40">
                        Aina: {assessment.type} | Alama ya kufaulu: {assessment.passing_score}%
                      </p>
                    </div>
                  </div>
                  <AssessmentEditor
                    questions={assessment.questions}
                    onChange={(questions) => handleAssessmentQuestionsChange(idx, questions)}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
