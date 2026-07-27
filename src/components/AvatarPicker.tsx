'use client';

import React, { useRef, useState } from 'react';
import { readImageAsResizedDataUrl } from '@/lib/imageResize';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Compact "circle + upload" avatar picker used by profile / group-logo forms.
 * Fully controlled: parent owns the `value` (data URL or null) and receives a
 * new value via `onChange` after the picked file is resized client-side.
 */
export default function AvatarPicker({
  value,
  onChange,
  fallbackText = '?',
  size = 96,
  shape = 'circle',
  label = 'Upload',
  helper,
}: {
  value: string | null | undefined;
  onChange: (dataUrl: string | null) => void;
  fallbackText?: string;
  size?: number;
  shape?: 'circle' | 'square';
  label?: string;
  helper?: string;
}) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(''); setBusy(true);
    try {
      const dataUrl = await readImageAsResizedDataUrl(file);
      onChange(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`relative shrink-0 flex items-center justify-center ${rounded} bg-muted border-2 border-dashed border-border overflow-hidden hover:border-primary/50 transition-colors`}
        style={{ width: size, height: size }}
        aria-label={label}
      >
        {value ? (
          <img src={value} alt="" className={`w-full h-full object-cover ${rounded}`} />
        ) : (
          <span className="text-xl font-bold text-muted-foreground">{fallbackText.charAt(0).toUpperCase()}</span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-muted hover:bg-border text-foreground text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {busy ? '…' : (value ? t('img.change') : label)}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setError(''); }}
              className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-destructive text-xs font-semibold transition-colors"
            >
              {t('img.remove')}
            </button>
          )}
        </div>
        {helper && <p className="text-[11px] text-muted-foreground mt-1">{helper}</p>}
        {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
