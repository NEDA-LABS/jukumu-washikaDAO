'use client';

import { useState } from 'react';
import LessonContent from '../lesson/LessonContent';
import {
  SparklesIcon,
  EyeIcon,
  PencilSquareIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

interface LessonEditorProps {
  initialData?: {
    title: string;
    content: string;
    duration_minutes: number;
    lesson_order: number;
  };
  onSave: (data: {
    title: string;
    content: string;
    duration_minutes: number;
    lesson_order: number;
  }) => void;
  onRegenerate?: () => void;
  onReorder?: (direction: 'up' | 'down') => void;
  saving?: boolean;
}

export default function LessonEditor({
  initialData,
  onSave,
  onRegenerate,
  onReorder,
  saving,
}: LessonEditorProps) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [duration, setDuration] = useState(initialData?.duration_minutes ?? 10);
  const [order, setOrder] = useState(initialData?.lesson_order ?? 1);
  const [preview, setPreview] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      content,
      duration_minutes: duration,
      lesson_order: order,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title + Order controls */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm text-white/60 mb-1.5">
            Jina la somo
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Mfano: Utangulizi wa Bajeti"
            className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-white/30"
          />
        </div>
        {onReorder && (
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onReorder('up')}
              className="p-1 border border-white/10 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <ChevronUpIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onReorder('down')}
              className="p-1 border border-white/10 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <ChevronDownIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm text-white/60 mb-1.5">
          Muda (dakika)
        </label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          min={1}
          className="w-32 bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm"
        />
      </div>

      {/* Content area with preview toggle */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm text-white/60">Maudhui (Markdown)</label>
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
          >
            {preview ? (
              <>
                <PencilSquareIcon className="w-3.5 h-3.5" />
                Hariri
              </>
            ) : (
              <>
                <EyeIcon className="w-3.5 h-3.5" />
                Hakiki
              </>
            )}
          </button>
        </div>

        {preview ? (
          <div className="min-h-[300px] bg-white/[0.02] border border-white/10 rounded-lg p-4">
            <LessonContent content={content} />
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            placeholder="Andika maudhui ya somo kwa Markdown..."
            className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm font-mono placeholder:text-white/30 resize-y"
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || !title.trim() || !content.trim()}
          className="bg-orange-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Inahifadhi...' : 'Hifadhi'}
        </button>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="flex items-center gap-1.5 border border-white/10 bg-white/5 text-white/70 rounded-lg px-4 py-2 text-sm hover:bg-white/10 transition-colors"
          >
            <SparklesIcon className="w-4 h-4" />
            Tengeneza upya na AI
          </button>
        )}
      </div>
    </form>
  );
}
