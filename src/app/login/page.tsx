'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import AnimatedBackground from '@/components/AnimatedBackground';
import Header from '@/components/Header';

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: formData.identifier,
          password: formData.password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Role-based redirect
        if (data.user.role === 'admin') {
          router.push('/dashboard');
        } else if (data.user.role === 'investor') {
          router.push('/investor/dashboard');
        } else {
          router.push('/member-dashboard');
        }
      } else {
        let errorData: { error?: string } | null = null;
        try {
          errorData = await response.json();
        } catch {
          errorData = null;
        }

        if (response.status === 409) {
          setError(
            errorData?.error ||
              'Namba ya simu inatumika kwenye akaunti zaidi ya moja. Tafadhali ingia kwa barua pepe au wasiliana nasi.'
          );
        } else if (response.status === 500) {
          const details =
            typeof (errorData as { details?: unknown } | null)?.details === 'string'
              ? ` (${(errorData as { details?: string }).details})`
              : '';
          const requestId =
            typeof (errorData as { requestId?: unknown } | null)?.requestId === 'string'
              ? ` [${(errorData as { requestId?: string }).requestId}]`
              : '';
          setError((errorData?.error || 'Hitilafu imetokea. Jaribu tena.') + details + requestId);
        } else {
          setError('Barua pepe/nambari ya simu au nywila si sahihi. Hakikisha umesajili kwanza.');
        }
      }
    } catch (error: unknown) {
      console.error('Login error:', error);
      setError('Hitilafu imetokea. Jaribu tena.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <Header />
    <div className="min-h-screen bg-background flex pt-[68px]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <AnimatedBackground />

        <div className="relative z-10 space-y-8 mt-auto">
          <div>
            <h2 className="text-3xl font-bold text-foreground leading-tight mb-3">
              {t('login.welcome.l1')}<br />{t('login.welcome.l2')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('login.welcome.sub')}
            </p>
          </div>

          <div className="space-y-3">
            {[t('login.feature1'), t('login.feature2'), t('login.feature3')].map((label, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted border border-border">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground relative z-10 mt-auto">© {new Date().getFullYear()} Washika DAU · {t('common.platform')}</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-1">{t('login.heading')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('login.no_account')}{' '}
              <Link href="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
                {t('login.register_here')}
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="identifier" className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {t('login.field.identifier')}
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                required
                value={formData.identifier}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
                placeholder={t('login.ph.identifier')}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                inputMode="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('login.field.password')}
                </label>
                <a href="#" className="text-xs text-primary/70 hover:text-primary transition-colors">
                  {t('login.forgot')}
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all pr-11"
                  placeholder={t('login.ph.password')}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  {showPassword ? <EyeSlashIcon className="h-4.5 w-4.5" /> : <EyeIcon className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="w-4 h-4 accent-primary rounded"
              />
              <label htmlFor="remember-me" className="text-xs text-muted-foreground">{t('login.remember')}</label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-semibold transition-colors shadow-lg shadow-primary/20 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  {t('login.submitting')}
                </span>
              ) : t('login.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
