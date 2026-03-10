'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import FocusRail from '@/components/FocusRail';

export default function AboutSection() {
  const { t } = useLanguage();

  const items = [
    {
      id: 1,
      meta: '1',
      title: t('how_it_works.step1.title'),
      description: t('how_it_works.step1.text'),
      imageSrc: '/PXL_20250531_114540969.PORTRAIT.jpg',
    },
    {
      id: 2,
      meta: '2',
      title: t('how_it_works.step2.title'),
      description: t('how_it_works.step2.text'),
      imageSrc: '/PXL_20250618_114941185.MP.jpg',
    },
    {
      id: 3,
      meta: '3',
      title: t('how_it_works.step3.title'),
      description: t('how_it_works.step3.text'),
      imageSrc: '/PXL_20250707_145652539.PORTRAIT.jpg',
    },
    {
      id: 4,
      meta: '4',
      title: t('how_it_works.step4.title'),
      description: t('how_it_works.step4.text'),
      imageSrc: '/PXL_20250716_145812315.PORTRAIT.jpg',
    },
  ];

  return (
    <section id="about" className="w-full">
      <FocusRail
        items={items}
        eyebrow="Mchakato Wetu"
        heading="Washika DAU mfumo wa vikundi kidijitali"
        subheading="Fuata hatua hizi nne za kimsingi kujiunge na jamii yetu ya wajasiriamali"
        loop
        autoPlay={false}
      />
    </section>
  );
}
