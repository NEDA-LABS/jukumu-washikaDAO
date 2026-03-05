'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import ThemeToggle from '@/components/ThemeToggle';

export default function Header() {
  const { language, toggleLanguage, t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigation = [
    { name: t('nav.home'), href: '/#home' },
    { name: t('nav.about'), href: '/#about' },
    { name: t('nav.join'), href: '/register' },
    { name: t('nav.investor'), href: '/investor' },
  ];

  return (
    <header className="fixed w-full top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div className="flex w-full items-center justify-between py-5">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground">
                <span className="text-lg font-bold text-background">J</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">JUKUMU</h1>
              </div>
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

            {/* Mobile menu button */}
            <div className="flex lg:hidden">
              <button
                type="button"
                className="rounded-md bg-card p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <span className="sr-only">Open menu</span>
                {isMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`${isMenuOpen ? 'block' : 'hidden'} lg:hidden`}>
          <div className="space-y-1 px-2 pb-3 pt-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setIsMenuOpen(false)}
              >
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
