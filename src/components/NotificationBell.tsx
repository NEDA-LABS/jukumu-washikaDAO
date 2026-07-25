'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';

type Notification = {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | string;
  category: string;
  is_read: boolean;
  action_url?: string | null;
  metadata?: { title_en?: string; message_en?: string; [k: string]: unknown } | null;
  created_at: string;
};

const TYPE_DOT: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-primary',
};

/**
 * Bell button with an inline popover panel — click opens a dropdown listing
 * the recent notifications. No redirect: individual rows link out via their
 * own action_url; a "View all" link at the footer takes power users to the
 * full section. Reads the auth'd user from localStorage so it's drop-in on
 * any dashboard sub-page (main dashboard header, DashTopBar, etc.).
 *
 * `variant="dark"` reuses the DashTopBar pill styling.
 */
export default function NotificationBell({
  variant = 'default',
  viewAllHref = '/member-dashboard?section=notifications',
}: {
  variant?: 'default' | 'dark';
  viewAllHref?: string;
}) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('user') : null;
    if (!raw) return;
    try { setUserId(JSON.parse(raw)?.id ?? null); } catch { /* ignore */ }
  }, []);

  // Unread count polling
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const fetchUnread = () => {
      fetch(`/api/notifications?userId=${userId}&unreadOnly=true&limit=1`)
        .then((r) => r.json())
        .then((d) => { if (alive) setUnread(d.unreadCount ?? 0); })
        .catch(() => {});
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => { alive = false; clearInterval(id); };
  }, [userId]);

  // Load recent items when the panel is opened
  const loadItems = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?userId=${userId}&limit=8`);
      const data = await res.json();
      setItems(data.notifications || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    if (open) loadItems();
  }, [open, loadItems]);

  // Click-outside / Escape to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markRead = async (id: number) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
    fetch('/api/notifications', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, notificationId: id }),
    }).catch(() => {});
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    fetch('/api/notifications', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, markAllRead: true }),
    }).catch(() => {});
  };

  const clickItem = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    setOpen(false);
    if (n.action_url) router.push(n.action_url);
  };

  const localizedTitle = (n: Notification) => (language === 'en' && n.metadata?.title_en) ? n.metadata.title_en : n.title;
  const localizedMsg   = (n: Notification) => (language === 'en' && n.metadata?.message_en) ? n.metadata.message_en : n.message;

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const button = variant === 'dark'
    ? 'rounded-full border border-border bg-muted hover:bg-border text-foreground transition-colors p-2 relative'
    : 'relative rounded-full border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground p-2 transition-colors';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={button}
        aria-label={t('notif.title')}
        aria-expanded={open}
      >
        <BellIcon className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#d1622b] text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top,0px)+4rem)] max-w-sm mx-auto sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 sm:max-w-none sm:mx-0 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden z-50"
          role="menu"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">{t('notif.title')}</p>
            {items.some(n => !n.is_read) && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                {t('notif.markAllRead')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[60vh] overflow-y-auto overscroll-contain divide-y divide-border">
            {loading ? (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <BellIcon className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-sm font-semibold text-foreground">{t('notif.empty')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('notif.emptyDesc')}</p>
              </div>
            ) : items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => clickItem(n)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted transition-colors ${n.is_read ? '' : 'bg-primary/[0.04]'}`}
              >
                <span className={`shrink-0 mt-1.5 h-2 w-2 rounded-full ${n.is_read ? 'bg-transparent border border-border' : TYPE_DOT[n.type] || 'bg-primary'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{localizedTitle(n)}</p>
                  {localizedMsg(n) && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{localizedMsg(n)}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <button
            onClick={() => { setOpen(false); router.push(viewAllHref); }}
            className="w-full px-4 py-2.5 border-t border-border text-xs font-semibold text-primary hover:bg-muted transition-colors text-center"
          >
            {t('notif.viewAll')} →
          </button>
        </div>
      )}
    </div>
  );
}
