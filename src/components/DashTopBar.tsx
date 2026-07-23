'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { SunIcon, MoonIcon, ArrowLeftIcon, BellIcon } from '@heroicons/react/24/outline';
import Logo from '@/components/Logo';

/**
 * Consistent dark top bar for dashboard sub-pages: brand + optional back
 * button + language and theme toggles. Dark-styled so it reads on the
 * dashboard's warm-dark background.
 */
export default function DashTopBar({ back, homeHref = '/member-dashboard' }: { back?: string; homeHref?: string }) {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('user') : null;
    if (!raw) return;
    let userId: number | undefined;
    try { userId = JSON.parse(raw)?.id; } catch { /* ignore */ }
    if (!userId) return;
    const fetchUnread = () => {
      fetch(`/api/notifications?userId=${userId}&unreadOnly=true&limit=1`)
        .then(r => r.json())
        .then(d => { if (alive) setUnread(d.unreadCount ?? 0); })
        .catch(() => {});
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

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
          <span className="text-sm font-bold text-foreground truncate">Washika<span className="text-[#e4a233]">DAU</span></span>
        </Link>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => router.push('/member-dashboard?section=notifications')}
          className={`${pill} p-2 relative`}
          aria-label="Notifications"
        >
          <BellIcon className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#d1622b] text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
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
