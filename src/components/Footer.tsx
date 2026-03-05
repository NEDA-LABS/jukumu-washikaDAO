'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { MapPinIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-primary to-destructive">
                <span className="text-sm font-bold text-white">J</span>
              </div>
              <div>
                <h3 className="text-lg font-bold">JUKUMU Fund</h3>
              </div>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              {t('tagline')}
            </p>
            <p className="text-muted/70 text-xs">
              Kujenga uchumi wa mzunguko endelevu kupitia ushirikiano na uongozi wa kijamii.
            </p>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">{t('footer.contact')}</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <EnvelopeIcon className="h-5 w-5 text-primary" />
                <span className="text-muted text-sm">info@jukumufund.co.tz</span>
              </div>
              <div className="flex items-center space-x-3">
                <PhoneIcon className="h-5 w-5 text-primary" />
                <div className="flex flex-col space-y-1">
                  <span className="text-muted text-sm">+255 746 134 450</span>
                  <span className="text-muted text-sm">+255 687 161 651</span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <MapPinIcon className="h-5 w-5 text-primary" />
                <span className="text-muted text-sm">Dar es Salaam, Tanzania</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('footer.quick_links')}</h3>
            <ul className="space-y-2">
              <li>
                <a href="/#home" className="text-muted hover:text-white transition-colors duration-200">
                  <span>{t('nav.home')}</span>
                </a>
              </li>
              <li>
                <a href="/#about" className="text-muted hover:text-white transition-colors duration-200">
                  <span>{t('nav.about')}</span>
                </a>
              </li>
              <li>
                <a href="/register" className="text-muted hover:text-white transition-colors duration-200">
                  <span>{t('nav.join')}</span>
                </a>
              </li>
              <li>
                <a href="/investor" className="text-muted hover:text-white transition-colors duration-200">
                  <span>{t('nav.investor')}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Social Media & Legal */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">{t('footer.social')}</h4>
            <div className="flex space-x-4">
              <a href="#" className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors duration-200">
                <span className="text-xs font-bold">f</span>
              </a>
              <a href="#" className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center hover:bg-blue-500 transition-colors duration-200">
                <span className="text-xs font-bold">t</span>
              </a>
              <a href="#" className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center hover:bg-blue-800 transition-colors duration-200">
                <span className="text-xs font-bold">in</span>
              </a>
              <a href="#" className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center hover:bg-green-700 transition-colors duration-200">
                <span className="text-xs font-bold">w</span>
              </a>
            </div>
            
            <div className="space-y-2 pt-4">
              <h5 className="text-sm font-semibold text-muted/70">{t('footer.legal')}</h5>
              <Link href="/privacy" className="block text-muted/70 hover:text-primary transition-colors duration-200 text-xs">
                {t('footer.privacy')}
              </Link>
              <Link href="/terms" className="block text-muted/70 hover:text-primary transition-colors duration-200 text-xs">
                {t('footer.terms')}
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-muted/20 mt-8 pt-8 text-center">
          <p className="text-muted/70 text-sm">
            © 2024 JUKUMU Fund. Haki zote zimehifadhiwa.
          </p>
        </div>
      </div>
    </footer>
  );
}
