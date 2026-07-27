'use client';

import React from 'react';
import CourseLibrary from '@/components/education/library/CourseLibrary';
import DashTopBar from '@/components/DashTopBar';

export default function JifunzePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashTopBar back="/member-dashboard?section=learning" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CourseLibrary />
      </main>
    </div>
  );
}
