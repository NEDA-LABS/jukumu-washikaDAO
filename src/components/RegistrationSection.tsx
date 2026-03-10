'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import AnimatedBackground from '@/components/AnimatedBackground';

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
      setError('Nywila hazifanani');
      setIsSubmitting(false);
      return;
    }

    try {
      // Save member data to database first
      console.log('Saving member data to database...');
      const memberResponse = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email.trim() ? formData.email.trim() : null,
          phone: formData.phone,
          location: formData.location,
          businessType: formData.businessType,
          idType: formData.idType,
          idNumber: formData.idNumber,
          gender: formData.gender,
          age: formData.age,
          status: 'pending'
        }),
      });

      if (!memberResponse.ok) {
        const errorData = await memberResponse.json();
        const details =
          typeof errorData?.details === 'string' && errorData.details
            ? ` (${errorData.details})`
            : '';
        throw new Error((errorData.error || 'Failed to save member data') + details);
      }

      const memberData = await memberResponse.json();

      console.log('Member data saved successfully');

      // Create user account with custom auth
      console.log('Creating user account...');
      const authResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim() ? formData.email.trim() : null,
          phone: formData.phone,
          memberId: memberData?.id,
          password: formData.password,
          fullName: formData.fullName,
        }),
      });

      if (authResponse.ok) {
        const authData = await authResponse.json();
        localStorage.setItem('user', JSON.stringify(authData.user));
      
        // Role-based redirect
        if (authData.user.role === 'admin') {
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/member-dashboard';
        }
      } else {
        const authError = await authResponse.json();
        console.error('Auth signup failed:', authError);
        setError('Usajili umekamilika lakini kuna tatizo la kuingia. Jaribu kuingia kwa kutumia barua pepe na nywila uliyoweka.');
        setIsSubmitted(true);
      }
    } catch (error: unknown) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'Hitilafu imetokea. Jaribu tena.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fi = 'w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.07] transition-all';
  const lbl = 'block text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-1.5';
  const sel = `${fi} text-white/70`;

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Umefanikiwa!</h2>
          <p className="text-sm text-white/40 mb-8">
            Akaunti yako imeundwa. Unaweza sasa kuingia kwenye jukwaa.
          </p>
          <Link href="/login" className="block w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors text-center shadow-lg shadow-orange-500/20">
            Ingia Sasa
          </Link>
          <button
            onClick={() => {
              setIsSubmitted(false);
              setFormData({ fullName: '', email: '', phone: '', password: '', confirmPassword: '', location: '', businessType: '', idType: '', idNumber: '', gender: '', age: '' });
            }}
            className="mt-3 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            Sajili mtu mwingine
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[38%] xl:w-[35%] flex-col justify-between p-12 border-r border-white/[0.05] relative overflow-hidden shrink-0">
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

        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight mb-3">
              Jiunge na jamii<br />ya wajasiriamali
            </h2>
            <p className="text-sm text-white/40 leading-relaxed">
              Sajili leo na uanze safari yako ya biashara, mafunzo, na uwekezaji pamoja na wenzako.
            </p>
          </div>
          <div className="space-y-2.5">
            {[
              'Mafunzo ya biashara na vyeti',
              'Vikundi vya akiba na uwekezaji',
              'Malipo ya M-Pesa yaliyosalimishwa',
              'Fuatilia ukuaji wa biashara yako',
            ].map((label, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                <p className="text-xs text-white/55">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-white/20 relative z-10">© 2025 Washika DAU · Jukumu Platform</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center px-6 py-12">
          <div className="w-full max-w-2xl">
            {/* Mobile logo */}
            <Link href="/" className="flex items-center gap-3 mb-8 lg:hidden">
              <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <span className="text-base font-black text-white">W</span>
              </div>
              <p className="text-sm font-bold text-white">Washika DAU</p>
            </Link>

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white mb-1">Unda Akaunti</h1>
              <p className="text-sm text-white/40">
                Una akaunti tayari?{' '}
                <Link href="/login" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">
                  Ingia hapa
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
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-4">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Taarifa za Kibinafsi</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className={lbl}>Jina Kamili *</label>
                    <input type="text" id="fullName" name="fullName" required value={formData.fullName} onChange={handleChange} className={fi} placeholder="Jina lako kamili" />
                  </div>
                  <div>
                    <label htmlFor="phone" className={lbl}>Nambari ya Simu *</label>
                    <input type="tel" id="phone" name="phone" required value={formData.phone} onChange={handleChange} className={fi} placeholder="+255 7xx xxx xxx" />
                  </div>
                  <div>
                    <label htmlFor="email" className={lbl}>Barua Pepe <span className="normal-case text-white/20">(si lazima)</span></label>
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className={fi} placeholder="email@example.com" />
                  </div>
                  <div>
                    <label htmlFor="location" className={lbl}>Mji / Mkoa *</label>
                    <input type="text" id="location" name="location" required value={formData.location} onChange={handleChange} className={fi} placeholder="Dar es Salaam" />
                  </div>
                  <div>
                    <label htmlFor="gender" className={lbl}>Jinsia *</label>
                    <select id="gender" name="gender" required value={formData.gender} onChange={handleChange} className={sel}>
                      <option value="">Chagua jinsia</option>
                      <option value="mwanamke">Mwanamke</option>
                      <option value="mwanamume">Mwanamume</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="age" className={lbl}>Umri *</label>
                    <input type="number" id="age" name="age" required min="18" max="100" value={formData.age} onChange={handleChange} className={fi} placeholder="Umri wako" />
                  </div>
                </div>
              </div>

              {/* Section: Business & ID */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-4">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Biashara na Kitambulisho</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="businessType" className={lbl}>Aina ya Biashara *</label>
                    <select id="businessType" name="businessType" required value={formData.businessType} onChange={handleChange} className={sel}>
                      <option value="">Chagua aina</option>
                      <option value="kilimo">Kilimo</option>
                      <option value="ufugaji">Ufugaji</option>
                      <option value="biashara_ndogo">Biashara Ndogo</option>
                      <option value="sanaa">Sanaa na Ubunifu</option>
                      <option value="huduma">Huduma</option>
                      <option value="teknolojia">Teknolojia</option>
                      <option value="nyingine">Nyingine</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="idType" className={lbl}>Aina ya Kitambulisho *</label>
                    <select id="idType" name="idType" required value={formData.idType} onChange={handleChange} className={sel}>
                      <option value="">Chagua aina</option>
                      <option value="national_id">Kitambulisho cha Taifa</option>
                      <option value="voter_id">Kitambulisho cha Mpiga Kura</option>
                      <option value="passport">Paspoti</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="idNumber" className={lbl}>Nambari ya Kitambulisho *</label>
                    <input type="text" id="idNumber" name="idNumber" required value={formData.idNumber} onChange={handleChange} className={fi} placeholder="Ingiza nambari ya kitambulisho" />
                  </div>
                </div>
              </div>

              {/* Section: Password */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-4">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Unda Nywila</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className={lbl}>Nywila *</label>
                    <input type="password" id="password" name="password" required value={formData.password} onChange={handleChange} className={fi} placeholder="Nywila yenye nguvu" />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className={lbl}>Thibitisha Nywila *</label>
                    <input type="password" id="confirmPassword" name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange} className={fi} placeholder="Rudia nywila" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-lg shadow-orange-500/20"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Inasajili...
                  </span>
                ) : 'Unda Akaunti →'}
              </button>

              <p className="text-center text-xs text-white/20">
                Kwa kusajili, unakubali masharti na sera ya faragha ya Washika DAU.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
