'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import ThemeToggle from '@/components/ThemeToggle';
import Logo from '@/components/Logo';

export default function Header() {
  const { language, toggleLanguage, t } = useLanguage();
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLElement | null>(null);

  // The header is fixed, so it takes no space in flow and page content slides
  // underneath it. Its height is not a constant — the nav wraps to a second row
  // on narrow screens, Swahili labels are longer than English, and the safe-area
  // inset varies by device. So it publishes its own measured height and pages
  // offset by that, instead of a magic number that silently goes stale.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty('--wd-header-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    publish();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', publish);
      return () => window.removeEventListener('resize', publish);
    }
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, [language]);

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      // Always show at the very top
      if (current < 10) {
        setVisible(true);
      } else {
        setVisible(current < lastScrollY.current);
      }
      lastScrollY.current = current;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navigation = [
    { name: t('nav.home'), href: '/#home' },
    { name: t('nav.about'), href: '/#about' },
    { name: t('nav.join'), href: '/register' },
    { name: t('nav.investor'), href: '/investor' },
  ];

  // The 2px rule under the header is structural, not decorative: it is the line
  // the whole page hangs from. Hairlines are for rhythm inside a section; this
  // one separates chrome from content.
  return (
    <header ref={headerRef} className={`fixed w-full top-0 z-50 bg-background/80 backdrop-blur-xl border-b-2 border-rule transition-transform duration-300 ${visible ? 'translate-y-0' : '-translate-y-full'}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <nav className="wd-container" aria-label="Top">
        <div className="flex w-full items-center justify-between py-4">
          <div className="flex items-center">
            <Link href="/" className="flex items-center transition-transform duration-200 hover:scale-[1.03] active:scale-100">
              <Logo className="h-10 w-auto" />
            </Link>
          </div>

          <div className="hidden lg:ml-8 lg:flex lg:space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-muted"
              >
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          <div className="ml-6 flex items-center space-x-4">
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="rounded-full border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors duration-200"
            >
              <span>{language === 'sw' ? 'EN' : 'SW'}</span>
            </button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Login Button */}
            <Link
              href="/login"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors duration-200"
            >
              {t('nav.login')}
            </Link>
          </div>
        </div>

        {/* Mobile nav — inline row directly under the bar (no dropdown) */}
        <div className="lg:hidden flex items-center justify-center gap-1 pb-2.5 -mt-1 overflow-x-auto scrollbar-none">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200"
            >
              {item.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
