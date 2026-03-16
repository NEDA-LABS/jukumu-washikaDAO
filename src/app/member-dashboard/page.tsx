'use client';
/* build:20260224-1410 */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ChartBarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
  BookOpenIcon,
  UserIcon,
  WalletIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import WalletDashboard from '@/components/WalletDashboard';

export default function MemberDashboard() {
  const { } = useLanguage();
  const router = useRouter();
  const [user, setUser] = useState<{id?: number; fullName?: string; email: string; role?: string} | null>(null);
  const [memberInfo, setMemberInfo] = useState<{id?: number; fullName?: string; email?: string} | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [memberProfile, setMemberProfile] = useState<any>(null);
  const [memberInvestments, setMemberInvestments] = useState<any[]>([]);
  const [memberTraining, setMemberTraining] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check authentication and load member data
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Redirect admins to admin dashboard
      if (parsedUser.role === 'admin') {
        router.push('/dashboard');
        return;
      }
      
      // Check URL parameters for section navigation
      const urlParams = new URLSearchParams(window.location.search);
      const section = urlParams.get('section');
      if (section) {
        setActiveSection(section);
      }
      
      // First verify user-to-member mapping
      verifyUserMemberMapping(parsedUser.id);
    } else {
      router.push('/login');
    }
  }, [router]);

  const verifyUserMemberMapping = async (userId: number) => {
    try {
      const response = await fetch(`/api/user-to-member?userId=${userId}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('User-Member mapping:', data);
        
        if (data.hasMemberProfile) {
          // Store the correct member information
          setMemberInfo({
            id: data.member.id,
            fullName: data.member.full_name,
            email: data.member.email
          });
          // Load member data using the correct member ID
          loadMemberData(userId, data.member.id);
        } else {
          console.warn('User has no member profile');
          setLoading(false);
        }
      } else {
        console.error('Failed to verify user-member mapping:', data.error);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error verifying user-member mapping:', error);
      setLoading(false);
    }
  };

  const loadMemberData = async (userId: number, memberId?: number) => {
    try {
      setLoading(true);
      
      // Load member profile
      const profileResponse = await fetch(`/api/members/profile?userId=${userId}`);
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setMemberProfile(profileData);
      }
      
      // Load member investments
      const investmentsResponse = await fetch(`/api/members/investments?userId=${userId}`);
      if (investmentsResponse.ok) {
        const investmentsData = await investmentsResponse.json();
        setMemberInvestments(investmentsData);
      }
      
      // Load member training - use educational content instead
      const trainingResponse = await fetch(`/api/educational-content`);
      if (trainingResponse.ok) {
        const trainingData = await trainingResponse.json();
        // Transform educational content to match training format
        const formattedTraining = trainingData.map((content: any) => ({
          id: content.id,
          title: content.title,
          description: content.description,
          duration_hours: parseFloat(content.duration?.replace(/[^0-9.]/g, '') || '1'),
          category: content.category,
          level: content.difficulty_level,
          progress_status: 'not_started', // TODO: Add progress tracking
          progress_percentage: 0,
          started_at: null,
          completed_at: null
        }));
        setMemberTraining(formattedTraining);
      }
      
      // Load recent activities
      const activitiesResponse = await fetch(`/api/members/activities?userId=${userId}`);
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setRecentActivities(activitiesData);
      }
    } catch (error) {
      console.error('Error loading member data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'wallet', name: 'Wallet', icon: WalletIcon },
    { id: 'group', name: 'My Group', icon: UserGroupIcon },
    { id: 'investments', name: 'My Investments', icon: CurrencyDollarIcon },
    { id: 'learning', name: 'Training', icon: AcademicCapIcon },
    { id: 'settings', name: 'Settings', icon: CogIcon },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <MemberOverviewSection memberProfile={memberProfile} memberInvestments={memberInvestments} recentActivities={recentActivities} onNavigate={setActiveSection} userId={user?.id || 0} />;
      case 'wallet':
        return <WalletDashboard userId={user?.id || 0} />;
      case 'profile':
        return <ProfileSection memberProfile={memberProfile} user={user} loadMemberData={() => loadMemberData(user?.id || 0)} />;
      case 'group':
        return <MyGroupSection memberProfile={memberProfile} />;
      case 'investments':
        return <MyInvestmentsSection memberInvestments={memberInvestments} />;
      case 'learning':
        return <LearningSection memberTraining={memberTraining} user={user} />;
      case 'settings':
        return <MemberSettingsSection onNavigate={setActiveSection} user={user} memberProfile={memberProfile} loadMemberData={() => loadMemberData(user?.id || 0)} />;
      default:
        return <MemberOverviewSection memberProfile={memberProfile} memberInvestments={memberInvestments} recentActivities={recentActivities} onNavigate={setActiveSection} userId={user?.id || 0} />;
    }
  };

  const activeName = menuItems.find(m => m.id === activeSection)?.name || 'Overview';

  return (
    <div className="min-h-[100dvh] bg-[#0d0d0d] flex">

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed top-0 left-0 h-[100dvh] w-60 bg-[#111111] border-r border-white/5
        flex flex-col z-30 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:flex
      `}>
        {/* Brand */}
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 shrink-0">
              <span className="text-sm font-bold text-white">J</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">Washika DAU</p>
              <p className="text-xs text-white/40 truncate">{user.fullName || user.email}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setSidebarOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm
                  transition-all duration-150
                  ${ active
                    ? 'bg-orange-500/15 text-orange-400 font-medium'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }
                `}
              >
                <item.icon className={`h-4.5 w-4.5 shrink-0 ${ active ? 'text-orange-400' : '' }`} />
                <span>{item.name}</span>
                {active && <span className="ml-auto w-1 h-4 rounded-full bg-orange-400" />}
              </button>
            );
          })}
        </nav>

        {/* Logout pinned to bottom */}
        <div className="px-3 py-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            <ArrowRightOnRectangleIcon className="h-4.5 w-4.5 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Top bar (mobile only — page title + avatar) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#111111] border-b border-white/5 sticky top-0 z-10">
          <span className="text-sm font-semibold text-white">{activeName}</span>
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <span className="text-xs font-bold text-white">{(user.fullName || user.email || 'U')[0].toUpperCase()}</span>
          </div>
        </header>

        {/* Page title bar (desktop) */}
        <div className="hidden lg:flex items-center justify-between px-8 pt-8 pb-2">
          <h1 className="text-xl font-semibold text-white">{activeName}</h1>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {(user.fullName || user.email || 'U')[0].toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-white/50">{user.fullName || user.email}</span>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 px-4 lg:px-8 py-4 lg:py-6 pb-24 lg:pb-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
            </div>
          ) : (
            renderContent()
          )}
        </main>
      </div>
      {/* ── Mobile Bottom Nav ── */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#111111]/95 backdrop-blur-xl border-t border-white/[0.06]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-end justify-around px-1 h-16">
          {/* Home */}
          <button
            onClick={() => setActiveSection('overview')}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${activeSection === 'overview' ? 'text-orange-400' : 'text-white/30'}`}
          >
            <ChartBarIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium">Nyumbani</span>
          </button>

          {/* Wallet */}
          <button
            onClick={() => setActiveSection('wallet')}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${activeSection === 'wallet' ? 'text-orange-400' : 'text-white/30'}`}
          >
            <WalletIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium">Pochi</span>
          </button>

          {/* Groups — elevated centre tab */}
          <button
            onClick={() => setActiveSection('group')}
            className="flex flex-col items-center gap-1 -mt-5"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              activeSection === 'group'
                ? 'bg-orange-500 shadow-xl shadow-orange-500/40 scale-105'
                : 'bg-[#1e1e1e] border border-orange-500/20 shadow-lg shadow-orange-500/10'
            }`}>
              <UserGroupIcon className={`h-6 w-6 ${activeSection === 'group' ? 'text-white' : 'text-white/50'}`} />
            </div>
            <span className={`text-[10px] font-medium ${activeSection === 'group' ? 'text-orange-400' : 'text-white/30'}`}>Kundi</span>
          </button>

          {/* Training */}
          <button
            onClick={() => setActiveSection('learning')}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${activeSection === 'learning' ? 'text-orange-400' : 'text-white/30'}`}
          >
            <AcademicCapIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium">Mafunzo</span>
          </button>

          {/* Settings (includes Profile) */}
          <button
            onClick={() => setActiveSection('settings')}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${
              activeSection === 'settings' || activeSection === 'profile' ? 'text-orange-400' : 'text-white/30'
            }`}
          >
            <CogIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium">Zaidi</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function MemberOverviewSection({ memberProfile, memberInvestments, recentActivities, onNavigate, userId }: { memberProfile: any; memberInvestments: any[]; recentActivities: any[]; onNavigate: (section: string) => void; userId: number }) {
  const [balanceTzs, setBalanceTzs] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/wallet/balance?userId=${userId}`)
      .then(r => r.json())
      .then(d => setBalanceTzs(d.balanceTzs ?? 0))
      .catch(() => setBalanceTzs(0))
      .finally(() => setBalanceLoading(false));
  }, [userId]);

  const totalInvestment = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  const expectedReturns = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.expected_return || 0), 0);
  const isActive = memberProfile?.status === 'active';

  const stats = [
    { name: 'Hali ya Uanachama', value: isActive ? 'Hai' : 'Inasubiri', icon: UserIcon, accent: isActive ? 'text-emerald-400' : 'text-yellow-400', bg: isActive ? 'bg-emerald-500/10' : 'bg-yellow-500/10' },
    { name: 'Kundi Langu', value: memberProfile?.group_name || 'Hujajiunga', icon: UserGroupIcon, accent: 'text-blue-400', bg: 'bg-blue-500/10' },
    { name: 'Uwekezaji Wangu', value: `TSh ${totalInvestment.toLocaleString()}`, icon: CurrencyDollarIcon, accent: 'text-orange-400', bg: 'bg-orange-500/10' },
    { name: 'Faida Inayotarajiwa', value: `TSh ${expectedReturns.toLocaleString()}`, icon: ChartBarIcon, accent: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  const displayActivities = recentActivities.length > 0
    ? recentActivities.map(a => ({ action: a.action_text, time: new Date(a.activity_date).toLocaleDateString('sw-TZ') }))
    : [{ action: 'Umejiunga na Washika DAU', time: memberProfile?.created_at ? new Date(memberProfile.created_at).toLocaleDateString('sw-TZ') : 'Leo' }];

  return (
    <div className="space-y-4">
      {/* Greeting + inline balance */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-white">
            Habari, {memberProfile?.full_name?.split(' ')[0] || 'Mwanachama'} 👋
          </h2>
          <p className="text-sm text-white/40 mt-0.5">Hapa kuna muhtasari wa akaunti yako</p>
        </div>
        {/* Balance pill — top right of greeting */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#1a1a1a] border border-white/[0.07]">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
            <WalletIcon className="h-3.5 w-3.5 text-orange-400" />
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider leading-none mb-0.5">Salio</p>
            {balanceLoading ? (
              <div className="h-4 w-20 rounded bg-white/5 animate-pulse" />
            ) : (
              <p className="text-sm font-bold text-white leading-none">
                TSh <span className="text-orange-400">{(balanceTzs ?? 0).toLocaleString()}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Compact web3-style action strip ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigate('wallet')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors shadow-lg shadow-orange-500/20"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Weka Pesa
        </button>
        <button
          onClick={() => onNavigate('wallet')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white/70 text-xs font-medium border border-white/[0.08] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
          Toa Pesa
        </button>
        <button
          onClick={() => onNavigate('wallet')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white/70 text-xs font-medium border border-white/[0.08] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          Hamisha
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-white/25">nTZS live</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="rounded-xl bg-[#1a1a1a] border border-white/5 p-4 flex flex-col gap-3">
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
              <s.icon className={`h-4 w-4 ${s.accent}`} />
            </div>
            <div>
              <p className="text-xs text-white/40 mb-0.5">{s.name}</p>
              <p className="text-sm font-semibold text-white leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Activity + nav shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent activity */}
        <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Shughuli za Hivi Karibuni</h3>
          <div className="space-y-3">
            {displayActivities.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white/80 truncate">{a.action}</p>
                  <p className="text-xs text-white/30 mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nav shortcuts */}
        <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Nenda Haraka</h3>
          <div className="space-y-2">
            {[
              { label: 'Wallet Yangu', sub: 'Historia na mabadiliko ya salio', icon: WalletIcon, section: 'wallet' },
              { label: 'Kundi Langu', sub: 'Angalia wanachama na shughuli', icon: UserGroupIcon, section: 'group' },
              { label: 'Mafunzo', sub: 'Endelea na masomo', icon: AcademicCapIcon, section: 'learning' },
              { label: 'Uwekezaji', sub: 'Fuatilia mapato yako', icon: CurrencyDollarIcon, section: 'investments' },
            ].map((item) => (
              <button
                key={item.section}
                onClick={() => onNavigate(item.section)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
              >
                <item.icon className="h-4 w-4 text-white/30 group-hover:text-orange-400 transition-colors shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white/70 group-hover:text-white transition-colors">{item.label}</p>
                  <p className="text-xs text-white/25">{item.sub}</p>
                </div>
                <span className="ml-auto text-white/20 group-hover:text-orange-400 transition-colors text-sm">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = (editing: boolean) =>
  `w-full px-3 py-2.5 rounded-lg text-sm border transition-colors focus:outline-none ${
    editing
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50'
      : 'bg-white/[0.03] border-white/5 text-white/50 cursor-default'
  }`;

function ProfileSection({ memberProfile, user, loadMemberData }: { memberProfile: any; user: any; loadMemberData: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: memberProfile?.full_name || '',
    phone: memberProfile?.phone || '',
    location: memberProfile?.location || '',
    businessType: memberProfile?.business_type || '',
    businessName: memberProfile?.business_name || '',
    businessDescription: memberProfile?.business_description || '',
    monthlyRevenue: memberProfile?.monthly_revenue || '',
    employeeCount: memberProfile?.employee_count || '',
  });

  useEffect(() => {
    if (memberProfile) {
      setFormData({
        fullName: memberProfile.full_name || '',
        phone: memberProfile.phone || '',
        location: memberProfile.location || '',
        businessType: memberProfile.business_type || '',
        businessName: memberProfile.business_name || '',
        businessDescription: memberProfile.business_description || '',
        monthlyRevenue: memberProfile.monthly_revenue || '',
        employeeCount: memberProfile.employee_count || '',
      });
    }
  }, [memberProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/members/profile?userId=${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) { setIsEditing(false); loadMemberData(); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const initials = (formData.fullName || user?.email || 'U')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const Field = ({ label, type = 'text', value, field, disabled = false }: { label: string; type?: string; value: string; field?: keyof typeof formData; disabled?: boolean }) => (
    <div>
      <label className="block text-xs text-white/30 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={field ? (e) => setFormData({ ...formData, [field]: e.target.value }) : undefined}
        disabled={!isEditing || disabled}
        className={inputCls(isEditing && !disabled)}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Profile header card */}
      <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-white truncate">{formData.fullName || 'Mwanachama'}</p>
          <p className="text-xs text-white/40 mt-0.5 truncate">{memberProfile?.email || user?.email}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${
            memberProfile?.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'
          }`}>
            {memberProfile?.status === 'active' ? 'Mwanachama Hai' : 'Inasubiri'}
          </span>
        </div>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={saving}
          className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            isEditing
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-white/5 hover:bg-white/10 text-white/70'
          }`}
        >
          {saving ? 'Inahifadhi...' : isEditing ? 'Hifadhi' : 'Hariri'}
        </button>
      </div>

      {/* Personal info */}
      <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Taarifa Binafsi</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Jina Kamili" value={formData.fullName} field="fullName" />
          <Field label="Barua Pepe" value={memberProfile?.email || user?.email || ''} disabled />
          <Field label="Nambari ya Simu" type="tel" value={formData.phone} field="phone" />
          <Field label="Mahali Unapoishi" value={formData.location} field="location" />
        </div>
      </div>

      {/* Business info */}
      <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Taarifa za Biashara</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Jina la Biashara" value={formData.businessName} field="businessName" />
          <Field label="Aina ya Biashara" value={formData.businessType} field="businessType" />
          <Field label="Mapato ya Kila Mwezi (TSh)" type="number" value={formData.monthlyRevenue} field="monthlyRevenue" />
          <Field label="Idadi ya Wafanyakazi" type="number" value={formData.employeeCount} field="employeeCount" />
        </div>
        <div className="mt-3">
          <label className="block text-xs text-white/30 mb-1">Maelezo ya Biashara</label>
          <textarea
            value={formData.businessDescription}
            onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
            disabled={!isEditing}
            rows={3}
            className={`${inputCls(isEditing)} resize-none`}
          />
        </div>
      </div>

      {isEditing && (
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all"
          >
            Ghairi
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? 'Inahifadhi...' : 'Hifadhi Mabadiliko'}
          </button>
        </div>
      )}
    </div>
  );
}

function MyGroupSection({ memberProfile }: { memberProfile: any }) {
  const router = useRouter();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [showAvailableGroups, setShowAvailableGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [joinMessage, setJoinMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', monthlyContribution: '', votingNumerator: '3', votingDenominator: '5' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
      loadMyGroups();
      loadAvailableGroups();
      loadJoinRequests();
    }
  }, [memberProfile]);

  const loadMyGroups = async () => {
    try {
      const res = await fetch('/api/member/groups');
      if (res.ok) { const d = await res.json(); setMyGroups(d.groups || []); }
      else if (res.status === 401) router.push('/login');
    } catch (e) { console.error(e); }
  };

  const loadAvailableGroups = async () => {
    try {
      const res = await fetch('/api/member/available-groups');
      if (res.ok) { const d = await res.json(); setAvailableGroups(d.groups || []); }
      else if (res.status === 401) router.push('/login');
    } catch (e) { console.error(e); }
  };

  const loadJoinRequests = async () => {
    try {
      const res = await fetch('/api/member/join-requests');
      if (res.ok) { const d = await res.json(); setJoinRequests(d.requests || []); }
      else if (res.status === 401) router.push('/login');
    } catch (e) { console.error(e); }
  };

  const handleJoinRequest = async (groupId: number) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/member/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, message: joinMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedGroup(null);
        setJoinMessage('');
        await Promise.all([loadJoinRequests(), loadAvailableGroups()]);
      } else {
        alert(data.error || 'An error occurred');
      }
    } catch { alert('An error occurred while sending request'); }
    finally { setLoading(false); }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await fetch('/api/member/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          monthlyContribution: Number(createForm.monthlyContribution),
          votingNumerator: Number(createForm.votingNumerator),
          votingDenominator: Number(createForm.votingDenominator),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setCreateForm({ name: '', monthlyContribution: '', votingNumerator: '3', votingDenominator: '5' });
        await loadMyGroups();
        if (data.group?.id) router.push(`/member-dashboard/groups/${data.group.id}`);
      } else {
        setCreateError(data.error || 'Imeshindikana kuunda kundi.');
      }
    } catch { setCreateError('Hitilafu imetokea. Jaribu tena.'); }
    finally { setCreateLoading(false); }
  };

  const statusConfig: Record<string, { label: string; cls: string }> = {
    pending:  { label: 'Inasubiri', cls: 'bg-yellow-500/15 text-yellow-400' },
    approved: { label: 'Imeidhinishwa', cls: 'bg-emerald-500/15 text-emerald-400' },
    rejected: { label: 'Imekataliwa', cls: 'bg-red-500/15 text-red-400' },
  };

  return (
    <div className="space-y-6">

      {/* Header with Create Group button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-white">Makundi Yangu</p>
          <p className="text-xs text-white/30 mt-0.5">Makundi unayoshiriki nayo</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setCreateError(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition-colors"
        >
          <span className="text-base leading-none">+</span> Unda Kundi
        </button>
      </div>

      {myGroups.length > 0 ? (
        <>
          <div className="grid gap-3">
            {myGroups.map((g) => (
              <div
                key={g.id}
                onClick={() => router.push(`/member-dashboard/groups/${g.id}`)}
                className="rounded-xl bg-[#1a1a1a] border border-white/5 hover:border-orange-500/30 p-5 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-white truncate">{g.name}</h3>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-xs bg-orange-500/10 text-orange-400">
                        {g.member_role || 'mwanachama'}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">
                      Hali: {g.membership_status || g.status || 'active'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-orange-400">
                      TSh {parseInt(g.monthly_contribution || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">kwa mwezi</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <p className="text-xs text-white/30">Gusa kuangalia kundi →</p>
                  <div className="flex items-center gap-1.5">
                    <UserGroupIcon className="h-3.5 w-3.5 text-white/30" />
                    <span className="text-xs text-white/30 group-hover:text-orange-400 transition-colors">Angalia →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowAvailableGroups(!showAvailableGroups)}
            className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all"
          >
            {showAvailableGroups ? 'Ficha Makundi' : '+ Jiunge na Kundi Jingine'}
          </button>
        </>
      ) : (
        <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <UserGroupIcon className="h-6 w-6 text-white/30" />
          </div>
          <p className="text-white/50 mb-4 text-sm">Bado hujajiunga na kundi lolote.</p>
          <button
            onClick={() => setShowAvailableGroups(!showAvailableGroups)}
            className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
          >
            {showAvailableGroups ? 'Ficha Makundi' : 'Jiunge na Kundi'}
          </button>
        </div>
      )}

      {/* Pending join requests */}
      {joinRequests.length > 0 && (
        <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Maombi Yangu</h3>
          <div className="space-y-2">
            {joinRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm text-white">{r.group_name}</p>
                  <p className="text-xs text-white/30 mt-0.5">
                    TSh {parseInt(r.monthly_contribution).toLocaleString()}/mwezi · {new Date(r.created_at).toLocaleDateString('sw-TZ')}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${(statusConfig[r.status] || { cls: 'bg-white/5 text-white/40' }).cls}`}>
                  {(statusConfig[r.status] || { label: r.status }).label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available groups */}
      {showAvailableGroups && (
        <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Makundi Yanayopatikana</h3>
          {availableGroups.length === 0 ? (
            <p className="text-sm text-white/40 text-center py-4">Hakuna makundi kwa sasa.</p>
          ) : (
            <div className="space-y-3">
              {availableGroups.map((g) => (
                <div key={g.id} className="rounded-lg border border-white/5 hover:border-white/10 p-4 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{g.name}</h4>
                      <p className="text-xs text-white/40 mt-0.5">Kiongozi: {g.leader_name || 'Hajapewa'}</p>
                      <p className="text-xs text-white/40">Wanachama: {g.member_count}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-orange-400">
                        TSh {parseInt(g.monthly_contribution).toLocaleString()}
                      </p>
                      <p className="text-xs text-white/30">kwa mwezi</p>
                    </div>
                  </div>
                  {joinRequests.some(r => r.group_id === g.id && r.status === 'pending') ? (
                    <button disabled className="w-full py-2 rounded-lg text-xs text-white/30 bg-white/5 cursor-not-allowed">
                      Ombi Limetumwa
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedGroup(g)}
                      className="w-full py-2 rounded-lg text-xs font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors border border-orange-500/20"
                    >
                      Omba Kujiunga
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Group modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-white mb-1">Unda Kundi Jipya</h3>
            <p className="text-xs text-white/40 mb-5">Utakuwa kiongozi wa kundi hili moja kwa moja.</p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1">Jina la Kundi *</label>
                <input
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Mfano: Vikundi vya Maendeleo"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-1">Mchango wa Kila Mwezi (TSh) *</label>
                <input
                  type="number"
                  value={createForm.monthlyContribution}
                  onChange={e => setCreateForm(f => ({ ...f, monthlyContribution: e.target.value }))}
                  placeholder="Mfano: 50000"
                  min="1"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-1">Kiwango cha Kupiga Kura</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={createForm.votingNumerator}
                    onChange={e => setCreateForm(f => ({ ...f, votingNumerator: e.target.value }))}
                    min="1"
                    className="w-20 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white text-center focus:outline-none focus:border-orange-500/50"
                  />
                  <span className="text-white/30 text-sm">kati ya</span>
                  <input
                    type="number"
                    value={createForm.votingDenominator}
                    onChange={e => setCreateForm(f => ({ ...f, votingDenominator: e.target.value }))}
                    min="1"
                    className="w-20 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white text-center focus:outline-none focus:border-orange-500/50"
                  />
                  <span className="text-xs text-white/30">kura kupita</span>
                </div>
                <p className="text-xs text-white/20 mt-1">
                  Sasa hivi: {createForm.votingNumerator}/{createForm.votingDenominator} kura zinahitajika kupitisha pendekezo
                </p>
              </div>

              {createError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{createError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateError(''); }}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {createLoading ? 'Inaunda...' : 'Unda Kundi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join request modal */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-white mb-1">Omba Kujiunga</h3>
            <p className="text-sm text-white/40 mb-4">{selectedGroup.name}</p>

            <div className="flex gap-4 mb-4 p-3 rounded-lg bg-white/5">
              <div>
                <p className="text-xs text-white/30">Mchango wa Kila Mwezi</p>
                <p className="text-sm font-semibold text-orange-400">
                  TSh {parseInt(selectedGroup.monthly_contribution).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/30">Kiongozi</p>
                <p className="text-sm text-white">{selectedGroup.leader_name || 'Hajapewa'}</p>
              </div>
            </div>

            <label className="block text-xs text-white/40 mb-1">Ujumbe (si lazima)</label>
            <textarea
              value={joinMessage}
              onChange={(e) => setJoinMessage(e.target.value)}
              placeholder="Eleza kwa nini ungependa kujiunga..."
              className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 resize-none mb-4"
              rows={3}
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setSelectedGroup(null); setJoinMessage(''); }}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all"
              >
                Ghairi
              </button>
              <button
                onClick={() => handleJoinRequest(selectedGroup.id)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {loading ? 'Inatuma...' : 'Tuma Ombi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyInvestmentsSection({ memberInvestments }: { memberInvestments: any[] }) {
  const totalInvestment = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  const totalReturns = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.actual_return || 0), 0);
  const returnRate = totalInvestment > 0 ? ((totalReturns / totalInvestment) * 100).toFixed(1) : '0';

  const summaryCards = [
    { label: 'Jumla ya Uwekezaji', value: `TSh ${totalInvestment.toLocaleString()}`, accent: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Faida Halisi', value: `TSh ${totalReturns.toLocaleString()}`, accent: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Kiwango cha Faida', value: `${returnRate}%`, accent: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map((c, i) => (
          <div key={i} className="rounded-xl bg-[#1a1a1a] border border-white/5 p-4">
            <p className="text-xs text-white/40 mb-1">{c.label}</p>
            <p className={`text-lg font-semibold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {memberInvestments.length > 0 ? (
        <div className="rounded-xl bg-[#1a1a1a] border border-white/5 overflow-hidden">
          {memberInvestments.map((inv, i) => (
            <div key={i} className="p-5 border-b border-white/5 last:border-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{inv.group_name}</h3>
                  <p className="text-xs text-white/30 mt-0.5">
                    {new Date(inv.investment_date).toLocaleDateString('sw-TZ')}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  inv.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'
                }`}>
                  {inv.status === 'active' ? 'Inaendelea' : 'Inasubiri'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Kiasi', value: `TSh ${parseFloat(inv.amount).toLocaleString()}` },
                  { label: 'Hisa', value: `${inv.equity_percentage}%` },
                  { label: 'Faida Inayotarajiwa', value: `TSh ${parseFloat(inv.expected_return || 0).toLocaleString()}` },
                  { label: 'Faida Halisi', value: `TSh ${parseFloat(inv.actual_return || 0).toLocaleString()}` },
                ].map((item, j) => (
                  <div key={j} className="rounded-lg bg-white/[0.03] p-2.5">
                    <p className="text-xs text-white/30 mb-0.5">{item.label}</p>
                    <p className="text-sm font-medium text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-[#1a1a1a] border border-white/5 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <CurrencyDollarIcon className="h-6 w-6 text-white/30" />
          </div>
          <p className="text-sm text-white/40">Bado huna uwekezaji wowote.</p>
        </div>
      )}
    </div>
  );
}

function LearningSection({ memberTraining, user }: { memberTraining: any[]; user: any }) {
  const [activeTab, setActiveTab] = useState<'courses' | 'certificates'>('courses');
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [trainingDetails, setTrainingDetails] = useState<any>(null);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [certsLoading, setCertsLoading] = useState(false);
  const [earnedCert, setEarnedCert] = useState<any>(null);
  const [completingCourse, setCompletingCourse] = useState(false);

  // Load certificates when tab switches
  React.useEffect(() => {
    if (activeTab === 'certificates' && user?.id) {
      setCertsLoading(true);
      fetch(`/api/training/certificates?userId=${user.id}`)
        .then(r => r.json())
        .then(d => setCertificates(d.certificates ?? []))
        .catch(() => {})
        .finally(() => setCertsLoading(false));
    }
  }, [activeTab, user?.id]);

  const closeModal = () => { setSelectedTraining(null); setTrainingDetails(null); setCurrentLesson(null); };

  const handleViewTraining = async (training: any) => {
    setLoadingId(training.id);
    try {
      const res = await fetch(`/api/admin/educational-content/${training.id}/lessons`);
      if (res.ok) {
        const lessons = await res.json();
        const completedCount = lessons.filter((l: any) => l.completed).length;
        setSelectedTraining(training);
        setTrainingDetails({ module: training, lessons, totalLessons: lessons.length, completedLessons: completedCount });
        setCurrentLesson(lessons[0] ?? null);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingId(null); }
  };

  const handleLessonComplete = async (lessonId: number, completed: boolean) => {
    try {
      const res = await fetch('/api/training/lesson-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, lessonId, completed }),
      });
      if (res.ok && trainingDetails) {
        const updated = trainingDetails.lessons.map((l: any) => l.id === lessonId ? { ...l, completed } : l);
        const completedCount = updated.filter((l: any) => l.completed).length;
        const newDetails = { ...trainingDetails, lessons: updated, completedLessons: completedCount };
        setTrainingDetails(newDetails);
        if (currentLesson?.id === lessonId) setCurrentLesson({ ...currentLesson, completed });

        // Auto-trigger course completion check when all lessons done
        if (completed && completedCount === newDetails.totalLessons && newDetails.totalLessons > 0) {
          handleCompleteCourse(selectedTraining.id);
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleCompleteCourse = async (courseId: number) => {
    if (!user?.id || completingCourse) return;
    setCompletingCourse(true);
    try {
      const res = await fetch('/api/training/complete-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, courseId }),
      });
      const json = await res.json();
      if (res.ok && json.certificate) {
        setEarnedCert(json.certificate);
      }
    } catch (e) { console.error(e); }
    finally { setCompletingCourse(false); }
  };

  const handleStartTraining = async (trainingId: number) => {
    try {
      await fetch('/api/members/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, trainingId, action: 'start' }),
      });
    } catch (e) { console.error(e); }
  };

  const statusBadge = (status: string) => {
    if (status === 'completed') return 'bg-emerald-500/15 text-emerald-400';
    if (status === 'in_progress') return 'bg-blue-500/15 text-blue-400';
    return 'bg-white/5 text-white/30';
  };
  const statusLabel = (status: string) => {
    if (status === 'completed') return 'Imekamilika';
    if (status === 'in_progress') return 'Inaendelea';
    return 'Haijanza';
  };

  const currentIndex = trainingDetails?.lessons.findIndex((l: any) => l.id === currentLesson?.id) ?? -1;
  const completionPct = trainingDetails
    ? Math.round((trainingDetails.completedLessons / Math.max(trainingDetails.totalLessons, 1)) * 100)
    : 0;

  return (
    <>
      {/* ── Tab bar ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-fit mb-4">
        {([
          { id: 'courses' as const, label: 'Kozi' },
          { id: 'certificates' as const, label: 'Vyeti Vyangu' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Courses tab ── */}
      {activeTab === 'courses' && (
        <div className="space-y-3">
          {memberTraining.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {memberTraining.map((t, i) => (
                <div key={i} className="rounded-2xl bg-[#141414] border border-white/[0.06] p-5 flex flex-col hover:border-white/10 transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <BookOpenIcon className="h-4 w-4 text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white leading-snug">{t.title}</h3>
                        {t.certificates_enabled && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400 mt-0.5">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                            Inatoa Cheti
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge(t.progress_status)}`}>
                      {statusLabel(t.progress_status)}
                    </span>
                  </div>

                  {t.description && (
                    <p className="text-xs text-white/35 mb-3 leading-relaxed line-clamp-2 pl-12">{t.description}</p>
                  )}

                  <div className="flex gap-3 text-[10px] text-white/20 mb-4 pl-12">
                    {t.category && <span>{t.category}</span>}
                    {t.level && <><span>·</span><span>{t.level}</span></>}
                    {t.duration_hours && <><span>·</span><span>{t.duration_hours}h</span></>}
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => { handleViewTraining(t); if (t.progress_status === 'not_started') handleStartTraining(t.id); }}
                      disabled={loadingId === t.id}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 disabled:opacity-40 transition-colors"
                    >
                      {loadingId === t.id ? 'Inapakia...' : t.progress_status === 'not_started' ? 'Anza Kujifunza' : 'Endelea Kusoma'}
                    </button>
                    {t.progress_status === 'completed' && (
                      <div className="px-3 py-2 rounded-xl text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-[#141414] border border-white/[0.06] p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <BookOpenIcon className="h-6 w-6 text-white/15" />
              </div>
              <p className="text-sm font-medium text-white/25">Hakuna mafunzo yanayopatikana</p>
              <p className="text-xs text-white/15 mt-1">Mafunzo mapya yataongezwa hivi karibuni</p>
            </div>
          )}
        </div>
      )}

      {/* ── Certificates tab ── */}
      {activeTab === 'certificates' && (
        <div className="space-y-3">
          {certsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
            </div>
          ) : certificates.length === 0 ? (
            <div className="rounded-2xl bg-[#141414] border border-white/[0.06] p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/5 border border-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-500/30" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              </div>
              <p className="text-sm font-medium text-white/25">Bado huna vyeti</p>
              <p className="text-xs text-white/15 mt-1">Kamilisha kozi zinazotoa vyeti ili kupata cheti lako la kwanza</p>
              <button
                onClick={() => setActiveTab('courses')}
                className="mt-4 px-4 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-semibold border border-orange-500/20 transition-colors"
              >
                Angalia Kozi →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {certificates.map((cert: any) => (
                <div key={cert.id} className="rounded-2xl bg-gradient-to-br from-[#1a1600] to-[#141414] border border-yellow-500/20 p-5 relative overflow-hidden">
                  {/* Decorative star */}
                  <div className="absolute top-3 right-3 opacity-10">
                    <svg className="w-16 h-16 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/15 border border-yellow-500/25 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    </div>
                    <p className="text-[10px] font-semibold text-yellow-500/70 uppercase tracking-wider">Cheti cha Kukamilisha</p>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">{cert.course_title}</h3>
                  <p className="text-xs text-white/40 mb-3">{cert.member_name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {cert.category && <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/30">{cert.category}</span>}
                    {cert.difficulty_level && <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/30">{cert.difficulty_level}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-yellow-500/10">
                    <p className="text-[10px] text-white/25">
                      {new Date(cert.issued_at).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    <button
                      onClick={() => setEarnedCert(cert)}
                      className="text-[10px] text-yellow-400 hover:text-yellow-300 font-semibold transition-colors"
                    >
                      Angalia Cheti →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Training course modal ── */}
      {selectedTraining && trainingDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-6">
          <div className="w-full max-w-4xl rounded-2xl bg-[#111] border border-white/10 flex flex-col max-h-[92vh] overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-white truncate">{selectedTraining.title}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 max-w-40 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-1.5 rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${completionPct}%` }} />
                  </div>
                  <span className="text-[10px] text-white/30 shrink-0">
                    {trainingDetails.completedLessons}/{trainingDetails.totalLessons} · {completionPct}%
                  </span>
                  {selectedTraining.certificates_enabled && (
                    <span className="hidden sm:flex items-center gap-1 text-[10px] text-yellow-400">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                      Inatoa Cheti
                    </span>
                  )}
                </div>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Left: lesson list */}
              <div className="w-56 shrink-0 border-r border-white/[0.06] overflow-y-auto p-3 hidden sm:block">
                <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider px-2 mb-2">Masomo</p>
                <div className="space-y-0.5">
                  {trainingDetails.lessons.map((lesson: any, idx: number) => (
                    <button key={lesson.id} onClick={() => setCurrentLesson(lesson)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${currentLesson?.id === lesson.id ? 'bg-orange-500/15 border border-orange-500/20' : 'hover:bg-white/[0.04] border border-transparent'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${lesson.completed ? 'bg-emerald-500/15 text-emerald-400' : currentLesson?.id === lesson.id ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-white/30'}`}>
                          {lesson.completed ? '✓' : idx + 1}
                        </span>
                        <span className={`text-xs truncate ${currentLesson?.id === lesson.id ? 'text-orange-300 font-medium' : 'text-white/50'}`}>{lesson.title}</span>
                      </div>
                      <p className="text-[10px] text-white/20 mt-0.5 pl-7">{lesson.duration_minutes} dak</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: lesson content */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {currentLesson ? (
                  <>
                    <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/[0.06] shrink-0">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{currentLesson.title}</h3>
                        <p className="text-[10px] text-white/25 mt-0.5">{currentLesson.duration_minutes} dakika</p>
                      </div>
                      <button
                        onClick={() => handleLessonComplete(currentLesson.id, !currentLesson.completed)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${currentLesson.completed ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
                      >
                        {currentLesson.completed ? '✓ Imekamilika' : 'Kamilisha Somo'}
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-5">
                      <div
                        className="text-sm text-white/65 leading-7 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: currentLesson.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                            .replace(/^# (.+)$/gm, '<h1 class="text-base font-bold text-white mt-5 mb-2">$1</h1>')
                            .replace(/^## (.+)$/gm, '<h2 class="text-sm font-semibold text-white/80 mt-4 mb-1.5">$1</h2>')
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] shrink-0">
                      <button
                        onClick={() => currentIndex > 0 && setCurrentLesson(trainingDetails.lessons[currentIndex - 1])}
                        disabled={currentIndex <= 0}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs border border-white/10 text-white/40 hover:text-white hover:border-white/20 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                      >
                        ← Iliyotangulia
                      </button>
                      <p className="sm:hidden text-[10px] text-white/25">{currentIndex + 1} / {trainingDetails.lessons.length}</p>
                      <button
                        onClick={() => {
                          if (currentIndex < trainingDetails.lessons.length - 1) {
                            setCurrentLesson(trainingDetails.lessons[currentIndex + 1]);
                          } else {
                            handleCompleteCourse(selectedTraining.id);
                            closeModal();
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs transition-colors ${
                          currentIndex === trainingDetails.lessons.length - 1
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white font-semibold'
                            : 'bg-orange-500 hover:bg-orange-600 text-white'
                        }`}
                      >
                        {currentIndex < trainingDetails.lessons.length - 1 ? 'Lijalo →' : completingCourse ? 'Inakamilisha...' : 'Maliza Kozi ✓'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
                    <BookOpenIcon className="h-10 w-10 text-white/10" />
                    <p className="text-sm text-white/25">Chagua somo kutoka orodha kushoto</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Certificate earned modal ── */}
      {earnedCert && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="w-full max-w-md">
            {/* Confetti dots decoration */}
            <div className="flex justify-center mb-6 gap-2">
              {['bg-yellow-400','bg-orange-400','bg-emerald-400','bg-blue-400','bg-purple-400'].map((c,i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${c} opacity-70 animate-bounce`} style={{ animationDelay: `${i*0.1}s` }} />
              ))}
            </div>

            {/* Certificate card */}
            <div className="rounded-2xl bg-gradient-to-br from-[#1c1800] via-[#1a1a1a] to-[#141414] border border-yellow-500/30 p-8 text-center relative overflow-hidden shadow-2xl shadow-yellow-500/10">
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'radial-gradient(circle at 25% 25%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 75% 75%, #f59e0b 0%, transparent 50%)'}} />

              <div className="relative">
                {/* Badge */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-yellow-500/30">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                </div>

                <p className="text-xs font-bold text-yellow-400/70 uppercase tracking-[0.2em] mb-2">Cheti cha Kukamilisha</p>
                <p className="text-white/50 text-xs mb-1">Hii inathibitisha kwamba</p>
                <h2 className="text-xl font-bold text-white mb-1">{earnedCert.member_name}</h2>
                <p className="text-white/40 text-xs mb-4">amekamilisha kozi ya</p>
                <h3 className="text-base font-semibold text-yellow-300 mb-5">{earnedCert.course_title}</h3>

                <div className="flex items-center justify-center gap-1.5 mb-5">
                  <div className="h-px flex-1 bg-yellow-500/20" />
                  <p className="text-[10px] text-white/25 px-2">
                    {new Date(earnedCert.issued_at).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  <div className="h-px flex-1 bg-yellow-500/20" />
                </div>

                <p className="text-[10px] text-white/20 mb-6 font-mono">ID: {earnedCert.credential_id}</p>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setEarnedCert(null); setActiveTab('certificates'); }}
                    className="flex-1 py-2.5 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-sm font-semibold border border-yellow-500/20 transition-colors"
                  >
                    Vyeti Vyangu
                  </button>
                  <button
                    onClick={() => setEarnedCert(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 text-sm transition-colors"
                  >
                    Funga
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MemberSettingsSection({ onNavigate, user, memberProfile, loadMemberData }: {
  onNavigate: (section: string) => void;
  user: any;
  memberProfile: any;
  loadMemberData: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Profile card */}
      <button
        onClick={() => onNavigate('profile')}
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#1a1a1a] border border-white/[0.06] hover:border-orange-500/30 hover:bg-[#1f1f1f] transition-all text-left"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
          <span className="text-lg font-bold text-white">
            {(memberProfile?.full_name || user?.fullName || user?.email || 'U')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{memberProfile?.full_name || user?.fullName || 'Mwanachama'}</p>
          <p className="text-xs text-white/40 truncate">{memberProfile?.email || user?.email}</p>
        </div>
        <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Settings menu items */}
      <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] divide-y divide-white/[0.04]">
        {[
          { label: 'Taarifa za Akaunti', desc: 'Jina, nambari ya simu, barua pepe', icon: UserIcon },
          { label: 'Usalama', desc: 'Nywila na uthibitishaji', icon: CogIcon },
          { label: 'Arifa', desc: 'Mipangilio ya arifa', icon: DocumentTextIcon },
          { label: 'Lugha', desc: 'Kiswahili / English', icon: BookOpenIcon },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 px-4 py-3.5 opacity-50">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
              <item.icon className="h-4 w-4 text-white/50" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/70">{item.label}</p>
              <p className="text-xs text-white/30">{item.desc}</p>
            </div>
            <span className="text-[10px] text-white/20 bg-white/5 px-2 py-0.5 rounded-full">Hivi karibuni</span>
          </div>
        ))}
      </div>
    </div>
  );
}
