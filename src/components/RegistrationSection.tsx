'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import AnimatedBackground from '@/components/AnimatedBackground';
import Header from '@/components/Header';

export default function RegistrationSection({ title }: { title?: string }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    location: '',
    businessType: '',
    idType: '',
    idNumber: '',
    gender: '',
    age: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError(t('register.err.mismatch'));
      setIsSubmitting(false);
      return;
    }

    try {
      const authResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim() || null,
          phone: formData.phone,
          password: formData.password,
          fullName: formData.fullName,
          location: formData.location,
          businessType: formData.businessType,
          idType: formData.idType,
          idNumber: formData.idNumber,
          gender: formData.gender,
          age: formData.age,
        }),
      });

      if (authResponse.ok) {
        const authData = await authResponse.json();
        localStorage.setItem('user', JSON.stringify(authData.user));
        if (authData.user.role === 'admin') {
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/member-dashboard';
        }
      } else {
        const authError = await authResponse.json();
        throw new Error(authError.error || 'Usajili umeshindwa. Jaribu tena.');
      }
    } catch (error: unknown) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'Hitilafu imetokea. Jaribu tena.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fi = 'w-full px-4 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all';
  const lbl = 'block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5';
  const sel = `${fi} text-muted-foreground [&>option]:bg-card [&>option]:text-foreground`;

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{t('register.success.title')}</h2>
          <p className="text-sm text-muted-foreground mb-8">
            {t('register.success.text')}
          </p>
          <Link href="/login" className="block w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors text-center shadow-lg shadow-primary/20">
            {t('register.success.cta')}
          </Link>
          <button
            onClick={() => {
              setIsSubmitted(false);
              setFormData({ fullName: '', email: '', phone: '', password: '', confirmPassword: '', location: '', businessType: '', idType: '', idNumber: '', gender: '', age: '' });
            }}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('register.register_another')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <Header />
    <div className="min-h-screen bg-background flex pt-[calc(68px_+_env(safe-area-inset-top))]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[38%] xl:w-[35%] flex-col justify-between p-12 border-r border-border relative overflow-hidden shrink-0">
        <AnimatedBackground />

        <div className="relative z-10 space-y-6 mt-auto">
          <div>
            <h2 className="text-3xl font-bold text-foreground leading-tight mb-3">
              {t('register.welcome.l1')}<br />{t('register.welcome.l2')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('register.welcome.sub')}
            </p>
          </div>
          <div className="space-y-2.5">
            {[
              t('register.feature1'),
              t('register.feature2'),
              t('register.feature3'),
              t('register.feature4'),
            ].map((label, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted border border-border">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground relative z-10 mt-auto">© {new Date().getFullYear()} Washika DAU · {t('common.platform')}</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center px-6 py-12">
          <div className="w-full max-w-2xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-1">{t('register.heading')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('register.have_account')}{' '}
                <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
                  {t('register.login_here')}
                </Link>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}

              {/* Section: Personal */}
              <div className="rounded-2xl bg-muted border border-border p-5 space-y-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('register.section.personal')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className={lbl}>{t('register.f.fullname')} *</label>
                    <input type="text" id="fullName" name="fullName" required value={formData.fullName} onChange={handleChange} className={fi} placeholder={t('register.ph.fullname')} />
                  </div>
                  <div>
                    <label htmlFor="phone" className={lbl}>{t('register.f.phone')} *</label>
                    <input type="tel" id="phone" name="phone" required value={formData.phone} onChange={handleChange} className={fi} placeholder="+255 7xx xxx xxx" />
                  </div>
                  <div>
                    <label htmlFor="email" className={lbl}>{t('register.f.email')} <span className="normal-case text-muted-foreground">{t('register.optional')}</span></label>
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className={fi} placeholder="email@example.com" />
                  </div>
                  <div>
                    <label htmlFor="location" className={lbl}>{t('register.f.location')} *</label>
                    <input type="text" id="location" name="location" required value={formData.location} onChange={handleChange} className={fi} placeholder="Dar es Salaam" />
                  </div>
                  <div>
                    <label htmlFor="gender" className={lbl}>{t('register.f.gender')} *</label>
                    <select id="gender" name="gender" required value={formData.gender} onChange={handleChange} className={sel}>
                      <option value="">{t('register.opt.select_gender')}</option>
                      <option value="mwanamke">{t('register.gender.female')}</option>
                      <option value="mwanamume">{t('register.gender.male')}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="age" className={lbl}>{t('register.f.age')} *</label>
                    <input type="number" id="age" name="age" required min="18" max="100" value={formData.age} onChange={handleChange} className={fi} placeholder={t('register.ph.age')} />
                  </div>
                </div>
              </div>

              {/* Section: Business & ID */}
              <div className="rounded-2xl bg-muted border border-border p-5 space-y-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('register.section.business')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="businessType" className={lbl}>{t('register.f.business')} *</label>
                    <select id="businessType" name="businessType" required value={formData.businessType} onChange={handleChange} className={sel}>
                      <option value="">{t('register.opt.select_type')}</option>
                      <option value="kilimo">{t('register.biz.agriculture')}</option>
                      <option value="ufugaji">{t('register.biz.livestock')}</option>
                      <option value="biashara_ndogo">{t('register.biz.small')}</option>
                      <option value="sanaa">{t('register.biz.arts')}</option>
                      <option value="huduma">{t('register.biz.services')}</option>
                      <option value="teknolojia">{t('register.biz.tech')}</option>
                      <option value="nyingine">{t('register.biz.other')}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="idType" className={lbl}>{t('register.f.idtype')} *</label>
                    <select id="idType" name="idType" required value={formData.idType} onChange={handleChange} className={sel}>
                      <option value="">{t('register.opt.select_type')}</option>
                      <option value="national_id">{t('register.id.national')}</option>
                      <option value="voter_id">{t('register.id.voter')}</option>
                      <option value="passport">{t('register.id.passport')}</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="idNumber" className={lbl}>{t('register.f.idnumber')} *</label>
                    <input type="text" id="idNumber" name="idNumber" required value={formData.idNumber} onChange={handleChange} className={fi} placeholder={t('register.ph.idnumber')} />
                  </div>
                </div>
              </div>

              {/* Section: Password */}
              <div className="rounded-2xl bg-muted border border-border p-5 space-y-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('register.section.password')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className={lbl}>{t('register.f.password')} *</label>
                    <input type="password" id="password" name="password" required value={formData.password} onChange={handleChange} className={fi} placeholder={t('register.ph.password')} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="new-password" />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className={lbl}>{t('register.f.confirm')} *</label>
                    <input type="password" id="confirmPassword" name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange} className={fi} placeholder={t('register.ph.confirm')} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="new-password" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-semibold transition-colors shadow-lg shadow-primary/20"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    {t('register.submitting')}
                  </span>
                ) : `${t('register.submit')} →`}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                {t('register.terms')}
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
