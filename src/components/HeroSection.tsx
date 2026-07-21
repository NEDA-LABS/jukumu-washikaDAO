'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import AnimatedBackground from '@/components/AnimatedBackground';

function HeroContent() {
  const { t } = useLanguage();

  const stats = [
    { value: '120+', label: t('hero.stat.groups') },
    { value: '200+', label: t('hero.stat.businesses') },
    { value: '42+', label: t('hero.stat.trainers') },
  ];

  return (
    <div className="wd-container flex flex-col items-center text-center py-28 sm:py-32">
      {/* Badge */}
      <div
        className="wd-rise inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full border border-border bg-card/70 backdrop-blur-sm shadow-sm"
        style={{ animationDelay: '0ms' }}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
        </span>
        <span className="text-foreground/70 text-sm font-medium tracking-wide">
          {t('tagline')}
        </span>
      </div>

      {/* Headline */}
      <h1
        className="wd-rise text-[3.25rem] leading-[1.02] sm:text-7xl lg:text-8xl text-foreground max-w-4xl"
        style={{ animationDelay: '90ms' }}
      >
        Washika<span className="text-gold"> DAU</span>
      </h1>
      <p
        className="wd-rise mt-5 font-display text-2xl sm:text-3xl text-foreground/55 italic"
        style={{ animationDelay: '150ms' }}
      >
        {t('hero.motto')}
      </p>

      {/* Subtitle */}
      <p
        className="wd-rise mt-7 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl"
        style={{ animationDelay: '220ms' }}
      >
        {t('hero.subtitle')}
      </p>

      {/* CTAs */}
      <div
        className="wd-rise mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto"
        style={{ animationDelay: '300ms' }}
      >
        <Link
          href="/register"
          className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground text-sm font-semibold rounded-full transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0"
        >
          {t('hero.cta.join')}
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        </Link>
        <Link
          href="/learn"
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-card/70 backdrop-blur-sm text-foreground text-sm font-semibold rounded-full border border-border hover:bg-card hover:-translate-y-0.5 transition-all duration-200"
        >
          {t('hero.learn_more')}
        </Link>
      </div>

      {/* Stat row */}
      <div
        className="wd-rise mt-16 grid grid-cols-3 gap-3 sm:gap-6 w-full max-w-lg"
        style={{ animationDelay: '380ms' }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="group rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-3 py-4 transition-all duration-300 hover:-translate-y-1 hover:border-gold/50 hover:shadow-md"
          >
            <div className="font-display text-2xl sm:text-3xl text-foreground group-hover:text-gold transition-colors">
              {s.value}
            </div>
            <div className="mt-1 text-xs sm:text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HeroSection() {
  const heroContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      requestAnimationFrame(() => {
        const scrollY = window.pageYOffset;
        const maxScroll = 500;
        const opacity = 1 - Math.min(scrollY / maxScroll, 1) * 0.85;
        const translate = Math.min(scrollY / maxScroll, 1) * 40;
        if (heroContentRef.current) {
          heroContentRef.current.style.opacity = opacity.toString();
          heroContentRef.current.style.transform = `translateY(${translate}px)`;
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section id="home" className="relative min-h-screen overflow-hidden bg-background">
      {/* Animated theme-aware background */}
      <AnimatedBackground />

      {/* Soft top fade so the fixed header blends into the hero */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/80 to-transparent z-10" />

      {/* Hero copy */}
      <div ref={heroContentRef} className="relative z-20 flex min-h-screen items-center will-change-transform">
        <HeroContent />
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce">
        <div className="w-6 h-10 border-2 border-foreground/25 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-foreground/40 rounded-full mt-2 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
