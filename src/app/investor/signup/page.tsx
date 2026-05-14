'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type InvestorType = 'individual' | 'institutional' | 'ngo' | 'fund';

const INVESTOR_TYPES: { value: InvestorType; label: string; desc: string }[] = [
  { value: 'individual', label: 'Binafsi', desc: 'Mwekezaji mmoja mmoja' },
  { value: 'institutional', label: 'Taasisi', desc: 'Benki, SACCOS, kampuni' },
  { value: 'ngo', label: 'NGO/INGO', desc: 'Shirika lisilo la faida' },
  { value: 'fund', label: 'Mfuko', desc: 'Venture fund, impact fund' },
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
    if (!form.fullName.trim()) { setError('Jina linahitajika'); return; }
    if (!form.email.trim()) { setError('Barua pepe inahitajika'); return; }
    if (form.password.length < 8) { setError('Nenosiri lazima liwe na herufi 8+'); return; }
    if (form.password !== form.confirmPassword) { setError('Manenosiri hayalingani'); return; }
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
      if (!res.ok) { setError(data?.error || 'Hitilafu imetokea'); return; }
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/investor/dashboard');
    } catch {
      setError('Hitilafu ya mtandao');
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
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#D4881E 1px, transparent 1px), linear-gradient(90deg, #D4881E 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#D4881E' }}>
              <span className="text-black font-black text-sm">J</span>
            </div>
            <span style={{ color: '#E8D5B0', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>JUKUMU</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#D4881E' }}>Portal ya Wawekezaji</p>
            <h1 className="font-bold leading-tight" style={{ color: '#E8D5B0', fontSize: '2.2rem' }}>
              Wekeza katika<br />
              <span style={{ color: '#D4881E' }}>Makundi</span> ya<br />
              Mabadiliko
            </h1>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: '#8A7560' }}>
              Ungana na makundi ya VICOBA yaliyothibitishwa. Angalia miradi inayotafuta ufadhili na ufuatilie maendeleo kwa wakati halisi.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: '◆', label: 'Miradi iliyopitishwa na kura ya wanachama' },
              { icon: '◆', label: 'Takwimu za uwazi — salio, mchango, ukuaji' },
              { icon: '◆', label: 'Match-funding kupitia nTZS stablecoin' },
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
            Tayari una akaunti?{' '}
            <Link href="/login" className="underline" style={{ color: '#D4881E' }}>Ingia hapa</Link>
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

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map(s => (
              <React.Fragment key={s}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: step >= s ? '#D4881E' : '#E8E0D4',
                    color: step >= s ? '#fff' : '#8A7560',
                  }}
                >
                  {step > s ? '✓' : s}
                </div>
                {s < 2 && (
                  <div className="flex-1 h-px" style={{ background: step > s ? '#D4881E' : '#E8E0D4' }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Account details */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>Akaunti Mpya</h2>
                <p className="text-sm mt-1" style={{ color: '#8A7560' }}>Jisajili kama mwekezaji wa JUKUMU</p>
              </div>

              <Field label="Jina Kamili *">
                <input
                  type="text" value={form.fullName} onChange={e => set('fullName', e.target.value)}
                  placeholder="Jina lako kamili" required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#fff', border: '1.5px solid #E8E0D4', color: '#1A1200' }}
                  onFocus={e => e.target.style.borderColor = '#D4881E'}
                  onBlur={e => e.target.style.borderColor = '#E8E0D4'}
                />
              </Field>

              <Field label="Barua Pepe *">
                <input
                  type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="investor@example.com" required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#fff', border: '1.5px solid #E8E0D4', color: '#1A1200' }}
                  onFocus={e => e.target.style.borderColor = '#D4881E'}
                  onBlur={e => e.target.style.borderColor = '#E8E0D4'}
                />
              </Field>

              <Field label="Nenosiri *">
                <input
                  type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  placeholder="Herufi 8 au zaidi" required minLength={8}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#fff', border: '1.5px solid #E8E0D4', color: '#1A1200' }}
                  onFocus={e => e.target.style.borderColor = '#D4881E'}
                  onBlur={e => e.target.style.borderColor = '#E8E0D4'}
                />
              </Field>

              <Field label="Thibitisha Nenosiri *">
                <input
                  type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                  placeholder="Rudia nenosiri" required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#fff', border: '1.5px solid #E8E0D4', color: '#1A1200' }}
                  onFocus={e => e.target.style.borderColor = '#D4881E'}
                  onBlur={e => e.target.style.borderColor = '#E8E0D4'}
                />
              </Field>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: '#D4881E', color: '#fff' }}
                onMouseOver={e => (e.currentTarget.style.background = '#B8740F')}
                onMouseOut={e => (e.currentTarget.style.background = '#D4881E')}
              >
                Endelea →
              </button>
            </form>
          )}

          {/* Step 2: Investor profile */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <button type="button" onClick={() => setStep(1)} className="text-xs mb-3 flex items-center gap-1" style={{ color: '#8A7560' }}>
                  ← Rudi
                </button>
                <h2 className="text-xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>Wasifu wa Uwekezaji</h2>
                <p className="text-sm mt-1" style={{ color: '#8A7560' }}>Tuambie zaidi kuhusu maslahi yako</p>
              </div>

              <Field label="Aina ya Mwekezaji *">
                <div className="grid grid-cols-2 gap-2">
                  {INVESTOR_TYPES.map(t => (
                    <button
                      key={t.value} type="button"
                      onClick={() => set('investorType', t.value)}
                      className="px-3 py-3 rounded-xl text-left transition-all"
                      style={{
                        background: form.investorType === t.value ? '#FEF3E2' : '#fff',
                        border: `1.5px solid ${form.investorType === t.value ? '#D4881E' : '#E8E0D4'}`,
                      }}
                    >
                      <p className="text-xs font-semibold" style={{ color: form.investorType === t.value ? '#D4881E' : '#1A1200' }}>{t.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#8A7560' }}>{t.desc}</p>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Kampuni / Shirika (si lazima)">
                <input
                  type="text" value={form.company} onChange={e => set('company', e.target.value)}
                  placeholder="Jina la kampuni au shirika"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#fff', border: '1.5px solid #E8E0D4', color: '#1A1200' }}
                  onFocus={e => e.target.style.borderColor = '#D4881E'}
                  onBlur={e => e.target.style.borderColor = '#E8E0D4'}
                />
              </Field>

              <Field label="Nchi">
                <input
                  type="text" value={form.country} onChange={e => set('country', e.target.value)}
                  placeholder="Tanzania"
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
                {loading ? 'Inasajili...' : 'Unda Akaunti ya Mwekezaji'}
              </button>

              <p className="text-xs text-center" style={{ color: '#8A7560' }}>
                Kwa kusajili, unakubali{' '}
                <Link href="/investor" className="underline" style={{ color: '#D4881E' }}>
                  masharti ya matumizi
                </Link>
              </p>
            </form>
          )}

          <p className="mt-6 text-center text-xs" style={{ color: '#8A7560' }}>
            Tayari una akaunti?{' '}
            <Link href="/login" className="font-semibold underline" style={{ color: '#D4881E' }}>Ingia</Link>
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
