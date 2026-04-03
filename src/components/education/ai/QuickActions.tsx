'use client';

type ActionType = 'explain_more' | 'another_example' | 'my_situation';

interface QuickActionsProps {
  onAction: (action: ActionType) => void;
  disabled?: boolean;
}

const actions: { type: ActionType; label: string }[] = [
  { type: 'explain_more', label: 'Eleza zaidi' },
  { type: 'another_example', label: 'Mfano mwingine' },
  { type: 'my_situation', label: 'Hali yangu' },
];

export default function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.type}
          type="button"
          onClick={() => onAction(a.type)}
          disabled={disabled}
          className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
