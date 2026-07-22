'use client';

import React, { useState } from 'react';
import { XMarkIcon, LinkIcon, ShareIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ShareGroupModal({
  groupName,
  groupCode,
  onClose,
}: {
  groupName: string;
  groupCode: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const appUrl = (typeof window !== 'undefined' ? window.location.origin : 'https://jukumu.netlify.app');
  const joinUrl = `${appUrl}/register?groupCode=${encodeURIComponent(groupCode)}`;
  const message = `${t('share.msgJoin')} "${groupName}" ${t('share.msgOn')} 🐝\n${t('share.msgCode')}: ${groupCode}\n${joinUrl}`;

  const enc = encodeURIComponent;
  const channels: { key: string; label: string; href?: string; color: string; icon: React.ReactNode }[] = [
    { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', href: `https://wa.me/?text=${enc(message)}`,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.8 1-.2.2-.3.2-.6.1-1.5-.7-2.5-1.3-3.5-3-.3-.5.3-.4.8-1.4.1-.2 0-.3 0-.5s-.6-1.5-.9-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.7.8-1 1.7-1 2.7 0 1.6 1.1 3.1 1.3 3.4.2.2 2.3 3.5 5.5 4.7 2 .8 2.8.9 3.8.7.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg> },
    { key: 'telegram', label: 'Telegram', color: '#0088CC', href: `https://t.me/share/url?url=${enc(joinUrl)}&text=${enc(message)}`,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M21.9 4.3l-3 14.1c-.2 1-.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.2.2-.5.5-.9.5l.3-4.7 8.5-7.7c.4-.3-.1-.5-.6-.2L7.5 13 3 11.6c-1-.3-1-1 .2-1.5l17.2-6.6c.8-.3 1.5.2 1.5 1.3z"/></svg> },
    { key: 'x', label: 'X', color: '#000000', href: `https://twitter.com/intent/tweet?text=${enc(message)}`,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M18.9 2H22l-7.3 8.3L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.8-8.9L1 2h6.9l4.8 6.3L18.9 2zm-1.2 18h1.7L7.4 3.8H5.5L17.7 20z"/></svg> },
    { key: 'sms', label: 'SMS', color: '#22A45D', href: `sms:?body=${enc(message)}`,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.1 1 4 2.8 5.4-.1 1-.5 2.3-1.4 3.4 1.6-.2 3.2-.8 4.4-1.7 1.3.4 2.7.6 4.2.6 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg> },
  ];

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: groupName, text: message, url: joinUrl }); } catch { /* cancelled */ }
    } else { copyLink(); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl overflow-hidden pb-safe">
        <div className="sm:hidden flex justify-center pt-3"><span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" /></div>
        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-border">
          <div>
            <h3 className="font-display text-lg text-foreground">{t('share.title')}</h3>
            <p className="text-xs text-muted-foreground">{t('share.desc')}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Group code chip */}
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted border border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t('share.msgCode')}</p>
              <p className="font-mono font-bold text-foreground tracking-wider truncate">{groupCode}</p>
            </div>
            <button onClick={copyLink} className="shrink-0 flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/20 transition-colors">
              {copied ? <CheckIcon className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
              {copied ? t('share.copied') : t('share.copy')}
            </button>
          </div>

          {/* Channels */}
          <div className="grid grid-cols-4 gap-3">
            {channels.map((c) => (
              <a
                key={c.key}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 group"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md group-hover:-translate-y-0.5 transition-transform" style={{ background: c.color }}>
                  {c.icon}
                </span>
                <span className="text-[11px] text-muted-foreground">{c.label}</span>
              </a>
            ))}
          </div>

          <button onClick={nativeShare} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#d1622b] to-[#e4a233] text-white text-sm font-semibold shadow-lg shadow-primary/25">
            <ShareIcon className="h-4 w-4" />
            {t('share.more')}
          </button>
        </div>
      </div>
    </div>
  );
}
