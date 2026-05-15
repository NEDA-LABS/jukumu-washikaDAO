'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

type InvestorProfile = {
  id: number;
  user_id: number;
  full_name: string;
  company?: string | null;
  investor_type: string;
  country: string;
  focus_areas?: string[] | null;
  min_investment_tzs?: number | null;
  max_investment_tzs?: number | null;
  website?: string | null;
  linkedin?: string | null;
  bio?: string | null;
  verified: boolean;
  email?: string;
};

type Project = {
  id: number;
  title: string;
  description?: string | null;
  metadata?: {
    funding_goal_tzs?: number;
    project_description?: string;
    timeline?: string;
    expected_impact?: string;
  } | null;
  funded_at: string;
  group_id: number;
  group_name: string;
  monthly_contribution?: number | null;
  total_investment?: number | null;
  member_count: number;
  yes_votes: number;
  total_votes: number;
};

type Group = {
  id: number;
  name: string;
  founded_date?: string | null;
  total_investment?: number | null;
  monthly_contribution?: number | null;
  status: string;
  leader_name?: string | null;
  member_count: number;
  prodcast_count: number;
  total_funded: number;
};

type GroupDetail = {
  id: number;
  name: string;
  description?: string | null;
  status: string;
  founded_date?: string | null;
  monthly_contribution?: number | null;
  total_investment?: number | null;
  voting_threshold_numerator: number;
  voting_threshold_denominator: number;
  ntzs_user_id?: string | null;
  leader_name?: string | null;
  member_count: number;
  total_proposals: number;
  passed_proposals: number;
  executed_proposals: number;
  open_proposals: number;
  last_activity?: string | null;
  transactions_90d: number;
  volume_90d_tzs: number;
  projects: { id: number; title: string; description?: string | null; metadata?: Record<string, unknown> | null; funded_at?: string | null; status: string }[];
  leadership: { full_name: string; role: string }[];
};

type NetworkStats = {
  totalMembers: number;
  totalGroups: number;
  totalInvestment: number;
  activeRegions: number;
};

type Section = 'overview' | 'projects' | 'groups' | 'wallet' | 'profile';

type WalletState = {
  balanceTzs: number;
  walletAddress: string | null;
  provisioned: boolean;
};

