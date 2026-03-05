'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function HeroSection() {
  const { t } = useLanguage();

  return (
    <section id="home" className="relative min-h-screen overflow-hidden">
      {/* Background with overlay */}
      <div className="absolute inset-0">
        <Image
          src="/PXL_20250618_121651832.PORTRAIT.jpg"
          alt="JUKUMU Community"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center px-4 py-2 bg-primary/20 backdrop-blur-sm rounded-full border border-primary/30">
                  <span className="text-primary-foreground/80 text-sm font-medium">
                    {t('tagline')}
                  </span>
                </div>
                
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight">
                  <span className="block">JUKUMU</span>
                  <span className="block text-secondary text-3xl sm:text-4xl lg:text-5xl font-normal mt-2">
                    Kuunganisha Wajasiriamali
                  </span>
                </h1>
                
                <p className="text-xl sm:text-2xl text-gray-200 leading-relaxed max-w-2xl">
                  {t('hero.subtitle')}
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/register" className="inline-flex items-center justify-center px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                  Jiunge
                </Link>
                <Link href="/learn" className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg border border-white/20 hover:bg-white/20 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                  {t('hero.learn_more')}
                </Link>
              </div>

            </div>

            {/* Right Visual - Image Grid */}
            <div className="lg:col-span-5 relative">
              <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-8 shadow-2xl">
                <div className="space-y-4">
                  <h3 className="text-white text-2xl font-semibold">Kuanza ni rahisi</h3>
                  <p className="text-gray-200 leading-relaxed">
                    Jisajili, ungana na jamii ya wajasiriamali, na anza kupata mafunzo na msaada wa ukuaji.
                  </p>
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200">
                      Mafunzo ya biashara
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200">
                      Mtandao wa vikundi
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-200">
                      Ufuatiliaji wa maendeleo
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating elements */}
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full border border-white/15"></div>
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full border border-white/15"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  );
}
