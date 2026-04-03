'use client';

interface ProgressBarProps {
  completed: number;
  total: number;
  label?: string;
}

export default function ProgressBar({ completed, total, label }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-white/60">{label}</span>
          <span className="text-sm text-white/40">
            {completed}/{total} ({percentage}%)
          </span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
