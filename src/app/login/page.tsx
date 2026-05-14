'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function LoginPage() {
  const { } = useLanguage();
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
    <div className="min-h-screen bg-[#0d0d0d] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between p-12 border-r border-white/[0.05] relative overflow-hidden">
        <AnimatedBackground />

        <Link href="/" className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <span className="text-lg font-black text-white">W</span>
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Washika DAU</p>
            <p className="text-[10px] text-white/30 mt-0.5">Jukumu Platform</p>
          </div>
        </Link>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight mb-3">
              Karibu tena<br />kwenye jamii yako
            </h2>
            <p className="text-sm text-white/40 leading-relaxed">
              Ingia kuendelea na safari yako ya biashara, mafunzo, na uwekezaji pamoja na wenzako.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Fuatilia uwekezaji wako' },
              { label: 'Endelea na masomo na vyeti' },
              { label: 'Shirikiana na kundi lako' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                <p className="text-sm text-white/60">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-white/20 relative z-10">© 2025 Washika DAU · Jukumu Platform</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <span className="text-base font-black text-white">W</span>
            </div>
            <p className="text-sm font-bold text-white">Washika DAU</p>
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Ingia</h1>
            <p className="text-sm text-white/40">
              Bado huna akaunti?{' '}
              <Link href="/register" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">
                Jisajili hapa
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
              <label htmlFor="identifier" className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                Barua pepe au nambari ya simu
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                required
                value={formData.identifier}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.07] transition-all"
                placeholder="07xx xxx xxx au email@example.com"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                inputMode="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-medium text-white/40 uppercase tracking-wider">
                  Nywila
                </label>
                <a href="#" className="text-xs text-orange-400/70 hover:text-orange-400 transition-colors">
                  Umesahau?
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
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.07] transition-all pr-11"
                  placeholder="Weka nywila yako"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/25 hover:text-white/50 transition-colors"
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
                className="w-4 h-4 accent-orange-500 rounded"
              />
              <label htmlFor="remember-me" className="text-xs text-white/40">Nikumbuke kwenye kifaa hiki</label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-500/20 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Inaingia...
                </span>
              ) : 'Ingia'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
