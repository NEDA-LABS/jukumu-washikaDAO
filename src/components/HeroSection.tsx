'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import AnimatedBackground from '@/components/AnimatedBackground';

function HeroContent() {
  const { t } = useLanguage();

  return (
    <div className="text-white w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row justify-between items-start lg:items-center py-16 gap-10">
      {/* Left — big heading */}
      <div className="w-full lg:w-1/2">
        <div className="inline-flex items-center px-4 py-2 mb-6 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
          <span className="text-white/80 text-sm font-medium tracking-wide">
            {t('tagline')}
          </span>
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
          Washika DAU
          <span className="block text-white/75 text-3xl sm:text-4xl lg:text-5xl font-normal mt-2">
            Pamoja Tunajengana
          </span>
        </h1>
      </div>

      {/* Right — description + CTAs */}
      <div className="w-full lg:w-1/2 flex flex-col items-start gap-6">
        <p className="text-lg sm:text-xl text-white/80 leading-relaxed max-w-md">
          {t('hero.subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pointer-events-auto">
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/90 transition-all duration-200 hover:scale-105"
          >
            Jiunge
          </Link>
          <Link
            href="/learn"
            className="inline-flex items-center justify-center px-8 py-3.5 border border-white text-white font-semibold rounded-2xl hover:bg-white hover:text-black transition-all duration-200"
          >
            {t('hero.learn_more')}
          </Link>
        </div>
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
        const maxScroll = 400;
        const opacity = 1 - Math.min(scrollY / maxScroll, 1);
        if (heroContentRef.current) {
          heroContentRef.current.style.opacity = opacity.toString();
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section id="home" className="relative min-h-screen overflow-hidden bg-black">
      {/* Animated canvas background */}
      <AnimatedBackground />

      {/* Hero copy — fades out on scroll */}
      <div
        ref={heroContentRef}
        className="absolute inset-0 z-10 flex items-center pointer-events-none"
      >
        <HeroContent />
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse" />
        </div>
      </div>

      {/* Cover Spline watermark */}
      <div className="absolute bottom-0 right-0 w-40 h-10 z-20 bg-black" />
    </section>
  );
}
