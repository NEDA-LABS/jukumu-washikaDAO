'use client';

import React from 'react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';

export default function AboutSection() {
  const { t } = useLanguage();

  const features = [
    {
      title: t('how_it_works.step1.title'),
      description: t('how_it_works.step1.text'),
      image: '/PXL_20250531_114540969.PORTRAIT.jpg',
    },
    {
      title: t('how_it_works.step2.title'),
      description: t('how_it_works.step2.text'),
      image: '/PXL_20250618_114941185.MP.jpg',
    },
    {
      title: t('how_it_works.step3.title'),
      description: t('how_it_works.step3.text'),
      image: '/PXL_20250707_145652539.PORTRAIT.jpg',
    },
    {
      title: t('how_it_works.step4.title'),
      description: t('how_it_works.step4.text'),
      image: '/PXL_20250716_145812315.PORTRAIT.jpg',
    },
  ];

  return (
    <section id="about" className="relative py-24 bg-background overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-0">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f97316' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* How It Works - Redesigned */}
        <div className="space-y-10">
          <div className="text-center">
            <div className="text-sm font-semibold text-muted-foreground tracking-wide uppercase mb-6">Mchakato Wetu</div>
            <h3 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
              {t('how_it_works.title')}
            </h3>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Fuata hatua hizi nne za kimsingi kujiunge na jamii yetu ya wajasiriamali
            </p>
          </div>

          <div>
            <div className="-mx-4 px-4 overflow-x-auto pb-4">
              <div className="flex gap-6 snap-x snap-mandatory scroll-px-4">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    className="snap-center shrink-0 w-[85%] sm:w-[70%] lg:w-[55%]"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    viewport={{ once: true, amount: 0.4 }}
                  >
                    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
                      <div className="relative h-56 sm:h-64">
                        <Image
                          src={feature.image}
                          alt={feature.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="p-8">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full border border-primary/20 text-primary bg-accent flex items-center justify-center font-semibold">
                            {index + 1}
                          </div>
                          <div className="h-px flex-1 bg-border"></div>
                        </div>
                        <h4 className="text-2xl font-semibold text-foreground mb-3">{feature.title}</h4>
                        <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="text-center text-sm text-muted-foreground">Teleza kushoto/kulia kuona hatua zote</div>
          </div>
        </div>
      </div>
    </section>
  );
}
