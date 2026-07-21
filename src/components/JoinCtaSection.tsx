'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

export default function JoinCtaSection() {
  const { t } = useLanguage();

  return (
    <section id="join" className="py-24 bg-background">
      <div className="wd-container">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-border bg-card p-10 sm:p-14 text-center shadow-sm"
        >
          {/* warm gold glow */}
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[36rem] max-w-full rounded-full bg-[radial-gradient(closest-side,rgba(228,162,51,0.28),transparent)] blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 right-0 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgba(209,98,43,0.22),transparent)] blur-2xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
              {t('join.eyebrow')}
            </div>
            <h2 className="text-4xl sm:text-5xl text-foreground mb-6">
              {t('join.title')}
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-full hover:bg-primary/90 transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-primary/20"
              >
                {t('hero.cta.entrepreneur')}
                <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-8 py-4 bg-card text-foreground font-semibold rounded-full border border-border hover:bg-muted hover:-translate-y-0.5 transition-all duration-200"
              >
                {t('nav.login')}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
