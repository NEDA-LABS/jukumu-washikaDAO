'use client';

import { useState } from 'react';
import type { AssessmentOption } from '@/lib/education/types';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface QuestionData {
  id?: number;
  scenario_text: string;
  options: AssessmentOption[];
  correct_option: string;
  explanation: string;
  skill_tag: string;
}

interface AssessmentEditorProps {
  questions: QuestionData[];
  onChange: (questions: QuestionData[]) => void;
  onRegenerate?: () => void;
}

function QuestionEditor({
  question,
  onSave,
  onCancel,
}: {
  question: QuestionData;
  onSave: (q: QuestionData) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState<QuestionData>({ ...question });

  const updateOption = (index: number, text: string) => {
    const options = [...q.options];
    options[index] = { ...options[index], text };
    setQ({ ...q, options });
  };

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-4">
      <div>
        <label className="block text-sm text-white/60 mb-1">Hali (Scenario)</label>
        <textarea
          value={q.scenario_text}
          onChange={(e) => setQ({ ...q, scenario_text: e.target.value })}
          rows={3}
          className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-white/30 resize-none"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-white/60">Chaguzi</label>
        {q.options.map((opt, i) => (
          <div key={opt.label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQ({ ...q, correct_option: opt.label })}
              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                q.correct_option === opt.label
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-white/20 text-white/60 hover:border-white/40'
              }`}
            >
              {opt.label}
            </button>
            <input
              type="text"
              value={opt.text}
              onChange={(e) => updateOption(i, e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm placeholder:text-white/30"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-white/60 mb-1">Ujuzi (Skill tag)</label>
          <input
            type="text"
            value={q.skill_tag}
            onChange={(e) => setQ({ ...q, skill_tag: e.target.value })}
            placeholder="mfano: bajeti"
            className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm placeholder:text-white/30"
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">Jibu sahihi</label>
          <select
            value={q.correct_option}
            onChange={(e) => setQ({ ...q, correct_option: e.target.value })}
            className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm"
          >
            {q.options.map((o) => (
              <option key={o.label} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">Maelezo (Explanation)</label>
        <textarea
          value={q.explanation}
          onChange={(e) => setQ({ ...q, explanation: e.target.value })}
          rows={2}
          className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-white/30 resize-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSave(q)}
          className="flex items-center gap-1 bg-orange-500 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-orange-600 transition-colors"
        >
          <CheckIcon className="w-4 h-4" />
          Hifadhi
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 border border-white/10 text-white/60 rounded-lg px-3 py-1.5 text-sm hover:bg-white/5 transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
          Ghairi
        </button>
      </div>
    </div>
  );
}

export default function AssessmentEditor({
  questions,
  onChange,
  onRegenerate,
}: AssessmentEditorProps) {
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addQuestion = () => {
    const newQ: QuestionData = {
      scenario_text: '',
      options: [
        { label: 'A', text: '' },
        { label: 'B', text: '' },
        { label: 'C', text: '' },
        { label: 'D', text: '' },
      ],
      correct_option: 'A',
      explanation: '',
      skill_tag: '',
    };
    onChange([...questions, newQ]);
    setEditIndex(questions.length);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  const saveQuestion = (index: number, q: QuestionData) => {
    const updated = [...questions];
    updated[index] = q;
    onChange(updated);
    setEditIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">
          Maswali ({questions.length})
        </h3>
        <div className="flex items-center gap-2">
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center gap-1.5 border border-white/10 bg-white/5 text-white/70 rounded-lg px-3 py-1.5 text-sm hover:bg-white/10 transition-colors"
            >
              <SparklesIcon className="w-4 h-4" />
              Tengeneza upya
            </button>
          )}
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-1 bg-orange-500 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-orange-600 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Ongeza
          </button>
        </div>
      </div>

      {/* Question list */}
      <div className="space-y-3">
        {questions.map((q, i) =>
          editIndex === i ? (
            <QuestionEditor
              key={i}
              question={q}
              onSave={(updated) => saveQuestion(i, updated)}
              onCancel={() => setEditIndex(null)}
            />
          ) : (
            <div
              key={i}
              className="bg-white/[0.02] border border-white/10 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/80 line-clamp-2 mb-1">
                    {q.scenario_text || 'Swali tupu'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <span>Jibu: {q.correct_option}</span>
                    {q.skill_tag && (
                      <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                        {q.skill_tag}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditIndex(i)}
                    className="p-1.5 text-white/40 hover:text-white transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(i)}
                    className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      {questions.length === 0 && (
        <div className="text-center py-6 text-white/40 text-sm">
          Hakuna maswali bado. Bonyeza &quot;Ongeza&quot; kuongeza swali.
        </div>
      )}
    </div>
  );
}
