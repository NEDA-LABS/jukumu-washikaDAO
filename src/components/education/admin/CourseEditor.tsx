'use client';

import { useState } from 'react';
import type { EduCategory } from '@/lib/education/types';
import { SparklesIcon } from '@heroicons/react/24/outline';

interface CourseEditorProps {
  categories: EduCategory[];
  initialData?: {
    title: string;
    description: string;
    difficulty_level: 'beginner' | 'intermediate' | 'advanced';
    language: string;
    category_id: number;
    is_published: boolean;
  };
  onSave: (data: {
    title: string;
    description: string;
    difficulty_level: 'beginner' | 'intermediate' | 'advanced';
    language: string;
    category_id: number;
    is_published: boolean;
  }) => void;
  onGenerateAI?: () => void;
  saving?: boolean;
}

export default function CourseEditor({
  categories,
  initialData,
  onSave,
  onGenerateAI,
  saving,
}: CourseEditorProps) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>(
    initialData?.difficulty_level ?? 'beginner',
  );
  const [language, setLanguage] = useState(initialData?.language ?? 'sw');
  const [categoryId, setCategoryId] = useState(initialData?.category_id ?? (categories[0]?.id ?? 0));
  const [isPublished, setIsPublished] = useState(initialData?.is_published ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      difficulty_level: difficulty,
      language,
      category_id: categoryId,
      is_published: isPublished,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm text-white/60 mb-1.5">Jina la kozi</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Mfano: Misingi ya Bajeti"
          className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-white/30"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm text-white/60 mb-1.5">Maelezo</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Maelezo mafupi ya kozi..."
          className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-white/30 resize-none"
        />
      </div>

      {/* Difficulty + Language row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Kiwango</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
            className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm"
          >
            <option value="beginner">Mwanzo</option>
            <option value="intermediate">Wastani</option>
            <option value="advanced">Juu</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Lugha</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm"
          >
            <option value="sw">Kiswahili</option>
            <option value="en">Kiingereza</option>
          </select>
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm text-white/60 mb-1.5">Kundi</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
          className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Publish toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsPublished(!isPublished)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
            isPublished ? 'bg-orange-500' : 'bg-white/10'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
              isPublished ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-sm text-white/60">
          {isPublished ? 'Imechapishwa' : 'Rasimu'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="bg-orange-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Inahifadhi...' : 'Hifadhi'}
        </button>
        {onGenerateAI && (
          <button
            type="button"
            onClick={onGenerateAI}
            className="flex items-center gap-1.5 border border-white/10 bg-white/5 text-white/70 rounded-lg px-4 py-2 text-sm hover:bg-white/10 transition-colors"
          >
            <SparklesIcon className="w-4 h-4" />
            Tengeneza na AI
          </button>
        )}
      </div>
    </form>
  );
}
