'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';
import Header from '@/components/Header';

type InvestorType = 'individual' | 'institutional' | 'ngo' | 'fund';

const INVESTOR_TYPES: { value: InvestorType; label: string; desc: string }[] = [
  { value: 'individual', label: 'Individual', desc: 'Solo investor' },
  { value: 'institutional', label: 'Institutional', desc: 'Bank, SACCOS, company' },
  { value: 'ngo', label: 'NGO/INGO', desc: 'Non-profit organization' },
  { value: 'fund', label: 'Fund', desc: 'Venture fund, impact fund' },
];

export default function InvestorSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: '',
    investorType: 'individual' as InvestorType,
    country: 'Tanzania',
  });

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.fullName.trim()) { setError('Name is required'); return; }
    if (!form.email.trim()) { setError('Email is required'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/investor-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          company: form.company,
          investorType: form.investorType,
          country: form.country,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error || 'An error occurred'); return; }
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/investor/dashboard');
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
    <div className="min-h-screen bg-background flex pt-[calc(68px_+_env(safe-area-inset-top))]">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <AnimatedBackground />

        <div className="relative z-10 space-y-8 mt-auto">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-primary">Investor Portal</p>
            <h1 className="text-4xl text-foreground leading-tight">
              Invest in<br />
              <span className="text-gold">Communities</span><br />
              Making Change
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Join verified savings groups. View projects seeking funding and track progress in real time.
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
          Already have an account?{' '}
          <Link href="/investor/login" className="text-primary hover:text-primary/80 font-medium">Sign in here</Link>
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map(s => (
              <React.Fragment key={s}>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > s ? '✓' : s}
                </div>
                {s < 2 && (
                  <div className={`flex-1 h-px transition-colors ${step > s ? 'bg-primary' : 'bg-border'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Account details */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground">Create Account</h2>
                <p className="text-sm mt-1 text-muted-foreground">Sign up as a Washika DAU investor</p>
              </div>

              <Field label="Full Name *">
                <input
                  type="text" value={form.fullName} onChange={e => set('fullName', e.target.value)}
                  placeholder="Your full name" required
                  className={fi}
                />
              </Field>

              <Field label="Email Address *">
                <input
                  type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="investor@example.com" required
                  className={fi}
                />
              </Field>

              <Field label="Password *">
                <input
                  type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  placeholder="At least 8 characters" required minLength={8}
                  className={fi}
                />
              </Field>

              <Field label="Confirm Password *">
                <input
                  type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                  placeholder="Repeat password" required
                  className={fi}
                />
              </Field>

              {error && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
              >
                Continue →
              </button>
            </form>
          )}

          {/* Step 2: Investor profile */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <button type="button" onClick={() => setStep(1)} className="text-xs mb-3 flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                  ← Back
                </button>
                <h2 className="text-xl font-bold text-foreground">Investor Profile</h2>
                <p className="text-sm mt-1 text-muted-foreground">Tell us more about your investment interests</p>
              </div>

              <Field label="Investor Type *">
                <div className="grid grid-cols-2 gap-2">
                  {INVESTOR_TYPES.map(opt => (
                    <button
                      key={opt.value} type="button"
                      onClick={() => set('investorType', opt.value)}
                      className={`px-3 py-3 rounded-xl text-left transition-all border ${
                        form.investorType === opt.value
                          ? 'bg-accent border-primary'
                          : 'bg-card border-border hover:border-primary/40'
                      }`}
                    >
                      <p className={`text-xs font-semibold ${form.investorType === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                      <p className="text-[10px] mt-0.5 text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Company / Organization (optional)">
                <input
                  type="text" value={form.company} onChange={e => set('company', e.target.value)}
                  placeholder="Company or organization name"
                  className={fi}
                />
              </Field>

              <Field label="Country">
                <input
                  type="text" value={form.country} onChange={e => set('country', e.target.value)}
                  placeholder="Tanzania"
                  className={fi}
                />
              </Field>

              {error && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

              <button
                type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
              >
                {loading ? 'Creating account...' : 'Create Investor Account'}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                By signing up, you agree to our{' '}
                <Link href="/investor" className="text-primary hover:text-primary/80">
                  terms of use
                </Link>
              </p>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link href="/investor/login" className="font-semibold text-primary hover:text-primary/80">Sign in</Link>
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
