"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, DollarSign, BarChart3, Users, Globe,
  Sparkles, ArrowRight, GraduationCap,
  ShieldCheck, Zap, LogIn,
} from "lucide-react";
import RadialOrbitalTimeline, { TimelineItem } from "@/components/ui/radial-orbital-timeline";

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

const categoryIcons: Record<string, React.ElementType> = {
  Fedha: DollarSign,
  Biashara: BarChart3,
  Uongozi: Users,
  Teknolojia: Globe,
  Akiba: ShieldCheck,
  Finance: DollarSign,
  Business: BarChart3,
  Leadership: Users,
};

function mapCoursesToTimeline(courses: Course[]): TimelineItem[] {
  return courses.map((course, index) => {
    const energy = Math.min(100, Math.max(20, (course.lesson_count || 1) * 14));
    const relatedIds: number[] = [];
    if (index > 0) relatedIds.push(courses[index - 1].id);
    if (index < courses.length - 1) relatedIds.push(courses[index + 1].id);
    const icon = categoryIcons[course.category] || BookOpen;
    const d = new Date(course.created_at);
    const date = isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("sw-TZ", { month: "short", year: "numeric" });
    return {
      id: course.id,
      title: course.title,
      date,
      content: course.description || "",
      category: course.category || "Biashara",
      icon,
      relatedIds,
      status: "completed" as const,
      energy,
      lessonCount: course.lesson_count || 0,
    };
  });
}

export default function LearnPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const userData = localStorage.getItem("user");
    if (userData) setUser(JSON.parse(userData));
    fetch("/api/educational-content?published=true")
      .then((r) => r.json())
      .then((data) => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setError("Imeshindikana kupakia kozi."))
      .finally(() => setLoading(false));
  }, []);

  const handleNodeClick = (courseId: number) => {
    if (user) {
      router.push(`/jifunze/course/${courseId}`);
    } else {
      router.push(`/login?redirect=/jifunze/course/${courseId}`);
    }
  };

  const timelineData = mapCoursesToTimeline(courses);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-600 animate-pulse flex items-center justify-center">
            <BookOpen className="text-white" size={28} />
          </div>
          <p className="text-white/40 text-sm animate-pulse">Inapakia kozi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold hidden sm:block">Jukumu</span>
          </button>
          <div className="flex items-center gap-2">
            {user ? (
              <button
                onClick={() => router.push(user.role === "admin" ? "/dashboard" : "/member-dashboard")}
                className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition-colors"
              >
                Dashibodi
              </button>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 transition-colors"
              >
                <LogIn size={12} /> Ingia
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="text-center pt-8 pb-2 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium mb-4">
          <Sparkles size={12} /> AI-Powered Learning Platform
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
          Jifunze · Kua · Fanikiwa
        </h1>
        <p className="text-white/40 text-sm sm:text-base max-w-lg mx-auto">
          Gonga kozi yoyote kwenye mzunguko ili uanze safari yako ya kujifunza.
        </p>
      </div>

      {/* Stats */}
      {courses.length > 0 && (
        <div className="flex items-center justify-center gap-6 py-3 px-4">
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <GraduationCap size={13} className="text-orange-400" />
            <span><strong className="text-white">{courses.length}</strong> kozi</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <BookOpen size={13} className="text-orange-400" />
            <span><strong className="text-white">{courses.reduce((s, c) => s + (c.lesson_count || 0), 0)}</strong> masomo</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Zap size={13} className="text-orange-400" />
            <span>AI Generated</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 relative">
        {error && (
          <div className="flex items-center justify-center h-64">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        {!error && courses.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 px-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <BookOpen size={28} className="text-white/20" />
            </div>
            <p className="text-white/40 text-sm text-center">
              Hakuna kozi zilizochapishwa bado.
            </p>
          </div>
        )}
        {!error && courses.length > 0 && (
          <>
            {/* Desktop: orbital */}
            <div className="hidden sm:block" style={{ height: "calc(100vh - 240px)", minHeight: 420 }}>
              <RadialOrbitalTimeline timelineData={timelineData} onNodeClick={handleNodeClick} />
            </div>
            {/* Mobile: card list */}
            <div className="sm:hidden px-4 pb-8 pt-2">
              <div className="grid grid-cols-1 gap-3">
                {courses.map((course) => {
                  const Icon = categoryIcons[course.category] || BookOpen;
                  return (
                    <button
                      key={course.id}
                      onClick={() => handleNodeClick(course.id)}
                      className="w-full text-left rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 transition-colors active:border-orange-500/40"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 flex items-center justify-center shrink-0">
                          <Icon size={18} className="text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{course.title}</p>
                          <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{course.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-white/30">{course.lesson_count || 0} masomo</span>
                            <span className="text-white/20">·</span>
                            <span className="text-[10px] text-orange-400/60 capitalize">{course.difficulty_level || "beginner"}</span>
                          </div>
                        </div>
                        <ArrowRight size={14} className="text-orange-400 mt-1 shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer CTA */}
      {!user && courses.length > 0 && (
        <div className="border-t border-white/5 bg-gradient-to-r from-orange-500/5 to-transparent px-4 py-6">
          <div className="max-w-lg mx-auto text-center">
            <p className="text-sm text-white/50 mb-3">
              Ingia ili ufuatilie maendeleo yako na upate cheti baada ya kukamilisha kozi.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
            >
              Ingia Sasa <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
