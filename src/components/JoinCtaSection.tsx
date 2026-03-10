'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function JoinCtaSection() {
  const { t } = useLanguage();

  return (
    <section id="join" className="py-24 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-border bg-muted p-10 sm:p-12 text-center shadow-sm">
            <div className="text-sm font-semibold text-muted-foreground tracking-wide uppercase mb-4">Jiunge</div>
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
              Jiunge na sisi Leo
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-full hover:bg-primary/90 transition-colors duration-200"
              >
                {t('hero.cta.entrepreneur')}
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-8 py-4 bg-card text-foreground font-semibold rounded-full border border-border hover:bg-muted transition-colors duration-200"
              >
                {t('nav.login')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
