'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import Logo from '@/components/Logo';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">

          {/* Logo */}
          <div className="flex items-center">
            <Logo className="h-9 w-auto" />
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="/#about" className="hover:text-foreground transition-colors">{t('nav.about')}</a>
            <a href="/register" className="hover:text-foreground transition-colors">{t('nav.join')}</a>
            <a href="/investor" className="hover:text-foreground transition-colors">{t('nav.investor')}</a>
            <a href="mailto:info@jukumufund.co.tz" className="hover:text-foreground transition-colors">
              info@jukumufund.co.tz
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Washika DAU Fund
          </p>

        </div>
      </div>
    </footer>
  );
}