type TxRow = {
  id: number;
  ntzs_id: string;
  type: 'deposit' | 'transfer' | 'withdrawal';
  status: string;
  amount_tzs: number;
  fee_tzs?: number;
  net_tzs?: number;
  phone?: string;
  tx_hash?: string;
  purpose: string;
  note?: string;
  created_at: string;
  from_member_name?: string;
  to_member_name?: string;
  from_group_name?: string;
  to_group_name?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
  n ? `TSH ${Number(n).toLocaleString('en-TZ')}` : '—';

const fmtShort = (n: number | null | undefined) => {
  if (!n) return '—';
  if (n >= 1_000_000) return `TSH ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `TSH ${(n / 1_000).toFixed(0)}K`;
  return `TSH ${n}`;
};

const ago = (s: string) => {
  const diff = Date.now() - new Date(s).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Leo';
  if (d === 1) return 'Jana';
  if (d < 30) return `Siku ${d} zilizopita`;
  const m = Math.floor(d / 30);
  return `Miezi ${m} iliyopita`;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{
        background: accent ? 'linear-gradient(135deg, #D4881E 0%, #B8740F 100%)' : '#fff',
        border: `1px solid ${accent ? 'transparent' : '#EDE8E0'}`,
        boxShadow: accent ? '0 4px 24px rgba(212,136,30,0.25)' : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent ? 'rgba(255,255,255,0.7)' : '#8A7560' }}>{label}</p>
      <p
        className="text-2xl font-bold leading-none"
        style={{
          color: accent ? '#fff' : '#1A1200',
          fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </p>
      {sub && <p className="text-xs" style={{ color: accent ? 'rgba(255,255,255,0.6)' : '#A8997E' }}>{sub}</p>}
    </div>
  );
}

function ProjectCard({ p, onContact }: { p: Project; onContact: (p: Project) => void }) {
  const goal = p.metadata?.funding_goal_tzs ?? 0;
  const funded = Number(p.total_investment ?? 0);
  const pct = goal > 0 ? Math.min(100, Math.round((funded / goal) * 100)) : 0;

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4 transition-all hover:shadow-lg"
      style={{ background: '#fff', border: '1px solid #EDE8E0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: '#FEF3E2', color: '#D4881E' }}
            >
              Prodcast
            </span>
            <span className="text-[10px]" style={{ color: '#A8997E' }}>{ago(p.funded_at)}</span>
          </div>
          <h3 className="text-sm font-bold leading-snug" style={{ color: '#1A1200' }}>{p.title}</h3>
          <p className="text-xs mt-0.5" style={{ color: '#8A7560' }}>{p.group_name}</p>
        </div>
        <div
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black"
          style={{ background: '#0B3D2E', color: '#4ADE80' }}
        >
          {p.member_count}
        </div>
      </div>

      {(p.metadata?.project_description || p.description) && (
        <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#6B5C3E' }}>
          {p.metadata?.project_description || p.description}
        </p>
      )}

      {/* Funding goal + bar */}
      {goal > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px]" style={{ color: '#A8997E' }}>
            <span>Lengo: <span style={{ color: '#1A1200', fontFamily: 'monospace', fontWeight: 700 }}>{fmtShort(goal)}</span></span>
            <span>{pct}% imefundiwa</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EDE8E0' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: pct >= 80 ? '#0B3D2E' : '#D4881E' }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap text-[10px]" style={{ color: '#A8997E' }}>
        {p.metadata?.timeline && (
          <span className="px-2 py-1 rounded-lg" style={{ background: '#F5F0E8' }}>⏱ {p.metadata.timeline}</span>
        )}
        {p.metadata?.expected_impact && (
          <span className="px-2 py-1 rounded-lg line-clamp-1" style={{ background: '#F5F0E8' }}>↑ {p.metadata.expected_impact}</span>
        )}
        {p.monthly_contribution && (
          <span className="px-2 py-1 rounded-lg" style={{ background: '#F5F0E8' }}>
            Mchango: {fmtShort(Number(p.monthly_contribution))}/mwezi
          </span>
        )}
      </div>

      <button
        onClick={() => onContact(p)}
        className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
        style={{ background: '#1A1200', color: '#D4881E' }}
        onMouseOver={e => { e.currentTarget.style.background = '#D4881E'; e.currentTarget.style.color = '#fff'; }}
        onMouseOut={e => { e.currentTarget.style.background = '#1A1200'; e.currentTarget.style.color = '#D4881E'; }}
      >
        Wasiliana Nasi →
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvestorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; email: string; fullName: string; role: string } | null>(null);
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [section, setSection] = useState<Section>('overview');
  const [loading, setLoading] = useState(true);
  const [contactTarget, setContactTarget] = useState<Project | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [groupDetailId, setGroupDetailId] = useState<number | null>(null);
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);
  const [groupDetailLoading, setGroupDetailLoading] = useState(false);

  // Wallet state
  const [wallet, setWallet] = useState<WalletState>({ balanceTzs: 0, walletAddress: null, provisioned: false });
  const [walletLoading, setWalletLoading] = useState(false);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [provisioningWallet, setProvisioningWallet] = useState(false);
  const [walletModal, setWalletModal] = useState<'deposit' | 'withdraw' | null>(null);
  const [depositMethod, setDepositMethod] = useState<'mobile' | 'crypto' | 'bank' | 'card'>('mobile');
  const [copied, setCopied] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletPhone, setWalletPhone] = useState('');
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [walletMsg, setWalletMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Profile edit state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InvestorProfile>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const openGroupDetail = useCallback(async (id: number) => {
    setGroupDetailId(id);
    setGroupDetail(null);
    setGroupDetailLoading(true);
    try {
      const res = await fetch(`/api/investor/groups/${id}`);
      if (res.ok) {
        const d = await res.json();
        setGroupDetail(d.group ? { ...d.group, projects: d.projects ?? [], leadership: d.leadership ?? [] } : null);
      }
    } finally {
      setGroupDetailLoading(false);
    }
  }, []);

  const fetchWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const [balRes, txRes] = await Promise.allSettled([
        fetch('/api/investor/wallet/balance'),
        fetch('/api/investor/wallet/transactions?limit=20'),
      ]);
      if (balRes.status === 'fulfilled' && balRes.value.ok) {
        setWallet(await balRes.value.json());
      }
      if (txRes.status === 'fulfilled' && txRes.value.ok) {
        const d = await txRes.value.json();
        setTransactions(d.transactions ?? []);
      }
    } finally {
      setWalletLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, projectsRes, groupsRes, statsRes] = await Promise.allSettled([
        fetch('/api/investor/profile'),
        fetch('/api/investor/projects'),
        fetch('/api/investor/groups'),
        fetch('/api/investor/stats'),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        const d = await profileRes.value.json();
        setProfile(d.profile);
        setEditForm(d.profile);
      }
      if (projectsRes.status === 'fulfilled' && projectsRes.value.ok) {
        const d = await projectsRes.value.json();
        setProjects(d.projects ?? []);
      }
      if (groupsRes.status === 'fulfilled' && groupsRes.value.ok) {
        const d = await groupsRes.value.json();
        setGroups(d.groups ?? []);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const d = await statsRes.value.json();
        setStats(d);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login?next=/investor/dashboard'); return; }
    try {
      const u = JSON.parse(stored);
      if (u.role !== 'investor') { router.push('/login'); return; }
      setUser(u);
    } catch {
      router.push('/login');
      return;
    }
    loadData();
    fetchWallet();
  }, [router, loadData, fetchWallet]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/investor/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editForm.full_name,
          company: editForm.company,
          investorType: editForm.investor_type,
          country: editForm.country,
          website: editForm.website,
          linkedin: editForm.linkedin,
          bio: editForm.bio,
          minInvestmentTzs: editForm.min_investment_tzs,
          maxInvestmentTzs: editForm.max_investment_tzs,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        setEditForm(data.profile);
        setEditMode(false);
        setSaveMsg('Wasifu umehifadhiwa!');
        setTimeout(() => setSaveMsg(''), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('user');
    router.push('/investor');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAFAF7' }}>
        <div className="text-center space-y-3">
          <div
            className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center animate-pulse"
            style={{ background: '#D4881E' }}
          >
            <span className="text-white font-black">J</span>
          </div>
          <p className="text-sm" style={{ color: '#8A7560' }}>Inapakia...</p>
        </div>
      </div>
    );
  }

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: 'overview', label: 'Habari', icon: '◈' },
    { id: 'projects', label: 'Miradi', icon: '◆' },
    { id: 'groups', label: 'Makundi', icon: '◉' },
    { id: 'wallet', label: 'Pochi', icon: '◇' },
    { id: 'profile', label: 'Wasifu', icon: '◎' },
  ];

  const handleWalletAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletModal) return;
    const amount = Number(walletAmount);
    if (!amount || amount <= 0) { setWalletMsg({ text: 'Ingiza kiasi halali', ok: false }); return; }
    if (!walletPhone.trim()) { setWalletMsg({ text: 'Ingiza nambari ya simu', ok: false }); return; }
    setWalletSubmitting(true);
    setWalletMsg(null);
    try {
      const res = await fetch(`/api/investor/wallet/${walletModal}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTzs: amount, phone: walletPhone }),
      });
      const data = await res.json();
      if (res.ok) {
        setWalletMsg({ text: data.message || 'Ombi limetumwa!', ok: true });
        setWalletAmount(''); setWalletPhone('');
        setTimeout(() => { setWalletModal(null); setWalletMsg(null); fetchWallet(); }, 2000);
      } else {
        setWalletMsg({ text: data.error || 'Hitilafu imetokea', ok: false });
      }
    } catch {
      setWalletMsg({ text: 'Hitilafu ya mtandao', ok: false });
    } finally {
      setWalletSubmitting(false);
    }
  };

  const handleProvisionWallet = async () => {
    setProvisioningWallet(true);
    try {
      const res = await fetch('/api/investor/wallet/provision', { method: 'POST' });
      if (res.ok) { await fetchWallet(); }
    } finally {
      setProvisioningWallet(false);
    }
  };

  const totalFundingSought = projects.reduce((sum, p) => sum + (p.metadata?.funding_goal_tzs ?? 0), 0);

  return (
    <div className="min-h-screen flex" style={{ background: '#FAFAF7', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed top-0 left-0 h-full z-40 flex flex-col w-64 transition-transform duration-300 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ background: 'linear-gradient(180deg, #0E0B07 0%, #1A1200 100%)', borderRight: '1px solid #2A1F0A' }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b" style={{ borderColor: '#2A1F0A' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#D4881E' }}>
              <span className="text-black font-black text-sm">J</span>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#E8D5B0', letterSpacing: '-0.01em' }}>JUKUMU</p>
              <p className="text-[10px]" style={{ color: '#4A3D2A' }}>Investor Portal</p>
            </div>
          </div>

          {/* Investor badge */}
          <div className="px-6 py-4 border-b" style={{ borderColor: '#2A1F0A' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: '#2A1F0A', color: '#D4881E' }}
              >
                {(profile?.full_name || user?.fullName || 'I').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: '#E8D5B0' }}>
                  {profile?.full_name || user?.fullName}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: profile?.verified ? '#0B3D2E' : '#2A1F0A', color: profile?.verified ? '#4ADE80' : '#D4881E' }}
                  >
                    {profile?.verified ? '✓ Verified' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-4 px-3 space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: section === item.id ? '#2A1F0A' : 'transparent',
                  color: section === item.id ? '#D4881E' : '#6B5C3E',
                }}
                onMouseOver={e => { if (section !== item.id) e.currentTarget.style.color = '#E8D5B0'; }}
                onMouseOut={e => { if (section !== item.id) e.currentTarget.style.color = '#6B5C3E'; }}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
                {item.id === 'projects' && projects.length > 0 && (
                  <span
                    className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#D4881E', color: '#fff' }}
                  >
                    {projects.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t space-y-2" style={{ borderColor: '#2A1F0A' }}>
            <button
              onClick={() => router.push('/investor')}
              className="w-full text-left px-4 py-2.5 rounded-xl text-xs transition-colors"
              style={{ color: '#4A3D2A' }}
              onMouseOver={e => e.currentTarget.style.color = '#8A7560'}
              onMouseOut={e => e.currentTarget.style.color = '#4A3D2A'}
            >
              ← Kurasa ya Umma
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 rounded-xl text-xs transition-colors"
              style={{ color: '#4A3D2A' }}
              onMouseOver={e => e.currentTarget.style.color = '#EF4444'}
              onMouseOut={e => e.currentTarget.style.color = '#4A3D2A'}
            >
              ⏻ Ondoka
            </button>
          </div>
        </aside>
      </>

      {/* ── Main content ──────────────────────────────────── */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">

        {/* Top bar */}
        <header
          className="sticky top-0 z-20 flex items-center justify-between px-6 py-4"
          style={{ background: 'rgba(250,250,247,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #EDE8E0' }}
        >
          <div className="flex items-center gap-3">
            <button
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: '#F0EBE0' }}
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1A1200' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-sm font-bold" style={{ color: '#1A1200', letterSpacing: '-0.01em' }}>
                {navItems.find(n => n.id === section)?.label}
              </h1>
              <p className="text-[10px]" style={{ color: '#A8997E' }}>
                {new Date().toLocaleDateString('sw-TZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className="text-xs px-3 py-1.5 rounded-lg" style={{ background: '#ECFDF5', color: '#059669' }}>
                {saveMsg}
              </span>
            )}
            <a
              href="mailto:invest@jukumufund.co.tz"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: '#D4881E', color: '#fff' }}
            >
              Wasiliana
            </a>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 max-w-6xl w-full mx-auto">

          {/* ── OVERVIEW ─────────────────────────────── */}
          {section === 'overview' && (
            <div className="space-y-8">
              {/* Greeting */}
              <div>
                <h2 className="text-2xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>
                  Karibu, {profile?.full_name?.split(' ')[0] || 'Mwekezaji'} 👋
                </h2>
                <p className="text-sm mt-1" style={{ color: '#8A7560' }}>
                  Hapa kuna muhtasari wa fursa za uwekezaji kwenye mtandao wa JUKUMU.
                </p>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Miradi Hai"
                  value={String(projects.length)}
                  sub="Prodcast zilizoidhinishwa"
                  accent
                />
                <StatCard
                  label="Fedha Inayohitajika"
                  value={fmtShort(totalFundingSought)}
                  sub="Jumla ya maombi"
                />
                <StatCard
                  label="Makundi"
                  value={String(stats?.totalGroups ?? groups.length)}
                  sub="Yanayofanya kazi"
                />
                <StatCard
                  label="Wanachama"
                  value={String(stats?.totalMembers ?? '—')}
                  sub={`Mikoa ${stats?.activeRegions ?? '—'}`}
                />
              </div>

              {/* Featured projects */}
              {projects.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold" style={{ color: '#1A1200' }}>Miradi Iliyopigiwa Kura Hivi Karibuni</h3>
                    <button
                      onClick={() => setSection('projects')}
                      className="text-xs font-semibold"
                      style={{ color: '#D4881E' }}
                    >
                      Angalia yote →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.slice(0, 3).map(p => (
                      <ProjectCard key={p.id} p={p} onContact={setContactTarget} />
                    ))}
                  </div>
                </div>
              )}

              {/* Groups snapshot */}
              {groups.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold" style={{ color: '#1A1200' }}>Makundi Yanayofanya Kazi</h3>
                    <button
                      onClick={() => setSection('groups')}
                      className="text-xs font-semibold"
                      style={{ color: '#D4881E' }}
                    >
                      Angalia yote →
                    </button>
                  </div>
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid #EDE8E0', background: '#fff' }}
                  >
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: '1px solid #EDE8E0', background: '#FAFAF7' }}>
                          {['Kundi', 'Wanachama', 'Mchango/Mwezi', 'Miradi'].map(h => (
                            <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider" style={{ color: '#8A7560', fontSize: '10px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {groups.slice(0, 5).map((g, i) => (
                          <tr
                            key={g.id}
                            onClick={() => openGroupDetail(g.id)}
                            className="cursor-pointer hover:bg-amber-50/50 transition-colors"
                            style={{ borderBottom: i < 4 ? '1px solid #F5F0E8' : 'none' }}
                          >
                            <td className="px-4 py-3">
                              <p className="font-semibold" style={{ color: '#1A1200' }}>{g.name}</p>
                              {g.leader_name && <p style={{ color: '#A8997E' }}>{g.leader_name}</p>}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold" style={{ color: '#1A1200' }}>{g.member_count}</td>
                            <td className="px-4 py-3 font-mono" style={{ color: '#1A1200' }}>{fmtShort(Number(g.monthly_contribution))}</td>
                            <td className="px-4 py-3">
                              {Number(g.prodcast_count) > 0 ? (
                                <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: '#FEF3E2', color: '#D4881E' }}>
                                  {g.prodcast_count}
                                </span>
                              ) : <span style={{ color: '#C4B89E' }}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {projects.length === 0 && groups.length === 0 && (
                <div
                  className="rounded-2xl p-16 text-center"
                  style={{ background: '#fff', border: '1px solid #EDE8E0' }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
                    style={{ background: '#FEF3E2' }}
                  >
                    ◆
                  </div>
                  <p className="font-semibold" style={{ color: '#1A1200' }}>Bado hakuna data</p>
                  <p className="text-xs mt-1" style={{ color: '#A8997E' }}>Miradi ya Prodcast itaonekana hapa baada ya kupitishwa na makundi</p>
                </div>
              )}
            </div>
          )}

          {/* ── PROJECTS ─────────────────────────────── */}
          {section === 'projects' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>Miradi ya Uwekezaji</h2>
                <p className="text-sm mt-1" style={{ color: '#8A7560' }}>
                  {projects.length} {projects.length === 1 ? 'mradi' : 'miradi'} iliyoidhinishwa na kura za wanachama
                </p>
              </div>

              {projects.length === 0 ? (
                <div className="rounded-2xl p-16 text-center" style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                  <p className="font-semibold" style={{ color: '#1A1200' }}>Hakuna miradi bado</p>
                  <p className="text-xs mt-1" style={{ color: '#A8997E' }}>Makundi yatawasilisha miradi hapa kupitia mchakato wa kura</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {projects.map(p => (
                    <ProjectCard key={p.id} p={p} onContact={setContactTarget} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── GROUPS ───────────────────────────────── */}
          {section === 'groups' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>Makundi ya VICOBA</h2>
                <p className="text-sm mt-1" style={{ color: '#8A7560' }}>
                  {groups.length} kundi {groups.length === 1 ? 'linafanya' : 'yanafanya'} kazi — yenye uwazi wa kifedha
                </p>
              </div>

              {groups.length === 0 ? (
                <div className="rounded-2xl p-16 text-center" style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                  <p className="font-semibold" style={{ color: '#1A1200' }}>Hakuna makundi bado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map(g => (
                    <div
                      key={g.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openGroupDetail(g.id)}
                      onKeyDown={e => e.key === 'Enter' && openGroupDetail(g.id)}
                      className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all hover:shadow-md cursor-pointer"
                      style={{ background: '#fff', border: '1px solid #EDE8E0' }}
                    >
                      {/* Avatar + name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-black text-sm"
                          style={{ background: '#0B3D2E', color: '#4ADE80' }}
                        >
                          {g.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: '#1A1200' }}>{g.name}</p>
                          <p className="text-xs" style={{ color: '#A8997E' }}>
                            {g.leader_name ? `Kiongozi: ${g.leader_name}` : '—'}
                            {g.founded_date && ` · ${new Date(g.founded_date).getFullYear()}`}
                          </p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex gap-6 shrink-0 flex-wrap">
                        <div className="text-center">
                          <p className="text-[10px] font-semibold uppercase" style={{ color: '#A8997E' }}>Wanachama</p>
                          <p className="text-base font-black font-mono" style={{ color: '#1A1200' }}>{g.member_count}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-semibold uppercase" style={{ color: '#A8997E' }}>Mchango</p>
                          <p className="text-sm font-bold font-mono" style={{ color: '#1A1200' }}>{fmtShort(Number(g.monthly_contribution))}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-semibold uppercase" style={{ color: '#A8997E' }}>Uwekezaji</p>
                          <p className="text-sm font-bold font-mono" style={{ color: '#0B3D2E' }}>{fmtShort(Number(g.total_investment))}</p>
                        </div>
                        {Number(g.prodcast_count) > 0 && (
                          <div className="text-center">
                            <p className="text-[10px] font-semibold uppercase" style={{ color: '#A8997E' }}>Miradi</p>
                            <p
                              className="text-sm font-bold px-2 py-0.5 rounded-full inline-block"
                              style={{ background: '#FEF3E2', color: '#D4881E' }}
                            >
                              {g.prodcast_count}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── WALLET ───────────────────────────────── */}
          {section === 'wallet' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>Pochi ya nTZS</h2>
                <p className="text-sm mt-1" style={{ color: '#8A7560' }}>Amana, toa, au hamisha fedha kupitia mtandao wa Base</p>
              </div>

              {/* Balance hero card */}
              {wallet.provisioned ? (
                <div
                  className="rounded-2xl p-6 relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #0E0B07 0%, #1A1200 60%, #0B3D2E 100%)' }}
                >
                  {/* Grid texture */}
                  <div
                    className="absolute inset-0 opacity-[0.05]"
                    style={{
                      backgroundImage: 'linear-gradient(#D4881E 1px, transparent 1px), linear-gradient(90deg, #D4881E 1px, transparent 1px)',
                      backgroundSize: '28px 28px',
                    }}
                  />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(212,136,30,0.7)' }}>Salio la Pochi</p>
                        <p
                          className="text-4xl font-black leading-none"
                          style={{ color: '#E8D5B0', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '-0.03em' }}
                        >
                          {walletLoading ? '...' : `TSH ${wallet.balanceTzs.toLocaleString('en-TZ')}`}
                        </p>
                      </div>
                      <button
                        onClick={fetchWallet}
                        disabled={walletLoading}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                        style={{ background: 'rgba(212,136,30,0.15)', color: '#D4881E' }}
                        title="Sasisha"
                      >
                        <svg className={`w-4 h-4 ${walletLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>

                    {wallet.walletAddress && (
                      <p className="text-xs font-mono mb-5" style={{ color: 'rgba(232,213,176,0.4)' }}>
                        {wallet.walletAddress.slice(0, 6)}...{wallet.walletAddress.slice(-4)}
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(11,61,46,0.6)', color: '#4ADE80' }}>Base Network</span>
                      </p>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => { setWalletModal('deposit'); setWalletMsg(null); }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={{ background: '#D4881E', color: '#fff' }}
                        onMouseOver={e => e.currentTarget.style.background = '#B8740F'}
                        onMouseOut={e => e.currentTarget.style.background = '#D4881E'}
                      >
                        + Weka Fedha
                      </button>
                      <button
                        onClick={() => { setWalletModal('withdraw'); setWalletMsg(null); }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(255,255,255,0.08)', color: '#E8D5B0', border: '1px solid rgba(255,255,255,0.1)' }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                      >
                        − Toa Fedha
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Not provisioned */
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{ background: '#fff', border: '2px dashed #EDE8E0' }}
                >
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl" style={{ background: '#FEF3E2' }}>◇</div>
                  <p className="font-bold mb-1" style={{ color: '#1A1200' }}>Pochi Haijasanidiwa</p>
                  <p className="text-xs mb-5" style={{ color: '#A8997E' }}>Bonyeza hapa chini kuunda pochi yako ya nTZS kwenye mtandao wa Base</p>
                  <button
                    onClick={handleProvisionWallet}
                    disabled={provisioningWallet}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: '#D4881E', color: '#fff' }}
                  >
                    {provisioningWallet ? 'Inasanidi...' : 'Unda Pochi →'}
                  </button>
                </div>
              )}

              {/* Transaction history */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#8A7560' }}>Shughuli za Hivi Karibuni</p>
                {transactions.length === 0 ? (
                  <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                    <p className="text-sm" style={{ color: '#C4B89E' }}>Hakuna shughuli bado</p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                    {transactions.map((tx, i) => {
                      const isCredit = tx.type === 'deposit';
                      const isDebit = tx.type === 'withdrawal';
                      const statusColor =
                        tx.status === 'completed' || tx.status === 'minted' ? '#059669' :
                        tx.status === 'failed' ? '#DC2626' : '#D97706';
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center gap-4 px-5 py-4"
                          style={{ borderBottom: i < transactions.length - 1 ? '1px solid #F5F0E8' : 'none' }}
                        >
                          <div
                            className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold"
                            style={{
                              background: isCredit ? '#ECFDF5' : isDebit ? '#FEF2F2' : '#FEF3E2',
                              color: isCredit ? '#059669' : isDebit ? '#DC2626' : '#D4881E',
                            }}
                          >
                            {isCredit ? '↓' : isDebit ? '↑' : '↔'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold capitalize" style={{ color: '#1A1200' }}>
                              {tx.type === 'deposit' ? 'Amana' : tx.type === 'withdrawal' ? 'Kutoa' : 'Uhamisho'}
                              {tx.note ? ` — ${tx.note}` : ''}
                            </p>
                            <p className="text-[10px]" style={{ color: '#A8997E' }}>
                              {new Date(tx.created_at).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {tx.from_group_name ? ` · ${tx.from_group_name}` : ''}
                              {tx.to_group_name ? ` → ${tx.to_group_name}` : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className="text-sm font-black font-mono"
                              style={{ color: isCredit ? '#059669' : isDebit ? '#DC2626' : '#1A1200' }}
                            >
                              {isCredit ? '+' : isDebit ? '-' : ''}{`TSH ${Number(tx.net_tzs ?? tx.amount_tzs).toLocaleString('en-TZ')}`}
                            </p>
                            <p className="text-[10px] font-semibold capitalize" style={{ color: statusColor }}>{tx.status}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PROFILE ──────────────────────────────── */}
          {section === 'profile' && (
            <div className="space-y-6 max-w-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>Wasifu Wako</h2>
                  <p className="text-sm mt-1" style={{ color: '#8A7560' }}>Taarifa zako za uwekezaji</p>
                </div>
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: '#1A1200', color: '#D4881E' }}
                  >
                    Hariri
                  </button>
                )}
              </div>

              {/* Verified badge */}
              <div
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{
                  background: profile?.verified ? '#ECFDF5' : '#FEF3E2',
                  border: `1px solid ${profile?.verified ? '#A7F3D0' : '#FCD9A0'}`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: profile?.verified ? '#059669' : '#D4881E', color: '#fff' }}
                >
                  {profile?.verified ? '✓' : '⏳'}
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: profile?.verified ? '#065F46' : '#92400E' }}>
                    {profile?.verified ? 'Akaunti Imethibitishwa' : 'Inasubiri Uthibitisho'}
                  </p>
                  <p className="text-[10px]" style={{ color: profile?.verified ? '#6EE7B7' : '#FCD34D' }}>
                    {profile?.verified
                      ? 'Una ufikiaji kamili wa data ya makundi'
                      : 'Timu yetu itakuwasiliana ndani ya siku 2 za kazi'}
                  </p>
                </div>
              </div>

              {editMode ? (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {[
                    { label: 'Jina Kamili', key: 'full_name', type: 'text' },
                    { label: 'Kampuni', key: 'company', type: 'text' },
                    { label: 'Nchi', key: 'country', type: 'text' },
                    { label: 'Tovuti', key: 'website', type: 'url' },
                    { label: 'LinkedIn', key: 'linkedin', type: 'url' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#4A3D2A' }}>{f.label}</label>
                      <input
                        type={f.type}
                        value={(editForm[f.key as keyof InvestorProfile] as string) || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#fff', border: '1.5px solid #EDE8E0', color: '#1A1200' }}
                        onFocus={e => e.target.style.borderColor = '#D4881E'}
                        onBlur={e => e.target.style.borderColor = '#EDE8E0'}
                      />
                    </div>
                  ))}

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#4A3D2A' }}>Kumbuka / Bio</label>
                    <textarea
                      value={editForm.bio || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                      style={{ background: '#fff', border: '1.5px solid #EDE8E0', color: '#1A1200' }}
                      onFocus={e => e.target.style.borderColor = '#D4881E'}
                      onBlur={e => e.target.style.borderColor = '#EDE8E0'}
                      placeholder="Eleza maslahi yako ya uwekezaji..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#4A3D2A' }}>Kiwango Cha Chini (TSH)</label>
                      <input
                        type="number"
                        value={editForm.min_investment_tzs || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, min_investment_tzs: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#fff', border: '1.5px solid #EDE8E0', color: '#1A1200' }}
                        onFocus={e => e.target.style.borderColor = '#D4881E'}
                        onBlur={e => e.target.style.borderColor = '#EDE8E0'}
                        placeholder="e.g. 500000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#4A3D2A' }}>Kiwango Cha Juu (TSH)</label>
                      <input
                        type="number"
                        value={editForm.max_investment_tzs || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, max_investment_tzs: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{ background: '#fff', border: '1.5px solid #EDE8E0', color: '#1A1200' }}
                        onFocus={e => e.target.style.borderColor = '#D4881E'}
                        onBlur={e => e.target.style.borderColor = '#EDE8E0'}
                        placeholder="e.g. 10000000"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setEditMode(false); setEditForm(profile ?? {}); }}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold"
                      style={{ border: '1.5px solid #EDE8E0', color: '#8A7560', background: 'transparent' }}
                    >
                      Ghairi
                    </button>
                    <button
                      type="submit" disabled={saving}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                      style={{ background: '#D4881E', color: '#fff' }}
                    >
                      {saving ? 'Inahifadhi...' : 'Hifadhi'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #EDE8E0', background: '#fff' }}>
                  {[
                    { label: 'Jina Kamili', value: profile?.full_name },
                    { label: 'Barua Pepe', value: profile?.email },
                    { label: 'Kampuni', value: profile?.company },
                    { label: 'Aina', value: profile?.investor_type },
                    { label: 'Nchi', value: profile?.country },
                    { label: 'Tovuti', value: profile?.website },
                    { label: 'LinkedIn', value: profile?.linkedin },
                    { label: 'Kiwango Cha Chini', value: fmt(profile?.min_investment_tzs) },
                    { label: 'Kiwango Cha Juu', value: fmt(profile?.max_investment_tzs) },
                  ].filter(r => r.value).map((row, i, arr) => (
                    <div
                      key={row.label}
                      className="flex items-start gap-4 px-5 py-4"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid #F5F0E8' : 'none' }}
                    >
                      <p className="text-xs font-semibold w-32 shrink-0 pt-0.5" style={{ color: '#A8997E' }}>{row.label}</p>
                      <p className="text-sm font-medium flex-1" style={{ color: '#1A1200' }}>
                        {(row.label === 'Tovuti' || row.label === 'LinkedIn') && row.value
                          ? <a href={row.value} target="_blank" rel="noopener noreferrer" style={{ color: '#D4881E' }} className="underline">{row.value}</a>
                          : row.value}
                      </p>
                    </div>
                  ))}
                  {profile?.bio && (
                    <div className="px-5 py-4" style={{ borderTop: '1px solid #F5F0E8' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#A8997E' }}>Bio</p>
                      <p className="text-sm" style={{ color: '#1A1200' }}>{profile.bio}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* ── Group Detail Drawer ───────────────────────── */}
      {groupDetailId !== null && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 transition-opacity"
            onClick={() => { setGroupDetailId(null); setGroupDetail(null); }}
          />
          <aside
            className="fixed right-0 top-0 h-full z-50 w-full max-w-lg flex flex-col shadow-2xl overflow-hidden"
            style={{ background: '#FAFAF7', borderLeft: '1px solid #EDE8E0' }}
          >
            {/* Drawer header */}
            <div
              className="flex items-start justify-between px-6 py-5 shrink-0"
              style={{ background: '#0E0B07', borderBottom: '1px solid #2A1F0A' }}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#D4881E' }}>Taarifa ya Kundi</p>
                <h2 className="text-base font-bold truncate" style={{ color: '#E8D5B0' }}>
                  {groupDetailLoading ? 'Inapakia...' : groupDetail?.name ?? '...'}
                </h2>
                {groupDetail?.leader_name && (
                  <p className="text-xs mt-0.5" style={{ color: '#6B5C3E' }}>Kiongozi: {groupDetail.leader_name}</p>
                )}
              </div>
              <button
                onClick={() => { setGroupDetailId(null); setGroupDetail(null); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ml-4"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#6B5C3E' }}
              >✕</button>
            </div>

            {groupDetailLoading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 rounded-xl animate-pulse" style={{ background: '#EDE8E0' }} />
              </div>
            )}

            {!groupDetailLoading && groupDetail && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Quick stats strip */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Wanachama', value: String(groupDetail.member_count) },
                    { label: 'Pool/Mwezi', value: fmtShort(Number(groupDetail.monthly_contribution) * groupDetail.member_count) },
                    { label: 'Zilipita', value: `${groupDetail.passed_proposals}/${groupDetail.total_proposals}` },
                    { label: 'Zilitekelezwa', value: String(groupDetail.executed_proposals) },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#A8997E' }}>{s.label}</p>
                      <p className="text-sm font-black" style={{ color: '#1A1200', fontFamily: 'monospace' }}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Financial Health */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #EDE8E0', background: '#fff' }}>
                  <div className="px-4 py-3" style={{ background: '#F5F0E8', borderBottom: '1px solid #EDE8E0' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8A7560' }}>◆ Afya ya Kifedha</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#F5F0E8' }}>
                    {[
                      { label: 'Mchango wa Mwezi', value: fmtShort(Number(groupDetail.monthly_contribution)) },
                      { label: 'Pool ya Mwezi (wanachama × mchango)', value: fmtShort(Number(groupDetail.monthly_contribution) * groupDetail.member_count) },
                      { label: 'Pochi ya Hazina', value: groupDetail.ntzs_user_id ? '✓ Imesanidiwa (nTZS)' : 'Haijasanidiwa bado' },
                      { label: 'Shughuli (siku 90)', value: `${groupDetail.transactions_90d} tx` },
                      { label: 'Kiasi (siku 90)', value: fmtShort(Number(groupDetail.volume_90d_tzs)) },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between px-4 py-3">
                        <p className="text-xs" style={{ color: '#8A7560' }}>{r.label}</p>
                        <p className="text-xs font-bold font-mono" style={{ color: '#1A1200' }}>{r.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Governance */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #EDE8E0', background: '#fff' }}>
                  <div className="px-4 py-3" style={{ background: '#F5F0E8', borderBottom: '1px solid #EDE8E0' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8A7560' }}>◈ Utawala</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#F5F0E8' }}>
                    {[
                      {
                        label: 'Kizingiti cha Kura',
                        value: `${groupDetail.voting_threshold_numerator}/${groupDetail.voting_threshold_denominator} ya wanachama`,
                      },
                      { label: 'Mapendekezo Yaliyopita', value: `${groupDetail.passed_proposals} kati ya ${groupDetail.total_proposals}` },
                      { label: 'Kiwango cha Utekelezaji', value: groupDetail.passed_proposals > 0 ? `${Math.round((groupDetail.executed_proposals / groupDetail.passed_proposals) * 100)}%` : '—' },
                      { label: 'Mapendekezo Wazi', value: `${groupDetail.open_proposals} yanafanya kazi` },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between px-4 py-3">
                        <p className="text-xs" style={{ color: '#8A7560' }}>{r.label}</p>
                        <p className="text-xs font-bold" style={{ color: '#1A1200' }}>{r.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #EDE8E0', background: '#fff' }}>
                  <div className="px-4 py-3" style={{ background: '#F5F0E8', borderBottom: '1px solid #EDE8E0' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8A7560' }}>◉ Shughuli za Hivi Karibuni</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#F5F0E8' }}>
                    {[
                      { label: 'Shughuli ya Mwisho', value: groupDetail.last_activity ? ago(groupDetail.last_activity) : 'Haijabainishwa' },
                      { label: 'Shughuli za Siku 90', value: `${groupDetail.transactions_90d} shughuli` },
                      { label: 'Kilianzishwa', value: groupDetail.founded_date ? new Date(groupDetail.founded_date).toLocaleDateString('sw-TZ', { year: 'numeric', month: 'long' }) : '—' },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between px-4 py-3">
                        <p className="text-xs" style={{ color: '#8A7560' }}>{r.label}</p>
                        <p className="text-xs font-bold" style={{ color: '#1A1200' }}>{r.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Leadership */}
                {groupDetail.leadership.length > 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #EDE8E0', background: '#fff' }}>
                    <div className="px-4 py-3" style={{ background: '#F5F0E8', borderBottom: '1px solid #EDE8E0' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8A7560' }}>◎ Uongozi</p>
                    </div>
                    <div className="divide-y" style={{ borderColor: '#F5F0E8' }}>
                      {groupDetail.leadership.map(l => (
                        <div key={l.full_name} className="flex items-center justify-between px-4 py-3">
                          <p className="text-xs font-semibold" style={{ color: '#1A1200' }}>{l.full_name}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full capitalize" style={{ background: '#F5F0E8', color: '#8A7560' }}>{l.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prodcast Projects */}
                {groupDetail.projects.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#8A7560' }}>◆ Miradi ya Prodcast</p>
                    <div className="space-y-3">
                      {groupDetail.projects.map(p => {
                        const goal = Number((p.metadata as { funding_goal_tzs?: number })?.funding_goal_tzs ?? 0);
                        return (
                          <div key={p.id} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-bold" style={{ color: '#1A1200' }}>{p.title}</p>
                              <span
                                className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
                                style={{ background: p.funded_at ? '#ECFDF5' : '#FEF3E2', color: p.funded_at ? '#059669' : '#D4881E' }}
                              >
                                {p.funded_at ? 'Imepita' : 'Inasubiri'}
                              </span>
                            </div>
                            {p.description && <p className="text-xs line-clamp-2" style={{ color: '#8A7560' }}>{p.description}</p>}
                            {goal > 0 && (
                              <p className="text-xs font-bold font-mono mt-2" style={{ color: '#D4881E' }}>
                                Lengo: {fmtShort(goal)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <a
                  href={`mailto:invest@jukumufund.co.tz?subject=Interest in Group: ${encodeURIComponent(groupDetail.name)}&body=Habari,%0A%0ANinapenda kujua zaidi kuhusu kundi la "${groupDetail.name}".%0A%0AJina langu: ${encodeURIComponent(profile?.full_name ?? '')}%0AKampuni: ${encodeURIComponent(profile?.company ?? 'N/A')}%0A%0AAsante.`}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
                  style={{ background: '#1A1200', color: '#D4881E' }}
                  onMouseOver={e => { e.currentTarget.style.background = '#D4881E'; e.currentTarget.style.color = '#fff'; }}
                  onMouseOut={e => { e.currentTarget.style.background = '#1A1200'; e.currentTarget.style.color = '#D4881E'; }}
                >
                  Wasiliana Kuhusu Kundi Hili →
                </a>
              </div>
            )}
          </aside>
        </>
      )}

      {/* ── Contact Modal ─────────────────────────────── */}
      {contactTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: '#FAFAF7', border: '1px solid #EDE8E0' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#D4881E' }}>Maombi ya Kuwasiliana</p>
                <h3 className="text-base font-bold mt-1" style={{ color: '#1A1200' }}>{contactTarget.title}</h3>
                <p className="text-xs" style={{ color: '#8A7560' }}>{contactTarget.group_name}</p>
              </div>
              <button onClick={() => setContactTarget(null)} className="p-1" style={{ color: '#A8997E' }}>✕</button>
            </div>

            {contactTarget.metadata?.funding_goal_tzs && (
              <div className="rounded-xl p-3" style={{ background: '#FEF3E2', border: '1px solid #FCD9A0' }}>
                <p className="text-xs" style={{ color: '#92400E' }}>
                  Lengo la fedha: <span className="font-black font-mono">{fmt(contactTarget.metadata.funding_goal_tzs)}</span>
                </p>
              </div>
            )}

            <p className="text-sm" style={{ color: '#6B5C3E' }}>
              Timu yetu itakusaidia kuungana na{' '}
              <span className="font-semibold" style={{ color: '#1A1200' }}>{contactTarget.group_name}</span>{' '}
              kupitia mchakato wetu wa due diligence na uandikisho.
            </p>

            <a
              href={`mailto:invest@jukumufund.co.tz?subject=Interest in: ${encodeURIComponent(contactTarget.title)} (${encodeURIComponent(contactTarget.group_name)})&body=Habari,%0A%0ANinapenda kujua zaidi kuhusu mradi wa "${contactTarget.title}" kutoka kundi la ${contactTarget.group_name}.%0A%0AJina langu: ${encodeURIComponent(profile?.full_name || '')}%0AKampuni: ${encodeURIComponent(profile?.company || 'N/A')}%0A%0AAsante.`}
              className="w-full py-3 rounded-xl text-sm font-semibold text-center block transition-all"
              style={{ background: '#D4881E', color: '#fff' }}
            >
              Tuma Barua Pepe →
            </a>

            <button
              onClick={() => setContactTarget(null)}
              className="w-full py-2.5 rounded-xl text-sm"
              style={{ color: '#8A7560', border: '1px solid #EDE8E0' }}
            >
              Funga
            </button>
          </div>
        </div>
      )}

      {/* ── Wallet Deposit / Withdraw Modal ──────────── */}
      {walletModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: '#FAFAF7', border: '1px solid #EDE8E0' }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-5"
              style={{ background: '#0E0B07', borderBottom: '1px solid #2A1F0A' }}
            >
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#D4881E' }}>
                  {walletModal === 'deposit' ? 'Weka Fedha' : 'Toa Fedha'}
                </p>
                <p className="text-sm font-bold mt-0.5" style={{ color: '#E8D5B0' }}>
                  {walletModal === 'withdraw' ? 'Toa hadi nambari ya simu' : 'Chagua njia ya amana'}
                </p>
              </div>
              <button
                onClick={() => { setWalletModal(null); setWalletMsg(null); setWalletAmount(''); setWalletPhone(''); setDepositMethod('mobile'); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#6B5C3E' }}
              >✕</button>
            </div>

            {/* Deposit method tabs — only shown for deposit */}
            {walletModal === 'deposit' && (
              <div className="grid grid-cols-4 gap-0" style={{ borderBottom: '1px solid #EDE8E0', background: '#fff' }}>
                {([
                  { key: 'mobile', icon: '📱', label: 'M-Pesa', live: true },
                  { key: 'crypto', icon: '◆', label: 'USDC/USDT', live: true },
                  { key: 'bank',   icon: '🏦', label: 'Benki', live: false },
                  { key: 'card',   icon: '💳', label: 'Kadi', live: false },
                ] as { key: 'mobile'|'crypto'|'bank'|'card'; icon: string; label: string; live: boolean }[]).map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => { if (m.live) { setDepositMethod(m.key); setWalletMsg(null); } }}
                    className="flex flex-col items-center gap-1 py-3 text-center transition-all relative"
                    style={{
                      borderBottom: depositMethod === m.key ? '2px solid #D4881E' : '2px solid transparent',
                      color: depositMethod === m.key ? '#D4881E' : m.live ? '#8A7560' : '#C4B89E',
                      cursor: m.live ? 'pointer' : 'default',
                    }}
                  >
                    <span className="text-base">{m.icon}</span>
                    <span className="text-[9px] font-semibold">{m.label}</span>
                    {!m.live && (
                      <span
                        className="absolute top-1.5 right-1 text-[7px] font-bold px-1 rounded"
                        style={{ background: '#F5F0E8', color: '#A8997E' }}
                      >SOON</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="p-6 space-y-4">
              {/* Balance pill */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#F5F0E8' }}>
                <span className="text-xs" style={{ color: '#8A7560' }}>Salio la sasa</span>
                <span className="text-sm font-black font-mono" style={{ color: '#1A1200' }}>
                  TSH {wallet.balanceTzs.toLocaleString('en-TZ')}
                </span>
              </div>

              {/* ── CRYPTO DEPOSIT ── */}
              {walletModal === 'deposit' && depositMethod === 'crypto' && (
                <div className="space-y-4">
                  <div
                    className="rounded-xl p-4 space-y-3"
                    style={{ background: '#0E0B07', border: '1px solid #2A1F0A' }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#D4881E' }}>Anwani ya Base Network</p>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: '#0B3D2E', color: '#4ADE80' }}>Base</span>
                    </div>
                    {wallet.walletAddress ? (
                      <>
                        <p
                          className="text-xs font-mono break-all leading-relaxed"
                          style={{ color: '#E8D5B0' }}
                        >
                          {wallet.walletAddress}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(wallet.walletAddress!);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="w-full py-2 rounded-lg text-xs font-semibold transition-all"
                          style={{ background: copied ? '#0B3D2E' : 'rgba(212,136,30,0.15)', color: copied ? '#4ADE80' : '#D4881E' }}
                        >
                          {copied ? '✓ Imenakiliwa!' : 'Nakili Anwani'}
                        </button>
                      </>
                    ) : (
                      <p className="text-xs" style={{ color: '#6B5C3E' }}>Pochi haijasanidiwa bado. Kwanza sanidi pochi yako.</p>
                    )}
                  </div>
                  <div className="rounded-xl p-4 space-y-2" style={{ background: '#FEF3E2', border: '1px solid #FCD9A0' }}>
                    <p className="text-xs font-bold" style={{ color: '#92400E' }}>Jinsi ya kuweka USDC / USDT:</p>
                    {['Tuma USDC au USDT kwenye anwani iliyo juu', 'Tumia mtandao wa Base (Layer 2)', 'nTZS itabadilishwa moja kwa moja kwenye pochi yako'].map((s, i) => (
                      <p key={i} className="text-xs flex gap-2" style={{ color: '#92400E' }}>
                        <span className="font-bold shrink-0">{i + 1}.</span>{s}
                      </p>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setWalletModal(null); setDepositMethod('mobile'); }}
                    className="w-full py-2.5 rounded-xl text-sm"
                    style={{ border: '1.5px solid #EDE8E0', color: '#8A7560' }}
                  >Funga</button>
                </div>
              )}

              {/* ── COMING SOON (bank / card) ── */}
              {walletModal === 'deposit' && (depositMethod === 'bank' || depositMethod === 'card') && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl" style={{ background: '#F5F0E8' }}>
                    {depositMethod === 'bank' ? '🏦' : '💳'}
                  </div>
                  <p className="font-bold text-sm" style={{ color: '#1A1200' }}>
                    {depositMethod === 'bank' ? 'Amana ya Benki' : 'Amana ya Kadi'}
                  </p>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold" style={{ background: '#F5F0E8', color: '#8A7560' }}>
                    Inakuja Hivi Karibuni
                  </span>
                  <p className="text-xs" style={{ color: '#A8997E' }}>
                    {depositMethod === 'bank'
                      ? 'Uhamisho wa benki utapatikana baada ya muda mfupi'
                      : 'Malipo ya kadi ya mkopo/mdeni yanakuja hivi karibuni'}
                  </p>
                </div>
              )}

              {/* ── MOBILE MONEY form (deposit mobile or any withdraw) ── */}
              {(walletModal === 'withdraw' || (walletModal === 'deposit' && depositMethod === 'mobile')) && (
                <form onSubmit={handleWalletAction} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4A3D2A' }}>Kiasi (TSH) *</label>
                    <input
                      type="number" min="1000" step="100"
                      value={walletAmount}
                      onChange={e => setWalletAmount(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#fff', border: '1.5px solid #EDE8E0', color: '#1A1200', fontFamily: 'monospace' }}
                      onFocus={e => e.target.style.borderColor = '#D4881E'}
                      onBlur={e => e.target.style.borderColor = '#EDE8E0'}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4A3D2A' }}>Nambari ya Simu *</label>
                    <input
                      type="tel"
                      value={walletPhone}
                      onChange={e => setWalletPhone(e.target.value)}
                      placeholder="e.g. 0712345678"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#fff', border: '1.5px solid #EDE8E0', color: '#1A1200' }}
                      onFocus={e => e.target.style.borderColor = '#D4881E'}
                      onBlur={e => e.target.style.borderColor = '#EDE8E0'}
                      required
                    />
                  </div>

                  {walletMsg && (
                    <div
                      className="px-4 py-3 rounded-xl text-xs font-medium"
                      style={{
                        background: walletMsg.ok ? '#ECFDF5' : '#FEF2F2',
                        color: walletMsg.ok ? '#059669' : '#DC2626',
                        border: `1px solid ${walletMsg.ok ? '#A7F3D0' : '#FECACA'}`,
                      }}
                    >
                      {walletMsg.text}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => { setWalletModal(null); setWalletMsg(null); setWalletAmount(''); setWalletPhone(''); setDepositMethod('mobile'); }}
                      className="flex-1 py-3 rounded-xl text-sm"
                      style={{ border: '1.5px solid #EDE8E0', color: '#8A7560' }}
                    >Ghairi</button>
                    <button
                      type="submit" disabled={walletSubmitting}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                      style={{ background: walletModal === 'deposit' ? '#D4881E' : '#0B3D2E', color: '#fff' }}
                    >
                      {walletSubmitting ? 'Inatuma...' : walletModal === 'deposit' ? 'Weka Fedha' : 'Toa Fedha'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
