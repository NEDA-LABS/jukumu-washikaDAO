'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { SunIcon, MoonIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import Logo from '@/components/Logo';
import NotificationBell from '@/components/NotificationBell';

/**
 * Consistent dark top bar for dashboard sub-pages: brand + optional back
 * button + language and theme toggles. Dark-styled so it reads on the
 * dashboard's warm-dark background.
 */
export default function DashTopBar({ back, homeHref = '/member-dashboard' }: { back?: string; homeHref?: string }) {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();

  const pill = 'rounded-full border border-border bg-muted hover:bg-border text-foreground transition-colors';

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 lg:px-6 h-16 border-b border-border bg-background/80 backdrop-blur-xl" style={{ height: 'calc(4rem + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center gap-2.5 min-w-0">
        {back && (
          <button
            onClick={() => router.push(back)}
            className={`${pill} p-2 -ml-1 shrink-0`}
            aria-label="Back"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
        )}
        <Link href={homeHref} className="flex items-center gap-2 min-w-0">
          <Logo markOnly className="h-7 w-auto shrink-0" />
          <span className="text-sm font-bold text-foreground truncate">Washika<span className="text-gold">DAU</span></span>
        </Link>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell variant="dark" />
        <button onClick={toggleLanguage} className={`${pill} px-3 py-1.5 text-xs font-semibold`}>
          {language === 'sw' ? 'EN' : 'SW'}
        </button>
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className={`${pill} p-2`}
          aria-label={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {resolvedTheme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
