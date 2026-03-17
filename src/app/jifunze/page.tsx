'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AcademicCapIcon,
  BookOpenIcon,
  ClockIcon,
  SparklesIcon,
  CheckCircleIcon,
  PlayCircleIcon,
  ArrowRightIcon,
  UserGroupIcon,
  LightBulbIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface Course {
  id: number;
  title: string;
  description: string;
  language: string;
  difficulty_level: string;
  category: string;
  lesson_count: number;
  total_duration: number;
  is_published: boolean;
  created_at: string;
}

interface UserProgress {
  modulesCompleted: number;
  currentLevel: string;
  pointsEarned: number;
}

export default function JifunzePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userProgress, setUserProgress] = useState<UserProgress>({
    modulesCompleted: 0,
    currentLevel: 'Beginner',
    pointsEarned: 0,
  });
  const [selectedLanguage, setSelectedLanguage] = useState<'all' | 'sw' | 'en'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Check if user is logged in using the app's auth pattern
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      }

      // Load published courses
      const coursesRes = await fetch('/api/educational-content?published=true');
      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        setCourses(Array.isArray(coursesData) ? coursesData : []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(course => {
    const langMatch = selectedLanguage === 'all' || course.language === selectedLanguage;
    const diffMatch = selectedDifficulty === 'all' || course.difficulty_level === selectedDifficulty;
    return langMatch && diffMatch;
  });

  const handleCourseClick = (courseId: number) => {
    if (user) {
      router.push(`/jifunze/course/${courseId}`);
    } else {
      router.push(`/login?redirect=/jifunze/course/${courseId}`);
    }
  };

  const handleDashboardClick = () => {
    if (user?.role === 'member') {
      router.push('/member-dashboard?section=learning');
    } else if (user?.role === 'admin') {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  const difficultyColors = {
    beginner: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    intermediate: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    advanced: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  const difficultyLabels = {
    beginner: 'Mwanzo',
    intermediate: 'Kati',
    advanced: 'Juu',
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <SparklesIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Jifunze - AI-Powered Learning Platform</h1>
                <p className="text-xs text-white/40">Master Financial Literacy & Crypto - Built for Tanzanian Women</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedLanguage(selectedLanguage === 'sw' ? 'en' : 'sw')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-white/60 hover:text-white transition-colors"
              >
                {selectedLanguage === 'sw' ? '🇹🇿 Swahili' : selectedLanguage === 'en' ? '🇬🇧 English' : '🌍 All'}
              </button>
              {user ? (
                <button
                  onClick={handleDashboardClick}
                  className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
                >
                  My Dashboard
                </button>
              ) : (
                <button
                  onClick={() => router.push('/login')}
                  className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Card (for logged-in members) */}
        {user?.role === 'member' && (
          <div className="mb-8 rounded-2xl bg-gradient-to-br from-orange-500/10 via-red-500/5 to-transparent border border-orange-500/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">My Progress</h2>
              <button
                onClick={handleDashboardClick}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
              >
                Continue Learning
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-white/40 mb-1">Modules Completed</p>
                <p className="text-2xl font-bold text-orange-400">{userProgress.modulesCompleted}/3</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-white/40 mb-1">Current Level</p>
                <p className="text-2xl font-bold text-white">{userProgress.currentLevel}</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-white/40 mb-1">Points Earned</p>
                <p className="text-2xl font-bold text-emerald-400">{userProgress.pointsEarned}</p>
              </div>
            </div>
          </div>
        )}

        {/* AI-Powered Features */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <SparklesIcon className="h-6 w-6 text-orange-400" />
            <h2 className="text-2xl font-bold text-white">AI-Powered Learning Experience</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                icon: UserGroupIcon,
                title: 'Personalized Learning Path',
                description: 'AI adapts to your pace, goals, and learning style',
              },
              {
                icon: LightBulbIcon,
                title: 'Real Scenario Analysis',
                description: 'Input your financial situations, get AI-powered guidance',
              },
              {
                icon: PlayCircleIcon,
                title: 'Interactive Practice',
                description: 'Sandbox environment for risk-free learning',
              },
              {
                icon: BookOpenIcon,
                title: 'Audio + Visual Learning',
                description: 'Multiple formats for all learning styles',
              },
            ].map((feature, i) => (
              <div key={i} className="rounded-xl bg-white/[0.02] border border-white/5 p-5 hover:bg-white/[0.04] transition-colors">
                <feature.icon className="h-8 w-8 text-orange-400 mb-3" />
                <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-xs text-white/40">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setSelectedDifficulty('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedDifficulty === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            All Levels
          </button>
          <button
            onClick={() => setSelectedDifficulty('beginner')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedDifficulty === 'beginner'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Beginner
          </button>
          <button
            onClick={() => setSelectedDifficulty('intermediate')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedDifficulty === 'intermediate'
                ? 'bg-blue-500 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Intermediate
          </button>
          <button
            onClick={() => setSelectedDifficulty('advanced')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedDifficulty === 'advanced'
                ? 'bg-purple-500 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Advanced
          </button>
        </div>

        {/* Learning Tracks */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-6">Learning Tracks</h2>
          {filteredCourses.length === 0 ? (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-12 text-center">
              <BookOpenIcon className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">No courses available yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => handleCourseClick(course.id)}
                  className="group rounded-2xl bg-white/[0.02] border border-white/5 hover:border-orange-500/30 p-6 cursor-pointer transition-all hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center border border-orange-500/20">
                      <AcademicCapIcon className="h-6 w-6 text-orange-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-orange-400 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-white/40 mb-4 line-clamp-2">{course.description}</p>

                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs text-white/40">📚 {course.lesson_count} lessons</span>
                    <span className="text-white/20">•</span>
                    <span className="text-xs text-white/40">
                      <ClockIcon className="h-3 w-3 inline mr-1" />
                      {Math.round(course.total_duration / 60)}h
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs px-2 py-1 rounded-full border font-medium ${
                        difficultyColors[course.difficulty_level as keyof typeof difficultyColors] || difficultyColors.beginner
                      }`}
                    >
                      {difficultyLabels[course.difficulty_level as keyof typeof difficultyLabels] || course.difficulty_level}
                    </span>
                    <button className="flex items-center gap-1 text-sm font-medium text-orange-400 group-hover:gap-2 transition-all">
                      Start
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      {!user && (
        <div className="border-t border-white/5 bg-gradient-to-br from-orange-500/10 to-transparent py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Ready to Start Learning?</h2>
            <p className="text-white/60 mb-6">Join thousands of Tanzanian women mastering financial literacy</p>
            <button
              onClick={() => router.push('/signup')}
              className="px-6 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
            >
              Create Free Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
