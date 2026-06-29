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
  created_at: string;
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
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  return `${m} month${m > 1 ? 's' : ''} ago`;
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

function ProjectCard({ p, onContact, onFund }: { p: Project; onContact: (p: Project) => void; onFund: (p: Project) => void }) {
  const goal = p.metadata?.funding_goal_tzs ?? 0;
  const funded = Number(p.total_investment ?? 0);
  const pct = goal > 0 ? Math.min(100, Math.round((funded / goal) * 100)) : 0;
  const isApproved = !!p.funded_at;

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4 transition-all hover:shadow-lg"
      style={{
        background: '#fff',
        border: `1px solid ${isApproved ? '#EDE8E0' : '#E0EBF5'}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isApproved ? (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: '#FEF3E2', color: '#D4881E' }}
              >
                Community Approved
              </span>
            ) : (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: '#EFF6FF', color: '#3B82F6' }}
              >
                Seeking Vote
              </span>
            )}
            <span className="text-[10px]" style={{ color: '#A8997E' }}>
              {isApproved ? ago(p.funded_at) : ago(p.created_at)}
            </span>
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

      {/* Vote progress (only for open proposals) */}
      {!isApproved && (p.yes_votes > 0 || p.total_votes > 0) && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px]" style={{ color: '#A8997E' }}>
            <span>Community vote</span>
            <span>{p.yes_votes} yes / {p.total_votes} cast</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EDE8E0' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: p.total_votes > 0 ? `${Math.round((p.yes_votes / p.total_votes) * 100)}%` : '0%',
                background: '#3B82F6',
              }}
            />
          </div>
        </div>
      )}

      {/* Funding goal + bar (approved proposals) */}
      {isApproved && goal > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px]" style={{ color: '#A8997E' }}>
            <span>Goal: <span style={{ color: '#1A1200', fontFamily: 'monospace', fontWeight: 700 }}>{fmtShort(goal)}</span></span>
            <span>{pct}% funded</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EDE8E0' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: pct >= 80 ? '#0B3D2E' : '#D4881E' }}
            />
          </div>
        </div>
      )}

      {/* Funding goal amount (open proposals, no bar) */}
      {!isApproved && goal > 0 && (
        <div className="px-3 py-2 rounded-xl text-[10px]" style={{ background: '#F0F7FF', border: '1px solid #DBEAFE' }}>
          <span style={{ color: '#64748B' }}>Funding goal: </span>
          <span style={{ color: '#1A1200', fontFamily: 'monospace', fontWeight: 700 }}>{fmtShort(goal)}</span>
        </div>
      )}

      <div className="flex gap-2 flex-wrap text-[10px]" style={{ color: '#A8997E' }}>
        {p.metadata?.timeline && (
          <span className="px-2 py-1 rounded-lg" style={{ background: '#F5F0E8' }}>◷ {p.metadata.timeline}</span>
        )}
        {p.metadata?.expected_impact && (
          <span className="px-2 py-1 rounded-lg line-clamp-1" style={{ background: '#F5F0E8' }}>↑ {p.metadata.expected_impact}</span>
        )}
        {p.monthly_contribution && (
          <span className="px-2 py-1 rounded-lg" style={{ background: '#F5F0E8' }}>
            Contribution: {fmtShort(Number(p.monthly_contribution))}/mo
          </span>
        )}
      </div>

      {isApproved ? (
        <div className="flex gap-2">
          <button
            onClick={() => onFund(p)}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: '#D4881E', color: '#fff' }}
            onMouseOver={e => { e.currentTarget.style.background = '#B8740F'; }}
            onMouseOut={e => { e.currentTarget.style.background = '#D4881E'; }}
          >
            Fund →
          </button>
          <button
            onClick={() => onContact(p)}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold transition-all"
            style={{ background: '#F5F0E8', color: '#6B5C3E' }}
            onMouseOver={e => { e.currentTarget.style.background = '#EDE8E0'; }}
            onMouseOut={e => { e.currentTarget.style.background = '#F5F0E8'; }}
          >
            Contact
          </button>
        </div>
      ) : (
        <div
          className="w-full py-2.5 rounded-xl text-xs font-semibold text-center"
          style={{ background: '#F0F7FF', color: '#3B82F6', border: '1px solid #DBEAFE' }}
        >
          Awaiting community approval
        </div>
      )}
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
  const [depositMethod, setDepositMethod] = useState<'mobile' | 'bank' | 'card'>('mobile');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletPhone, setWalletPhone] = useState('');
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [walletMsg, setWalletMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Fund project state
  const [fundTarget, setFundTarget] = useState<Project | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [fundSubmitting, setFundSubmitting] = useState(false);
  const [fundMsg, setFundMsg] = useState<{ text: string; ok: boolean } | null>(null);

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
    if (!stored) { router.push('/investor/login?next=/investor/dashboard'); return; }
    try {
      const u = JSON.parse(stored);
      if (u.role !== 'investor') { router.push('/investor/login'); return; }
      setUser(u);
    } catch {
      router.push('/investor/login');
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
        setSaveMsg('Profile saved!');
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
          <p className="text-sm" style={{ color: '#8A7560' }}>Loading...</p>
        </div>
      </div>
    );
  }

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '◈' },
    { id: 'projects', label: 'Projects', icon: '◆' },
    { id: 'groups', label: 'Groups', icon: '◉' },
    { id: 'wallet', label: 'Wallet', icon: '◇' },
    { id: 'profile', label: 'Profile', icon: '◎' },
  ];

  const handleWalletAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletModal) return;
    const amount = Number(walletAmount);
    if (!amount || amount <= 0) { setWalletMsg({ text: 'Enter a valid amount', ok: false }); return; }
    if (!walletPhone.trim()) { setWalletMsg({ text: 'Enter a phone number', ok: false }); return; }
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
        setWalletMsg({ text: data.message || 'Request sent!', ok: true });
        setWalletAmount(''); setWalletPhone('');
        setTimeout(() => { setWalletModal(null); setWalletMsg(null); fetchWallet(); }, 2000);
      } else {
        setWalletMsg({ text: data.error || 'An error occurred', ok: false });
      }
    } catch {
      setWalletMsg({ text: 'Network error. Please try again.', ok: false });
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

  const handleFundProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundTarget) return;
    const amount = Number(fundAmount);
    if (!amount || amount < 1000) { setFundMsg({ text: 'Minimum amount is TSH 1,000', ok: false }); return; }
    setFundSubmitting(true);
    setFundMsg(null);
    try {
      const res = await fetch('/api/investor/wallet/fund-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: fundTarget.id, amountTzs: amount }),
      });
      const data = await res.json();
      if (res.ok) {
        setFundMsg({ text: data.message || 'Transfer sent!', ok: true });
        setFundAmount('');
        setTimeout(() => { setFundTarget(null); setFundMsg(null); fetchWallet(); }, 2500);
      } else {
        setFundMsg({ text: data.error || 'Transfer failed', ok: false });
      }
    } catch {
      setFundMsg({ text: 'Network error. Please try again.', ok: false });
    } finally {
      setFundSubmitting(false);
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
              ← Public Page
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 rounded-xl text-xs transition-colors"
              style={{ color: '#4A3D2A' }}
              onMouseOver={e => e.currentTarget.style.color = '#EF4444'}
              onMouseOut={e => e.currentTarget.style.color = '#4A3D2A'}
            >
              ⏻ Sign Out
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
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
              Contact
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
                  Welcome, {profile?.full_name?.split(' ')[0] || 'Investor'}
                </h2>
                <p className="text-sm mt-1" style={{ color: '#8A7560' }}>
                  Here is an overview of investment opportunities across the JUKUMU network.
                </p>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Active Projects"
                  value={String(projects.length)}
                  sub="Approved Prodcasts"
                  accent
                />
                <StatCard
                  label="Funding Sought"
                  value={fmtShort(totalFundingSought)}
                  sub="Total requested"
                />
                <StatCard
                  label="Groups"
                  value={String(stats?.totalGroups ?? groups.length)}
                  sub="Active"
                />
                <StatCard
                  label="Members"
                  value={String(stats?.totalMembers ?? '—')}
                  sub={`${stats?.activeRegions ?? '—'} regions`}
                />
              </div>

              {/* Featured projects */}
              {projects.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold" style={{ color: '#1A1200' }}>Recently Voted Projects</h3>
                    <button
                      onClick={() => setSection('projects')}
                      className="text-xs font-semibold"
                      style={{ color: '#D4881E' }}
                    >
                      View all →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.slice(0, 3).map(p => (
                      <ProjectCard key={p.id} p={p} onContact={setContactTarget} onFund={setFundTarget} />
                    ))}
                  </div>
                </div>
              )}

              {/* Groups snapshot */}
              {groups.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold" style={{ color: '#1A1200' }}>Active Groups</h3>
                    <button
                      onClick={() => setSection('groups')}
                      className="text-xs font-semibold"
                      style={{ color: '#D4881E' }}
                    >
                      View all →
                    </button>
                  </div>
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid #EDE8E0', background: '#fff' }}
                  >
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: '1px solid #EDE8E0', background: '#FAFAF7' }}>
                          {['Group', 'Members', 'Monthly Contribution', 'Projects'].map(h => (
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
                  <p className="font-semibold" style={{ color: '#1A1200' }}>No data yet</p>
                  <p className="text-xs mt-1" style={{ color: '#A8997E' }}>Prodcast projects will appear here once approved by groups</p>
                </div>
              )}
            </div>
          )}

          {/* ── PROJECTS ─────────────────────────────── */}
          {section === 'projects' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>Investment Projects</h2>
                <p className="text-sm mt-1" style={{ color: '#8A7560' }}>
                  {projects.length} {projects.length === 1 ? 'project' : 'projects'} approved by member vote
                </p>
              </div>

              {projects.length === 0 ? (
                <div className="rounded-2xl p-16 text-center" style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                  <p className="font-semibold" style={{ color: '#1A1200' }}>No projects yet</p>
                  <p className="text-xs mt-1" style={{ color: '#A8997E' }}>Groups will submit projects here through the voting process</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {projects.map(p => (
                    <ProjectCard key={p.id} p={p} onContact={setContactTarget} onFund={setFundTarget} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── GROUPS ───────────────────────────────── */}
          {section === 'groups' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>VICOBA Groups</h2>
                <p className="text-sm mt-1" style={{ color: '#8A7560' }}>
                  {groups.length} {groups.length === 1 ? 'group' : 'groups'} active — with full financial transparency
                </p>
              </div>

              {groups.length === 0 ? (
                <div className="rounded-2xl p-16 text-center" style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                  <p className="font-semibold" style={{ color: '#1A1200' }}>No groups yet</p>
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
                            {g.leader_name ? `Leader: ${g.leader_name}` : '—'}
                            {g.founded_date && ` · ${new Date(g.founded_date).getFullYear()}`}
                          </p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex gap-6 shrink-0 flex-wrap">
                        <div className="text-center">
                          <p className="text-[10px] font-semibold uppercase" style={{ color: '#A8997E' }}>Members</p>
                          <p className="text-base font-black font-mono" style={{ color: '#1A1200' }}>{g.member_count}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-semibold uppercase" style={{ color: '#A8997E' }}>Monthly</p>
                          <p className="text-sm font-bold font-mono" style={{ color: '#1A1200' }}>{fmtShort(Number(g.monthly_contribution))}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-semibold uppercase" style={{ color: '#A8997E' }}>Investment</p>
                          <p className="text-sm font-bold font-mono" style={{ color: '#0B3D2E' }}>{fmtShort(Number(g.total_investment))}</p>
                        </div>
                        {Number(g.prodcast_count) > 0 && (
                          <div className="text-center">
                            <p className="text-[10px] font-semibold uppercase" style={{ color: '#A8997E' }}>Projects</p>
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
                <h2 className="text-xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>nTZS Wallet</h2>
                <p className="text-sm mt-1" style={{ color: '#8A7560' }}>Deposit, withdraw, or transfer funds via the Base network</p>
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
                        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(212,136,30,0.7)' }}>Wallet Balance</p>
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
                        title="Refresh"
                      >
                        <svg className={`w-4 h-4 ${walletLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => { setWalletModal('deposit'); setWalletMsg(null); }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={{ background: '#D4881E', color: '#fff' }}
                        onMouseOver={e => e.currentTarget.style.background = '#B8740F'}
                        onMouseOut={e => e.currentTarget.style.background = '#D4881E'}
                      >
                        + Deposit
                      </button>
                      <button
                        onClick={() => { setWalletModal('withdraw'); setWalletMsg(null); }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(255,255,255,0.08)', color: '#E8D5B0', border: '1px solid rgba(255,255,255,0.1)' }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                      >
                        − Withdraw
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
                  <p className="font-bold mb-1" style={{ color: '#1A1200' }}>Wallet Not Set Up</p>
                  <p className="text-xs mb-5" style={{ color: '#A8997E' }}>Click below to create your nTZS wallet on the Base network</p>
                  <button
                    onClick={handleProvisionWallet}
                    disabled={provisioningWallet}
                    className="px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: '#D4881E', color: '#fff' }}
                  >
                    {provisioningWallet ? 'Setting up...' : 'Create Wallet →'}
                  </button>
                </div>
              )}

              {/* Transaction history */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#8A7560' }}>Recent Transactions</p>
                {transactions.length === 0 ? (
                  <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1px solid #EDE8E0' }}>
                    <p className="text-sm" style={{ color: '#C4B89E' }}>No transactions yet</p>
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
                              {tx.type === 'deposit' ? 'Deposit' : tx.type === 'withdrawal' ? 'Withdrawal' : 'Transfer'}
                              {tx.note ? ` — ${tx.note}` : ''}
                            </p>
                            <p className="text-[10px]" style={{ color: '#A8997E' }}>
                              {new Date(tx.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                  <h2 className="text-xl font-bold" style={{ color: '#1A1200', letterSpacing: '-0.02em' }}>Your Profile</h2>
                  <p className="text-sm mt-1" style={{ color: '#8A7560' }}>Your investor information</p>
                </div>
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: '#1A1200', color: '#D4881E' }}
                  >
                    Edit
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
                    {profile?.verified ? 'Account Verified' : 'Pending Verification'}
                  </p>
                  <p className="text-[10px]" style={{ color: profile?.verified ? '#6EE7B7' : '#FCD34D' }}>
                    {profile?.verified
                      ? 'You have full access to group data'
                      : 'Our team will reach out within 2 business days'}
                  </p>
                </div>
              </div>

              {editMode ? (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {[
                    { label: 'Full Name', key: 'full_name', type: 'text' },
                    { label: 'Company', key: 'company', type: 'text' },
                    { label: 'Country', key: 'country', type: 'text' },
                    { label: 'Website', key: 'website', type: 'url' },
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
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#4A3D2A' }}>Bio</label>
                    <textarea
                      value={editForm.bio || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                      style={{ background: '#fff', border: '1.5px solid #EDE8E0', color: '#1A1200' }}
                      onFocus={e => e.target.style.borderColor = '#D4881E'}
                      onBlur={e => e.target.style.borderColor = '#EDE8E0'}
                      placeholder="Describe your investment interests..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#4A3D2A' }}>Min Investment (TSH)</label>
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
                      <label className="block text-xs font-semibold mb-1" style={{ color: '#4A3D2A' }}>Max Investment (TSH)</label>
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
                      Cancel
                    </button>
                    <button
                      type="submit" disabled={saving}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                      style={{ background: '#D4881E', color: '#fff' }}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #EDE8E0', background: '#fff' }}>
                  {[
                    { label: 'Full Name', value: profile?.full_name },
                    { label: 'Email', value: profile?.email },
                    { label: 'Company', value: profile?.company },
                    { label: 'Type', value: profile?.investor_type },
                    { label: 'Country', value: profile?.country },
                    { label: 'Website', value: profile?.website },
                    { label: 'LinkedIn', value: profile?.linkedin },
                    { label: 'Min Investment', value: fmt(profile?.min_investment_tzs) },
                    { label: 'Max Investment', value: fmt(profile?.max_investment_tzs) },
                  ].filter(r => r.value).map((row, i, arr) => (
                    <div
                      key={row.label}
                      className="flex items-start gap-4 px-5 py-4"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid #F5F0E8' : 'none' }}
                    >
                      <p className="text-xs font-semibold w-32 shrink-0 pt-0.5" style={{ color: '#A8997E' }}>{row.label}</p>
                      <p className="text-sm font-medium flex-1" style={{ color: '#1A1200' }}>
                        {(row.label === 'Website' || row.label === 'LinkedIn') && row.value
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
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#D4881E' }}>Group Details</p>
                <h2 className="text-base font-bold truncate" style={{ color: '#E8D5B0' }}>
                  {groupDetailLoading ? 'Loading...' : groupDetail?.name ?? '...'}
                </h2>
                {groupDetail?.leader_name && (
                  <p className="text-xs mt-0.5" style={{ color: '#6B5C3E' }}>Leader: {groupDetail.leader_name}</p>
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
                    { label: 'Members', value: String(groupDetail.member_count) },
                    { label: 'Pool/Month', value: fmtShort(Number(groupDetail.monthly_contribution) * groupDetail.member_count) },
                    { label: 'Passed', value: `${groupDetail.passed_proposals}/${groupDetail.total_proposals}` },
                    { label: 'Executed', value: String(groupDetail.executed_proposals) },
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
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8A7560' }}>◆ Financial Health</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#F5F0E8' }}>
                    {[
                      { label: 'Monthly Contribution', value: fmtShort(Number(groupDetail.monthly_contribution)) },
                      { label: 'Monthly Pool (members × contribution)', value: fmtShort(Number(groupDetail.monthly_contribution) * groupDetail.member_count) },
                      { label: 'Treasury Wallet', value: groupDetail.ntzs_user_id ? '✓ Active (nTZS)' : 'Not yet configured' },
                      { label: 'Transactions (90d)', value: `${groupDetail.transactions_90d} tx` },
                      { label: 'Volume (90d)', value: fmtShort(Number(groupDetail.volume_90d_tzs)) },
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
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8A7560' }}>◈ Governance</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#F5F0E8' }}>
                    {[
                      {
                        label: 'Voting Threshold',
                        value: `${groupDetail.voting_threshold_numerator}/${groupDetail.voting_threshold_denominator} of members`,
                      },
                      { label: 'Proposals Passed', value: `${groupDetail.passed_proposals} of ${groupDetail.total_proposals}` },
                      { label: 'Execution Rate', value: groupDetail.passed_proposals > 0 ? `${Math.round((groupDetail.executed_proposals / groupDetail.passed_proposals) * 100)}%` : '—' },
                      { label: 'Open Proposals', value: `${groupDetail.open_proposals} active` },
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
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8A7560' }}>◉ Recent Activity</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#F5F0E8' }}>
                    {[
                      { label: 'Last Activity', value: groupDetail.last_activity ? ago(groupDetail.last_activity) : 'Unknown' },
                      { label: '90-Day Transactions', value: `${groupDetail.transactions_90d} transactions` },
                      { label: 'Founded', value: groupDetail.founded_date ? new Date(groupDetail.founded_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—' },
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
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8A7560' }}>◎ Leadership</p>
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
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#8A7560' }}>◆ Prodcast Projects</p>
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
                                {p.funded_at ? 'Funded' : 'Pending'}
                              </span>
                            </div>
                            {p.description && <p className="text-xs line-clamp-2" style={{ color: '#8A7560' }}>{p.description}</p>}
                            {goal > 0 && (
                              <p className="text-xs font-bold font-mono mt-2" style={{ color: '#D4881E' }}>
                                Goal: {fmtShort(goal)}
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
                  href={`mailto:invest@jukumufund.co.tz?subject=Interest in Group: ${encodeURIComponent(groupDetail.name)}&body=Hello,%0A%0AI would like to learn more about the group "${groupDetail.name}".%0A%0AMy name: ${encodeURIComponent(profile?.full_name ?? '')}%0ACompany: ${encodeURIComponent(profile?.company ?? 'N/A')}%0A%0AThank you.`}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
                  style={{ background: '#1A1200', color: '#D4881E' }}
                  onMouseOver={e => { e.currentTarget.style.background = '#D4881E'; e.currentTarget.style.color = '#fff'; }}
                  onMouseOut={e => { e.currentTarget.style.background = '#1A1200'; e.currentTarget.style.color = '#D4881E'; }}
                >
                  Contact Us About This Group →
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
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#D4881E' }}>Contact Request</p>
                <h3 className="text-base font-bold mt-1" style={{ color: '#1A1200' }}>{contactTarget.title}</h3>
                <p className="text-xs" style={{ color: '#8A7560' }}>{contactTarget.group_name}</p>
              </div>
              <button onClick={() => setContactTarget(null)} className="p-1" style={{ color: '#A8997E' }}>✕</button>
            </div>

            {contactTarget.metadata?.funding_goal_tzs && (
              <div className="rounded-xl p-3" style={{ background: '#FEF3E2', border: '1px solid #FCD9A0' }}>
                <p className="text-xs" style={{ color: '#92400E' }}>
                  Funding goal: <span className="font-black font-mono">{fmt(contactTarget.metadata.funding_goal_tzs)}</span>
                </p>
              </div>
            )}

            <p className="text-sm" style={{ color: '#6B5C3E' }}>
              Our team will help you connect with{' '}
              <span className="font-semibold" style={{ color: '#1A1200' }}>{contactTarget.group_name}</span>{' '}
              through our due diligence and onboarding process.
            </p>

            <a
              href={`mailto:invest@jukumufund.co.tz?subject=Interest in: ${encodeURIComponent(contactTarget.title)} (${encodeURIComponent(contactTarget.group_name)})&body=Hello,%0A%0AI would like to learn more about the project "${contactTarget.title}" from the group ${contactTarget.group_name}.%0A%0AMy name: ${encodeURIComponent(profile?.full_name || '')}%0ACompany: ${encodeURIComponent(profile?.company || 'N/A')}%0A%0AThank you.`}
              className="w-full py-3 rounded-xl text-sm font-semibold text-center block transition-all"
              style={{ background: '#D4881E', color: '#fff' }}
            >
              Send Email →
            </a>

            <button
              onClick={() => setContactTarget(null)}
              className="w-full py-2.5 rounded-xl text-sm"
              style={{ color: '#8A7560', border: '1px solid #EDE8E0' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Fund Project Modal ───────────────────────── */}
      {fundTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#FAFAF7', border: '1px solid #EDE8E0' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5" style={{ background: '#0E0B07', borderBottom: '1px solid #2A1F0A' }}>
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#D4881E' }}>Fund Project</p>
                <p className="text-sm font-bold mt-0.5 truncate max-w-[220px]" style={{ color: '#E8D5B0' }}>{fundTarget.title}</p>
              </div>
              <button
                onClick={() => { setFundTarget(null); setFundMsg(null); setFundAmount(''); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#6B5C3E' }}
              >✕</button>
            </div>

            <form onSubmit={handleFundProject} className="p-6 space-y-4">
              {/* Recipient */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#F5F0E8' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0" style={{ background: '#0B3D2E', color: '#4ADE80' }}>
                  {fundTarget.group_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#1A1200' }}>{fundTarget.group_name}</p>
                  <p className="text-[10px]" style={{ color: '#A8997E' }}>{fundTarget.member_count} members</p>
                </div>
              </div>

              {/* Balance */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#F5F0E8' }}>
                <span className="text-xs" style={{ color: '#8A7560' }}>Your balance</span>
                <span className="text-sm font-black font-mono" style={{ color: wallet.balanceTzs > 0 ? '#059669' : '#DC2626' }}>
                  TSH {wallet.balanceTzs.toLocaleString('en-TZ')}
                </span>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4A3D2A' }}>Amount (nTZS) *</label>
                <input
                  type="number" min="1000" step="100"
                  value={fundAmount}
                  onChange={e => setFundAmount(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#fff', border: '1.5px solid #EDE8E0', color: '#1A1200', fontFamily: 'monospace' }}
                  onFocus={e => e.target.style.borderColor = '#D4881E'}
                  onBlur={e => e.target.style.borderColor = '#EDE8E0'}
                  required
                />
                {fundTarget.metadata?.funding_goal_tzs && (
                  <p className="text-[10px] mt-1.5" style={{ color: '#A8997E' }}>
                    Funding goal: <span style={{ fontFamily: 'monospace', color: '#1A1200' }}>TSH {Number(fundTarget.metadata.funding_goal_tzs).toLocaleString()}</span>
                  </p>
                )}
              </div>

              {fundMsg && (
                <div
                  className="px-4 py-3 rounded-xl text-xs font-medium"
                  style={{
                    background: fundMsg.ok ? '#ECFDF5' : '#FEF2F2',
                    color: fundMsg.ok ? '#059669' : '#DC2626',
                    border: `1px solid ${fundMsg.ok ? '#A7F3D0' : '#FECACA'}`,
                  }}
                >
                  {fundMsg.text}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setFundTarget(null); setFundMsg(null); setFundAmount(''); }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ border: '1.5px solid #EDE8E0', color: '#8A7560', background: 'transparent' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fundSubmitting || !wallet.provisioned}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: '#D4881E', color: '#fff' }}
                >
                  {fundSubmitting ? 'Sending...' : 'Send nTZS →'}
                </button>
              </div>

              {!wallet.provisioned && (
                <p className="text-[10px] text-center" style={{ color: '#DC2626' }}>
                  Set up your wallet first before funding a project.
                </p>
              )}
            </form>
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
                  {walletModal === 'deposit' ? 'Deposit' : 'Withdraw'}
                </p>
                <p className="text-sm font-bold mt-0.5" style={{ color: '#E8D5B0' }}>
                  {walletModal === 'withdraw' ? 'Withdraw to mobile number' : 'Select deposit method'}
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
              <div className="grid grid-cols-3 gap-0" style={{ borderBottom: '1px solid #EDE8E0', background: '#fff' }}>
                {([
                  { key: 'mobile', icon: '◌', label: 'M-Pesa', live: true },
                  { key: 'bank',   icon: '▦', label: 'Bank', live: false },
                  { key: 'card',   icon: '▭', label: 'Card', live: false },
                ] as { key: 'mobile'|'bank'|'card'; icon: string; label: string; live: boolean }[]).map(m => (
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
                <span className="text-xs" style={{ color: '#8A7560' }}>Current balance</span>
                <span className="text-sm font-black font-mono" style={{ color: '#1A1200' }}>
                  TSH {wallet.balanceTzs.toLocaleString('en-TZ')}
                </span>
              </div>

              {/* ── COMING SOON (bank / card) ── */}
              {walletModal === 'deposit' && (depositMethod === 'bank' || depositMethod === 'card') && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl" style={{ background: '#F5F0E8' }}>
                    {depositMethod === 'bank' ? '▦' : '▭'}
                  </div>
                  <p className="font-bold text-sm" style={{ color: '#1A1200' }}>
                    {depositMethod === 'bank' ? 'Bank Deposit' : 'Card Deposit'}
                  </p>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold" style={{ background: '#F5F0E8', color: '#8A7560' }}>
                    Coming Soon
                  </span>
                  <p className="text-xs" style={{ color: '#A8997E' }}>
                    {depositMethod === 'bank'
                      ? 'Bank transfers will be available soon'
                      : 'Credit / debit card payments are coming soon'}
                  </p>
                </div>
              )}

              {/* ── MOBILE MONEY form (deposit mobile or any withdraw) ── */}
              {(walletModal === 'withdraw' || (walletModal === 'deposit' && depositMethod === 'mobile')) && (
                <form onSubmit={handleWalletAction} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4A3D2A' }}>Amount (TSH) *</label>
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
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4A3D2A' }}>Phone Number *</label>
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
                    >Cancel</button>
                    <button
                      type="submit" disabled={walletSubmitting}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                      style={{ background: walletModal === 'deposit' ? '#D4881E' : '#0B3D2E', color: '#fff' }}
                    >
                      {walletSubmitting ? 'Sending...' : walletModal === 'deposit' ? 'Deposit' : 'Withdraw'}
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
