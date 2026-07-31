'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * The member app shell, built to the prototype.
 *
 * Not a dashboard with a sidebar — a phone app. A compact header carrying the
 * group's identity, a 2px rule the whole screen hangs from, one scrolling
 * column, and a five-tab bar with the contribute action raised into the middle.
 * Everything a member does is one thumb-reach from that bar.
 */

export type MemberTab = 'home' | 'group' | 'contribute' | 'governance' | 'me';

const ICON = 'h-[19px] w-[19px]';

function IconHome() {
  return <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 10.5 12 3l9 7.5V21H3z" /></svg>;
}
function IconGroup() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="3.2" />
      <path d="M22 20v-2a4 4 0 0 0-3-3.8" /><path d="M16.5 4.2a3.2 3.2 0 0 1 0 6" />
    </svg>
  );
}
function IconGov() {
  return <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 4h16v16H4z" /><path d="M8 12.5l2.6 2.6L16 9.6" /></svg>;
}
function IconMe() {
  return <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.6" /><path d="M4.5 21c0-4.2 3.4-6.4 7.5-6.4s7.5 2.2 7.5 6.4" /></svg>;
}

function Tab({ active, label, onClick, children }: {
  active: boolean; label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`wd-press flex flex-1 flex-col items-center gap-[5px] py-0.5 transition-colors ${
        active ? 'text-gold-deep' : 'text-ink-3'
      }`}
    >
      {children}
      <span className="text-[8px] font-semibold leading-none tracking-[0.02em]">{label}</span>
    </button>
  );
}

export default function MemberAppShell({
  kicker, title, tab, onTab, unread = 0, onBell,
  avatarUrl, initials, onAvatar, children,
}: {
  kicker: string;
  title: string;
  tab: MemberTab;
  onTab: (t: MemberTab) => void;
  unread?: number;
  onBell: () => void;
  avatarUrl?: string | null;
  initials?: string;
  onAvatar?: () => void;
  children: React.ReactNode;
}) {
  const { t, language, toggleLanguage } = useLanguage();
  // resolvedTheme, not theme: `theme` may be 'system', and the glyph has to
  // show what the user is actually looking at.
  const { resolvedTheme, setTheme } = useTheme();
  const isSw = language === 'sw';
  const isDark = resolvedTheme === 'dark';

  return (
    // Fixed height, not min-height: the shell must be exactly the viewport so
    // `main` is the only thing that scrolls. With min-h the body grows and
    // takes the scroll instead, which drags the header and tab bar off-screen
    // and makes it read as a web page rather than an app.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* ── Header ── */}
      <header
        className="flex flex-none items-end justify-between gap-3 bg-background px-5 pb-2.5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <div className="flex min-w-0 flex-col gap-px">
          <span className="font-mono text-[9px] font-medium uppercase leading-none tracking-[0.16em] text-ink-3">
            {kicker}
          </span>
          <h1 className="truncate font-display text-[19px] font-bold leading-[1.15] tracking-[-0.01em]">
            {title}
          </h1>
        </div>

        <div className="flex flex-none items-center gap-2">
          {/* Language — a segmented pair, not a cycling button: both states are
              always visible so the alternative is legible before you tap. */}
          <button
            onClick={toggleLanguage}
            className="wd-press flex h-[26px] border border-border"
            aria-label={isSw ? 'Switch to English' : 'Badili kwa Kiswahili'}
          >
            <span className={`flex items-center border-r border-border px-[7px] font-mono text-[9px] font-medium leading-none tracking-[0.1em] ${
              isSw ? 'bg-foreground text-background' : 'text-ink-3'
            }`}>SW</span>
            <span className={`flex items-center px-[7px] font-mono text-[9px] font-medium leading-none tracking-[0.1em] ${
              !isSw ? 'bg-foreground text-background' : 'text-ink-3'
            }`}>EN</span>
          </button>

          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="wd-press flex h-[26px] w-[26px] items-center justify-center border border-border text-[11px] text-muted-foreground"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☾' : '☀'}
          </button>

          <button
            onClick={onBell}
            className="wd-press relative flex h-[26px] w-[26px] items-center justify-center border border-border"
            aria-label={t('notif.title')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 min-w-[14px] bg-gold px-[3px] text-center font-mono text-[8px] font-semibold leading-[14px] text-[#1a1714]">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* The member's own face, squared like everything else. Doubles as
              the shortcut into "Mimi" — the one control that is about you
              rather than the group named beside it. */}
          <button
            onClick={onAvatar}
            className="wd-press h-[26px] w-[26px] overflow-hidden border border-border bg-muted"
            aria-label={t('tab.me')}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground">
                {initials || '·'}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* The rule the page hangs from. */}
      <div className="h-0.5 flex-none bg-rule" />

      <main className="scrollbar-none flex-1 overflow-y-auto overflow-x-hidden">{children}</main>

      {/* ── Bottom tab bar ── */}
      <nav
        className="flex flex-none border-t-2 border-rule bg-card px-1.5 pt-2.5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <Tab active={tab === 'home'} label={t('tab.home')} onClick={() => onTab('home')}><IconHome /></Tab>
        <Tab active={tab === 'group'} label={t('tab.group')} onClick={() => onTab('group')}><IconGroup /></Tab>

        {/* Contribute is raised out of the bar: it is the one act the whole
            product exists for, so it does not compete as a peer of the others. */}
        <button
          onClick={() => onTab('contribute')}
          className="wd-press flex w-[54px] flex-none flex-col items-center gap-[5px]"
        >
          <span className="-mt-1 flex h-[34px] w-[34px] items-center justify-center bg-gold text-[#1a1714]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="text-[8px] font-semibold leading-none text-muted-foreground">{t('tab.contribute')}</span>
        </button>

        <Tab active={tab === 'governance'} label={t('tab.governance')} onClick={() => onTab('governance')}><IconGov /></Tab>
        <Tab active={tab === 'me'} label={t('tab.me')} onClick={() => onTab('me')}><IconMe /></Tab>
      </nav>
    </div>
  );
}
