'use client';

import React from 'react';
import CourseLibrary from '@/components/education/library/CourseLibrary';

export default function JifunzePage() {
  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-white">Jifunze</h1>
            <p className="text-sm text-white/40 hidden sm:block">Learn</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CourseLibrary />
      </main>
    </div>
  );
}
