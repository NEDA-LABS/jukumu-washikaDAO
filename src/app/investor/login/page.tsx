'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import Header from '@/components/Header';

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

  const fi = 'w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

  return (
    <>
    <Header />
    <div className="min-h-screen bg-background flex pt-[68px]">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <AnimatedBackground />

        <div className="relative z-10 space-y-8 mt-auto">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-primary">Investor Portal</p>
            <h1 className="text-4xl text-foreground leading-tight">
              Welcome<br /><span className="text-gold">Back</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Sign in to access your investor dashboard, view projects, and manage your nTZS wallet.
            </p>
          </div>

          <div className="space-y-3">
            {[
              'Projects approved by member vote',
              'Transparent data — balance, contributions, growth',
              'Match-funding via nTZS stablecoin',
            ].map((label, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted border border-border">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-muted-foreground mt-auto">
          Don&apos;t have an account?{' '}
          <Link href="/investor/signup" className="text-primary hover:text-primary/80 font-medium">Sign up here</Link>
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Sign In</h2>
              <p className="text-sm mt-1 text-muted-foreground">Access your Washika DAU investor account</p>
            </div>

            <Field label="Email Address *">
              <input
                type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="investor@example.com" required autoComplete="email"
                className={fi}
              />
            </Field>

            <Field label="Password *">
              <input
                type="password" value={form.password} onChange={e => set('password', e.target.value)}
                placeholder="Your password" required autoComplete="current-password"
                className={fi}
              />
            </Field>

            {error && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/investor/signup" className="font-semibold text-primary hover:text-primary/80">Sign up</Link>
          </p>

          <p className="mt-3 text-center text-xs text-muted-foreground/70">
            VICOBA member?{' '}
            <Link href="/login" className="underline hover:text-foreground">Use the member login</Link>
          </p>
        </div>
      </div>
    </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
