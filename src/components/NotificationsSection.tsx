'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BellIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon,
  CurrencyDollarIcon, UserGroupIcon, DocumentTextIcon, BellAlertIcon,
} from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';
import { pushSupported, getPushSubscription, subscribeToPush, unsubscribeFromPush } from '@/lib/push-client';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  is_read: boolean;
  action_url?: string;
  action_text?: string;
  metadata?: { title_en?: string; message_en?: string; [k: string]: unknown } | null;
  created_at: string;
}

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  wallet: CurrencyDollarIcon,
  group: UserGroupIcon,
  proposal: DocumentTextIcon,
  general: InformationCircleIcon,
};

const TYPE_STYLE: Record<string, { ring: string; text: string; bg: string }> = {
  success: { ring: 'ring-emerald-500/20', text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  warning: { ring: 'ring-amber-500/20', text: 'text-amber-500', bg: 'bg-amber-500/10' },
  error: { ring: 'ring-red-500/20', text: 'text-red-500', bg: 'bg-red-500/10' },
  info: { ring: 'ring-primary/20', text: 'text-primary', bg: 'bg-primary/10' },
};

export default function NotificationsSection({ userId }: { userId: number }) {
  const { t, language } = useLanguage();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?userId=${userId}&limit=50&unreadOnly=${filter === 'unread'}`);
      const data = await res.json();
      setItems(data.notifications || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [userId, filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getPushSubscription().then((s) => setPushOn(!!s)); }, []);

  const markRead = async (id: number) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await fetch('/api/notifications', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, notificationId: id }),
    }).catch(() => {});
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await fetch('/api/notifications', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, markAllRead: true }),
    }).catch(() => {});
  };

  const togglePush = async () => {
    setPushMsg('');
    if (!pushSupported()) { setPushMsg(t('notif.pushUnsupported')); return; }
    setPushBusy(true);
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
      } else {
        const r = await subscribeToPush(userId);
        if (r.ok) { setPushOn(true); setPushMsg(t('notif.pushEnabled')); }
        else setPushMsg(r.reason === 'denied' ? t('notif.pushDenied') : t('notif.pushUnsupported'));
      }
    } finally { setPushBusy(false); }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t('notif.justNow');
    if (m < 60) return `${m} ${t('notif.minAgo')}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ${t('notif.hourAgo')}`;
    return `${Math.floor(h / 24)} ${t('notif.dayAgo')}`;
  };

  const title = (n: Notification) => (language === 'en' && n.metadata?.title_en) ? n.metadata.title_en : n.title;
  const message = (n: Notification) => (language === 'en' && n.metadata?.message_en) ? n.metadata.message_en : n.message;

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl sm:text-3xl text-foreground flex items-center gap-2">
          <BellIcon className="h-6 w-6 text-primary" />
          {t('notif.title')}
        </h2>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
            {t('notif.markAllRead')}
          </button>
        )}
      </div>

      {/* Push toggle */}
      <button
        onClick={togglePush}
        disabled={pushBusy}
        className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left disabled:opacity-60 ${
          pushOn ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-card border-border hover:border-primary/30'
        }`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pushOn ? 'bg-emerald-500/15 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
          <BellAlertIcon className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {pushOn ? t('notif.pushEnabled') : t('notif.enablePush')}
          </p>
          {pushMsg && <p className="text-xs text-muted-foreground mt-0.5">{pushMsg}</p>}
        </div>
        <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${pushOn ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}>
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${pushOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
      </button>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(f === 'all' ? 'notif.all' : 'notif.unread')}
            {f === 'unread' && unreadCount > 0 && <span className="ml-1.5">{unreadCount}</span>}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <BellIcon className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">{t('notif.empty')}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">{t('notif.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = CATEGORY_ICON[n.category] || InformationCircleIcon;
            const st = TYPE_STYLE[n.type] || TYPE_STYLE.info;
            const inner = (
              <>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${st.bg} ${st.ring} ${st.text}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${n.is_read ? 'font-medium text-foreground/80' : 'font-bold text-foreground'}`}>{title(n)}</p>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{message(n)}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </>
            );
            const cls = `w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
              n.is_read ? 'bg-card border-border' : 'bg-card border-primary/25 shadow-sm'
            } hover:border-primary/40`;
            return n.action_url ? (
              <a key={n.id} href={n.action_url} onClick={() => !n.is_read && markRead(n.id)} className={cls}>{inner}</a>
            ) : (
              <button key={n.id} onClick={() => !n.is_read && markRead(n.id)} className={cls}>{inner}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
