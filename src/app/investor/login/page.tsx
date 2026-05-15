'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function InvestorLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim()) { setError('Email is required'); return; }
    if (!form.password) { setError('Password is required'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error || 'Invalid email or password'); return; }
      if (data?.user?.role !== 'investor') {
        setError('This portal is for investors only. Please use the main login.');
        return;
      }
      localStorage.setItem('user', JSON.stringify(data.user));
      const params = new URLSearchParams(window.location.search);
      router.push(params.get('next') || '/investor/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0E0B07 0%, #1A1200 50%, #0B3D2E 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#D4881E 1px, transparent 1px), linear-gradient(90deg, #D4881E 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10">
          <Link href="/investor" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#D4881E' }}>
              <span className="text-black font-black text-sm">J</span>
            </div>
            <span style={{ color: '#E8D5B0', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>JUKUMU</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#D4881E' }}>Investor Portal</p>
            <h1 className="font-bold leading-tight" style={{ color: '#E8D5B0', fontSize: '2.2rem' }}>
              Welcome<br />
              <span style={{ color: '#D4881E' }}>Back</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: '#8A7560' }}>
              Sign in to access your investor dashboard, view projects, and manage your nTZS wallet.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: '◆', label: 'Projects approved by member vote' },
              { icon: '◆', label: 'Transparent data — balance, contributions, growth' },
              { icon: '◆', label: 'Match-funding via nTZS stablecoin' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs" style={{ color: '#D4881E' }}>{item.icon}</span>
                <span className="text-sm" style={{ color: '#8A7560' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs" style={{ color: '#4A3D2A' }}>
            Don&apos;t have an account?{' '}
            <Link href="/investor/signup" className="underline" style={{ color: '#D4881E' }}>Sign up here</Link>
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#FAFAF7' }}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#D4881E' }}>
              <span className="text-black font-black text-sm">J</span>
            </div>
            <span className="font-bold" style={{ color: '#1A1200' }}>JUKUMU Investor</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h2 className="text-xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>Sign In</h2>
              <p className="text-sm mt-1" style={{ color: '#8A7560' }}>Access your JUKUMU investor account</p>
            </div>

            <Field label="Email Address *">
              <input
                type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="investor@example.com" required autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{ background: '#fff', border: '1.5px solid #E8E0D4', color: '#1A1200' }}
                onFocus={e => e.target.style.borderColor = '#D4881E'}
                onBlur={e => e.target.style.borderColor = '#E8E0D4'}
              />
            </Field>

            <Field label="Password *">
              <input
                type="password" value={form.password} onChange={e => set('password', e.target.value)}
                placeholder="Your password" required autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{ background: '#fff', border: '1.5px solid #E8E0D4', color: '#1A1200' }}
                onFocus={e => e.target.style.borderColor = '#D4881E'}
                onBlur={e => e.target.style.borderColor = '#E8E0D4'}
              />
            </Field>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
              style={{ background: '#D4881E', color: '#fff' }}
              onMouseOver={e => !loading && (e.currentTarget.style.background = '#B8740F')}
              onMouseOut={e => (e.currentTarget.style.background = '#D4881E')}
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs" style={{ color: '#8A7560' }}>
            Don&apos;t have an account?{' '}
            <Link href="/investor/signup" className="font-semibold underline" style={{ color: '#D4881E' }}>Sign up</Link>
          </p>

          <p className="mt-3 text-center text-xs" style={{ color: '#C4B89E' }}>
            VICOBA member?{' '}
            <Link href="/login" className="underline" style={{ color: '#C4B89E' }}>Use the member login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4A3D2A' }}>{label}</label>
      {children}
    </div>
  );
}
