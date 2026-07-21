'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import ScrollExpandSection from '@/components/ScrollExpandSection';

export default function InvestorSection() {
  const { t } = useLanguage();

  return (
    <section id="investor" className="bg-background py-24">
      <div className="wd-container">

        {/* Eyebrow */}
        <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">
          Wekeza
        </p>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl text-foreground max-w-2xl leading-tight mb-6">
          {t('investor.title')}
        </h2>

        <p className="text-lg text-muted-foreground max-w-xl mb-16">
          Tunashirikiana na wawekezaji ambao wanaelewa kwamba ukuaji wa kweli unaanzia katika jamii.
        </p>

        {/* Two-column: image left, model right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

          {/* Photo */}
          <div className="group relative aspect-[4/3] rounded-2xl overflow-hidden ring-1 ring-border">
            <Image
              src="/PXL_20250805_160021888.PORTRAIT.jpg"
              alt="WashikaDAO community"
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>

          {/* Model explanation — honest, no fake numbers */}
          <div className="flex flex-col gap-10">

            <ScrollExpandSection startScale={0.9} startRadius={12} startOpacity={0.5}>
              <div className="border-l-2 border-primary pl-6 transition-all duration-300 hover:pl-7 hover:border-l-4">
                <h3 className="text-xl text-foreground mb-2">Mfumo wa Hisa</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Unapowekeza katika kundi la WashikaDAO, unapata hisa ya moja kwa moja ndani ya biashara zao.
                  Mapato yanashirikiwa kwa uwazi kulingana na mikataba iliyowekwa wazi.
                </p>
              </div>
            </ScrollExpandSection>

            <ScrollExpandSection startScale={0.9} startRadius={12} startOpacity={0.5}>
              <div className="border-l-2 border-border pl-6 transition-all duration-300 hover:pl-7 hover:border-l-4 hover:border-primary">
                <h3 className="text-xl text-foreground mb-2">Ufuatiliaji wa Wakati Halisi</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Kila muamala, malipo, na mkutano wa kundi unaweza kuonekana kupitia dashibodi yetu.
                  Uwazi kamili — hakuna siri.
                </p>
              </div>
            </ScrollExpandSection>

            <ScrollExpandSection startScale={0.9} startRadius={12} startOpacity={0.5}>
              <div className="border-l-2 border-border pl-6 transition-all duration-300 hover:pl-7 hover:border-l-4 hover:border-primary">
                <h3 className="text-xl text-foreground mb-2">Athari ya Kijamii</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Uwekezaji wako unasaidia wajasiriamali wadogo kupata mtaji, mafunzo, na mtandao wa
                  kuwaendeleza biashara zao.
                </p>
              </div>
            </ScrollExpandSection>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/investor"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors"
              >
                {t('investor.cta')}
              </Link>
              <a
                href="mailto:invest@jukumufund.co.tz"
                className="inline-flex items-center justify-center px-8 py-3.5 border border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-colors"
              >
                Wasiliana nasi
              </a>
            </div>

          </div>
        </div>

        {/* Bottom image strip — real community, no captions needed */}
        <div className="grid grid-cols-3 gap-4 mt-16">
          {[
            '/PXL_20250815_151019991.PORTRAIT.jpg',
            '/PXL_20250618_114941185.MP.jpg',
            '/PXL_20250731_150045170.PORTRAIT.jpg',
          ].map((src, i) => (
            <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden">
              <Image src={src} alt="" fill className="object-cover hover:scale-105 transition-transform duration-500" />
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
