'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
  fixed?: boolean;
}

const config = {
  success: {
    bar: 'bg-emerald-500',
    icon: (
      <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    iconBg: 'bg-emerald-500/10',
    label: 'text-emerald-400',
  },
  error: {
    bar: 'bg-red-500',
    icon: (
      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    iconBg: 'bg-red-500/10',
    label: 'text-red-400',
  },
  info: {
    bar: 'bg-blue-500',
    icon: (
      <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-blue-500/10',
    label: 'text-blue-400',
  },
};

export default function Toast({ message, type = 'info', onClose, duration = 4000, fixed = true }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enterFrame = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(timer);
    };
  }, [duration, onClose]);

  const c = config[type];

  return (
    <div
      className={`
        ${fixed ? 'fixed top-4 right-4 z-50' : ''}
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
    >
      <div className="relative overflow-hidden rounded-xl bg-[#1e1e1e] border border-white/10 shadow-2xl shadow-black/40 min-w-[280px] max-w-sm">
        <div className="flex items-start gap-3 px-4 py-3 pr-9">
          <div className={`mt-0.5 w-7 h-7 rounded-lg ${c.iconBg} flex items-center justify-center shrink-0`}>
            {c.icon}
          </div>
          <p className="text-sm text-white/80 leading-5 pt-0.5">{message}</p>
        </div>
        <button
          onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
          className="absolute top-3 right-3 text-white/20 hover:text-white/60 transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className={`absolute bottom-0 left-0 h-0.5 w-full ${c.bar} opacity-60`} />
      </div>
    </div>
  );
}
