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
import Logo from '@/components/Logo';

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
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check authentication and load member data
  useEffect(() => {
    setMounted(true);
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

  if (!mounted || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
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
        return <WalletDashboard userId={user?.id || 0} username={memberProfile?.username} />;
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

  const initials = (user.fullName || user.email || 'U')[0].toUpperCase();

  return (
    <div className="relative min-h-[100dvh] bg-[#0b0a09] text-white flex overflow-hidden">

      {/* ── Ambient warm gradient backdrop ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-48 -left-40 h-[28rem] w-[28rem] rounded-full bg-[#d1622b]/25 blur-[130px]" />
        <div className="absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-[#e4a233]/15 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-[#7c3f14]/20 blur-[130px]" />
      </div>

      {/* ── Mobile drawer overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed top-0 left-0 h-[100dvh] w-64 z-50 flex flex-col
        bg-[#100d0b]/95 backdrop-blur-xl border-r border-white/[0.06]
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-20 lg:flex lg:shrink-0
      `}>
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo markOnly className="h-9 w-auto shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-none">Washika<span className="text-[#e4a233]">DAU</span></p>
              <p className="text-[10px] text-white/40 truncate mt-1">{user.fullName || user.email}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/40 hover:text-white">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-none">
          {menuItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setSidebarOpen(false); }}
                className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-[#d1622b] to-[#e4a233] text-white font-semibold shadow-lg shadow-[#d1622b]/25'
                    : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/45 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">

        {/* Sticky branded top header — visible throughout */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 lg:px-8 h-16 border-b border-white/[0.06] bg-[#0b0a09]/70 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile: menu + logo */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/70 hover:text-white -ml-1 p-1">
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <Logo markOnly className="h-7 w-auto" />
              <span className="text-sm font-bold">Washika<span className="text-[#e4a233]">DAU</span></span>
            </div>
            {/* Desktop: page title */}
            <h1 className="hidden lg:block text-lg font-semibold text-white">{activeName}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-300">nTZS live</span>
            </div>
            <button onClick={() => setActiveSection('settings')} className="h-9 w-9 rounded-full bg-gradient-to-br from-[#d1622b] to-[#e4a233] flex items-center justify-center ring-2 ring-white/10 hover:ring-[#e4a233]/40 transition-all">
              <span className="text-xs font-bold text-white">{initials}</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-5 lg:py-7 pb-28 lg:pb-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#e4a233] border-t-transparent" />
            </div>
          ) : (
            renderContent()
          )}
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#100d0b]/90 backdrop-blur-xl border-t border-white/[0.07]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-end justify-around px-1 h-16">
          {[
            { id: 'overview', label: 'Nyumbani', icon: ChartBarIcon },
            { id: 'wallet', label: 'Pochi', icon: WalletIcon },
          ].map((t) => {
            const active = activeSection === t.id;
            return (
              <button key={t.id} onClick={() => setActiveSection(t.id)} className="flex flex-col items-center gap-0.5 px-4 py-2 transition-colors">
                <t.icon className={`h-5 w-5 transition-colors ${active ? 'text-[#e4a233]' : 'text-white/35'}`} />
                <span className={`text-[10px] font-medium ${active ? 'text-[#e4a233]' : 'text-white/35'}`}>{t.label}</span>
              </button>
            );
          })}

          {/* Groups — elevated centre tab */}
          <button onClick={() => setActiveSection('group')} className="flex flex-col items-center gap-1 -mt-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              activeSection === 'group'
                ? 'bg-gradient-to-br from-[#d1622b] to-[#e4a233] shadow-xl shadow-[#d1622b]/40 scale-105'
                : 'bg-[#1e1a16] border border-[#e4a233]/25 shadow-lg shadow-[#d1622b]/10'
            }`}>
              <UserGroupIcon className={`h-6 w-6 ${activeSection === 'group' ? 'text-white' : 'text-white/55'}`} />
            </div>
            <span className={`text-[10px] font-medium ${activeSection === 'group' ? 'text-[#e4a233]' : 'text-white/35'}`}>Kundi</span>
          </button>

          {[
            { id: 'learning', label: 'Mafunzo', icon: AcademicCapIcon },
            { id: 'settings', label: 'Zaidi', icon: CogIcon, extra: 'profile' },
          ].map((t) => {
            const active = activeSection === t.id || activeSection === (t as { extra?: string }).extra;
            return (
              <button key={t.id} onClick={() => setActiveSection(t.id)} className="flex flex-col items-center gap-0.5 px-4 py-2 transition-colors">
                <t.icon className={`h-5 w-5 transition-colors ${active ? 'text-[#e4a233]' : 'text-white/35'}`} />
                <span className={`text-[10px] font-medium ${active ? 'text-[#e4a233]' : 'text-white/35'}`}>{t.label}</span>
              </button>
            );
          })}
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
    { name: 'Hali ya Uanachama', value: isActive ? 'Hai' : 'Inasubiri', icon: UserIcon, from: isActive ? 'from-emerald-400' : 'from-yellow-400', to: isActive ? 'to-teal-500' : 'to-amber-500' },
    { name: 'Kundi Langu', value: memberProfile?.group_name || 'Hujajiunga', icon: UserGroupIcon, from: 'from-sky-400', to: 'to-blue-600' },
    { name: 'Uwekezaji Wangu', value: `TSh ${totalInvestment.toLocaleString()}`, icon: CurrencyDollarIcon, from: 'from-[#e4a233]', to: 'to-[#d1622b]' },
    { name: 'Faida Inayotarajiwa', value: `TSh ${expectedReturns.toLocaleString()}`, icon: ChartBarIcon, from: 'from-fuchsia-400', to: 'to-purple-600' },
  ];

  const displayActivities = recentActivities.length > 0
    ? recentActivities.map(a => ({ action: a.action_text, time: new Date(a.activity_date).toLocaleDateString('sw-TZ') }))
    : [{ action: 'Umejiunga na Washika DAU', time: memberProfile?.created_at ? new Date(memberProfile.created_at).toLocaleDateString('sw-TZ') : 'Leo' }];

  const actions = [
    { label: 'Weka Pesa', icon: 'M12 4v16m8-8H4', section: 'wallet' },
    { label: 'Toa Pesa', icon: 'M20 12H4m8 8l-8-8 8-8', section: 'wallet' },
    { label: 'Hamisha', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', section: 'wallet' },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Greeting */}
      <div>
        <h2 className="font-display text-3xl text-white">
          Habari, {memberProfile?.full_name?.split(' ')[0] || 'Mwanachama'} 👋
        </h2>
        <p className="text-sm text-white/45 mt-1">Hapa kuna muhtasari wa akaunti yako</p>
      </div>

      {/* ── Balance hero card ── */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-[#d1622b] via-[#c25a24] to-[#7c3f14] shadow-2xl shadow-[#d1622b]/30">
        {/* decorative hexagon watermark */}
        <div aria-hidden className="absolute -right-8 -top-10 opacity-[0.12]">
          <Logo markOnly className="h-52 w-52" />
        </div>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-white/70">Salio Lako</p>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span className="text-[10px] font-semibold text-white">nTZS</span>
            </div>
          </div>

          {balanceLoading ? (
            <div className="h-11 w-52 rounded-lg bg-white/20 animate-pulse mt-3" />
          ) : (
            <p className="mt-2 font-display text-4xl sm:text-5xl font-semibold text-white tracking-tight">
              <span className="text-2xl sm:text-3xl align-top text-white/70 mr-1">TSh</span>
              {(balanceTzs ?? 0).toLocaleString()}
            </p>
          )}

          {/* Quick actions */}
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={() => onNavigate(a.section)}
                className="group flex flex-col items-center gap-2 rounded-2xl bg-white/12 hover:bg-white/20 backdrop-blur-sm border border-white/15 py-3 transition-all hover:-translate-y-0.5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-[#c25a24] group-hover:scale-110 transition-transform">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d={a.icon} /></svg>
                </span>
                <span className="text-xs font-semibold text-white">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="group rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] p-4 flex flex-col gap-3 transition-all hover:-translate-y-1 hover:border-white/15">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.from} ${s.to} flex items-center justify-center shadow-lg`}>
              <s.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] text-white/45 mb-0.5">{s.name}</p>
              <p className="text-sm font-bold text-white leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Governance teaser */}
      <button
        onClick={() => onNavigate('group')}
        className="w-full text-left relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-[#1a1512] to-[#14100d] border border-[#e4a233]/20 hover:border-[#e4a233]/40 transition-all group"
      >
        <div aria-hidden className="absolute -right-6 -bottom-8 h-32 w-32 rounded-full bg-[#e4a233]/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e4a233] to-[#d1622b] shadow-lg">
            <DocumentTextIcon className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Maamuzi ya Kikundi</p>
            <p className="text-xs text-white/50 mt-0.5">Shiriki katika kupiga kura na maazimio ya kundi lako</p>
          </div>
          <span className="text-[#e4a233] group-hover:translate-x-1 transition-transform text-lg">→</span>
        </div>
      </button>

      {/* Activity + nav shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent activity — timeline */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-[#e4a233] to-[#d1622b]" />
            Shughuli za Hivi Karibuni
          </h3>
          <div className="relative space-y-4 pl-4 before:absolute before:left-[3px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
            {displayActivities.slice(0, 5).map((a, i) => (
              <div key={i} className="relative">
                <span className="absolute -left-4 top-1 w-2 h-2 rounded-full bg-[#e4a233] ring-4 ring-[#e4a233]/15" />
                <p className="text-sm text-white/85 leading-snug">{a.action}</p>
                <p className="text-xs text-white/30 mt-0.5">{a.time}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Nav shortcuts */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-[#e4a233] to-[#d1622b]" />
            Nenda Haraka
          </h3>
          <div className="space-y-1.5">
            {[
              { label: 'Wallet Yangu', sub: 'Historia na mabadiliko ya salio', icon: WalletIcon, section: 'wallet' },
              { label: 'Kundi Langu', sub: 'Angalia wanachama na shughuli', icon: UserGroupIcon, section: 'group' },
              { label: 'Mafunzo', sub: 'Endelea na masomo', icon: AcademicCapIcon, section: 'learning' },
              { label: 'Uwekezaji', sub: 'Fuatilia mapato yako', icon: CurrencyDollarIcon, section: 'investments' },
            ].map((item) => (
              <button
                key={item.section}
                onClick={() => onNavigate(item.section)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors text-left group"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] group-hover:bg-[#e4a233]/15 transition-colors shrink-0">
                  <item.icon className="h-4.5 w-4.5 text-white/50 group-hover:text-[#e4a233] transition-colors" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white/80 group-hover:text-white transition-colors">{item.label}</p>
                  <p className="text-xs text-white/30">{item.sub}</p>
                </div>
                <span className="ml-auto text-white/20 group-hover:text-[#e4a233] transition-colors">→</span>
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
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-[#e4a233]/60'
      : 'bg-white/[0.03] border-white/[0.07] text-white/50 cursor-default'
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
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-5 flex items-center gap-4">
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
              ? 'bg-[#d1622b] hover:bg-[#b9531f] text-white'
              : 'bg-white/5 hover:bg-white/10 text-white/70'
          }`}
        >
          {saving ? 'Inahifadhi...' : isEditing ? 'Hifadhi' : 'Hariri'}
        </button>
      </div>

      {/* Personal info */}
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-5">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Taarifa Binafsi</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Jina Kamili" value={formData.fullName} field="fullName" />
          <Field label="Barua Pepe" value={memberProfile?.email || user?.email || ''} disabled />
          <Field label="Nambari ya Simu" type="tel" value={formData.phone} field="phone" />
          <Field label="Mahali Unapoishi" value={formData.location} field="location" />
        </div>
      </div>

      {/* Business info */}
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-5">
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
            className="px-4 py-2 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium disabled:opacity-50 transition-colors"
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
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', monthlyContribution: '', votingNumerator: '3', votingDenominator: '5' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Join by code state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLookupResult, setJoinLookupResult] = useState<any>(null);
  const [joinLookupError, setJoinLookupError] = useState('');
  const [joinLookupLoading, setJoinLookupLoading] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      loadMyGroups();
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

  const loadJoinRequests = async () => {
    try {
      const res = await fetch('/api/member/join-requests');
      if (res.ok) { const d = await res.json(); setJoinRequests(d.requests || []); }
      else if (res.status === 401) router.push('/login');
    } catch (e) { console.error(e); }
  };

  const handleLookupCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoinLookupLoading(true);
    setJoinLookupError('');
    setJoinLookupResult(null);
    setJoinFeedback(null);
    try {
      const res = await fetch(`/api/groups/lookup?code=${encodeURIComponent(code)}`);
      const d = await res.json();
      if (res.ok) { setJoinLookupResult(d.group); }
      else { setJoinLookupError(d.error || 'Nambari hiyo haijapatikana.'); }
    } catch { setJoinLookupError('Hitilafu imetokea. Jaribu tena.'); }
    finally { setJoinLookupLoading(false); }
  };

  const handleJoinByCode = async () => {
    if (!joinLookupResult) return;
    setJoinLoading(true);
    setJoinFeedback(null);
    try {
      const res = await fetch('/api/member/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupCode: joinCode.trim().toUpperCase(), message: joinMessage }),
      });
      const d = await res.json();
      if (res.ok) {
        setJoinFeedback({ ok: true, msg: d.message });
        await Promise.all([loadMyGroups(), loadJoinRequests()]);
        if (d.joined && d.groupId) {
          setTimeout(() => { setShowJoinModal(false); router.push(`/member-dashboard/groups/${d.groupId}`); }, 1200);
        }
      } else {
        setJoinFeedback({ ok: false, msg: d.error || 'Imeshindikana kujiunga.' });
      }
    } catch { setJoinFeedback({ ok: false, msg: 'Hitilafu imetokea. Jaribu tena.' }); }
    finally { setJoinLoading(false); }
  };

  const resetJoinModal = () => {
    setShowJoinModal(false);
    setJoinCode('');
    setJoinLookupResult(null);
    setJoinLookupError('');
    setJoinMessage('');
    setJoinFeedback(null);
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-xs font-medium transition-colors"
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
                className="rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-orange-500/30 p-5 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-white truncate">{g.name}</h3>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-xs bg-[#e4a233]/10 text-[#e4a233]">
                        {g.member_role || 'mwanachama'}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">
                      Hali: {g.membership_status || g.status || 'active'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#e4a233]">
                      TSh {parseInt(g.monthly_contribution || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">kwa mwezi</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/[0.07] flex items-center justify-between">
                  <p className="text-xs text-white/30">Gusa kuangalia kundi →</p>
                  <div className="flex items-center gap-1.5">
                    <UserGroupIcon className="h-3.5 w-3.5 text-white/30" />
                    <span className="text-xs text-white/30 group-hover:text-[#e4a233] transition-colors">Angalia →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowJoinModal(true)}
            className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:border-orange-500/30 transition-all"
          >
            + Jiunge na Kundi Jingine
          </button>
        </>
      ) : (
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <UserGroupIcon className="h-6 w-6 text-white/30" />
          </div>
          <p className="text-white/50 mb-1 text-sm">Bado hujajiunga na kundi lolote.</p>
          <p className="text-xs text-white/25 mb-5">Pata nambari ya kundi (mfano: JKM-A3F9K2) kutoka kwa kiongozi.</p>
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-5 py-2 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium transition-colors"
          >
            Jiunge na Kundi
          </button>
        </div>
      )}

      {/* Pending join requests */}
      {joinRequests.length > 0 && (
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Maombi Yangu</h3>
          <div className="space-y-2">
            {joinRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-white/[0.07] last:border-0">
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

      {/* Create Group modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-white mb-1">Unda Kundi Jipya</h3>
            <p className="text-xs text-white/40 mb-5">Utakuwa kiongozi wa kundi hili moja kwa moja.</p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1">Jina la Kundi *</label>
                <input
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Mfano: Vikundi vya Maendeleo"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#e4a233]/60"
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
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#e4a233]/60"
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
                    className="w-20 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white text-center focus:outline-none focus:border-[#e4a233]/60"
                  />
                  <span className="text-white/30 text-sm">kati ya</span>
                  <input
                    type="number"
                    value={createForm.votingDenominator}
                    onChange={e => setCreateForm(f => ({ ...f, votingDenominator: e.target.value }))}
                    min="1"
                    className="w-20 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white text-center focus:outline-none focus:border-[#e4a233]/60"
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
                  className="flex-1 py-2.5 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {createLoading ? 'Inaunda...' : 'Unda Kundi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join by Code modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-white">Jiunge na Kundi</h3>
              <button onClick={resetJoinModal} className="text-white/30 hover:text-white/70 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-white/30 mb-5">Ingiza nambari ya kundi uliyopewa na kiongozi.</p>

            {/* Code input + search */}
            <div className="flex gap-2 mb-4">
              <input
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinLookupResult(null); setJoinLookupError(''); setJoinFeedback(null); }}
                onKeyDown={e => { if (e.key === 'Enter') handleLookupCode(); }}
                placeholder="Mfano: JKM-A3F9K2"
                maxLength={12}
                className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-[#e4a233]/60 uppercase tracking-wider"
              />
              <button
                onClick={handleLookupCode}
                disabled={joinLookupLoading || !joinCode.trim()}
                className="px-4 py-2.5 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
              >
                {joinLookupLoading ? '...' : 'Tafuta'}
              </button>
            </div>

            {/* Lookup error */}
            {joinLookupError && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{joinLookupError}</div>
            )}

            {/* Group preview */}
            {joinLookupResult && !joinFeedback && (
              <div className="mb-4 rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{joinLookupResult.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">Kiongozi: {joinLookupResult.leader_name || 'Hajapewa'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#e4a233]">TSh {parseInt(joinLookupResult.monthly_contribution || 0).toLocaleString()}</p>
                    <p className="text-xs text-white/30">kwa mwezi</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/30 pt-1 border-t border-white/[0.07]">
                  <span>{joinLookupResult.member_count} wanachama</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className={joinLookupResult.join_policy === 'open' ? 'text-emerald-400' : 'text-yellow-400'}>
                    {joinLookupResult.join_policy === 'open' ? 'Wazi — utajiunga moja kwa moja' : 'Inahitaji idhini ya kiongozi'}
                  </span>
                </div>

                {joinLookupResult.join_policy !== 'open' && (
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Ujumbe kwa kiongozi (si lazima)</label>
                    <textarea
                      value={joinMessage}
                      onChange={e => setJoinMessage(e.target.value)}
                      placeholder="Eleza kwa nini ungependa kujiunga..."
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#e4a233]/60 resize-none"
                      rows={2}
                    />
                  </div>
                )}

                <button
                  onClick={handleJoinByCode}
                  disabled={joinLoading}
                  className="w-full py-2.5 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {joinLoading ? 'Inajiunga...' : joinLookupResult.join_policy === 'open' ? 'Jiunga Sasa' : 'Tuma Ombi'}
                </button>
              </div>
            )}

            {/* Success / error feedback */}
            {joinFeedback && (
              <div className={`px-3 py-3 rounded-lg text-sm text-center ${joinFeedback.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                {joinFeedback.msg}
              </div>
            )}
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
    { label: 'Kiwango cha Faida', value: `${returnRate}%`, accent: 'text-[#e4a233]', bg: 'bg-[#e4a233]/10' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map((c, i) => (
          <div key={i} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4">
            <p className="text-xs text-white/40 mb-1">{c.label}</p>
            <p className={`text-lg font-semibold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {memberInvestments.length > 0 ? (
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] overflow-hidden">
          {memberInvestments.map((inv, i) => (
            <div key={i} className="p-5 border-b border-white/[0.07] last:border-0">
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
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-12 text-center">
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
  const router = useRouter();
  const [coursesInProgress, setCoursesInProgress] = useState(0);
  const [certificatesCount, setCertificatesCount] = useState(0);

  React.useEffect(() => {
    // Count courses in progress
    const inProgress = memberTraining.filter((t: any) => t.progress_status === 'in_progress').length;
    setCoursesInProgress(inProgress);

    // Fetch certificate count
    if (user?.id) {
      fetch('/api/education/certificates')
        .then(r => r.ok ? r.json() : [])
        .then(d => {
          const certs = Array.isArray(d) ? d : d.certificates ?? [];
          setCertificatesCount(certs.length);
        })
        .catch(() => {});
    }
  }, [memberTraining, user?.id]);

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-2xl bg-[#141414] border border-white/[0.06] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#e4a233]/10 border border-[#e4a233]/20 flex items-center justify-center">
            <BookOpenIcon className="h-5 w-5 text-[#e4a233]" />
          </div>
          <h3 className="text-base font-bold text-white">Masomo</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Kozi Zinaendelea</p>
            <p className="text-2xl font-bold text-[#e4a233]">{coursesInProgress}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Vyeti Vilivyopatikana</p>
            <p className="text-2xl font-bold text-emerald-400">{certificatesCount}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/jifunze')}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[#d1622b] hover:bg-[#b9531f] text-white transition-colors"
          >
            Endelea Kujifunza
          </button>
          <button
            onClick={() => router.push('/jifunze/vyeti')}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-colors"
          >
            Vyeti Vyangu
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberSettingsSection({ onNavigate, user, memberProfile, loadMemberData }: {
  onNavigate: (section: string) => void;
  user: any;
  memberProfile: any;
  loadMemberData: () => void;
}) {
  const [username, setUsername] = useState(memberProfile?.username || '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (memberProfile?.username) setUsername(memberProfile.username);
  }, [memberProfile]);

  const checkUsername = async (val: string) => {
    if (!val || val.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const res = await fetch(`/api/member/username?check=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (res.ok && data.available) {
        setUsernameStatus('available');
        setUsernameError('');
      } else {
        setUsernameStatus('taken');
        setUsernameError(data.error || 'Username taken');
      }
    } catch {
      setUsernameStatus('invalid');
      setUsernameError('Error checking username');
    }
  };

  const handleUsernameChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    setSaveSuccess(false);
    if (cleaned !== memberProfile?.username) {
      checkUsername(cleaned);
    } else {
      setUsernameStatus('idle');
    }
  };

  const saveUsername = async () => {
    if (!username || username === memberProfile?.username) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/member/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveSuccess(true);
        setUsernameStatus('idle');
        loadMemberData();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setUsernameError(data.error || 'Failed to save');
        setUsernameStatus('invalid');
      }
    } catch {
      setUsernameError('Network error');
      setUsernameStatus('invalid');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <button
        onClick={() => onNavigate('profile')}
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:border-orange-500/30 hover:bg-[#1f1f1f] transition-all text-left"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
          <span className="text-lg font-bold text-white">
            {(memberProfile?.full_name || user?.fullName || user?.email || 'U')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{memberProfile?.full_name || user?.fullName || 'Mwanachama'}</p>
          <p className="text-xs text-white/40 truncate">{memberProfile?.username ? `@${memberProfile.username}` : memberProfile?.email || user?.email}</p>
        </div>
        <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Username section */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Username ya Uhamisho Pesa</h3>
        <p className="text-xs text-white/40 mb-4">
          {memberProfile?.username 
            ? 'Wenzako wanaweza kukutumia pesa kwa kutumia username yako'
            : 'Weka username yako ili wenzako waweze kukutumia pesa kwa urahisi'
          }
        </p>
        
        {memberProfile?.username ? (
          <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 text-lg">@</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-400">@{memberProfile.username}</p>
                <p className="text-xs text-white/40">Username yako</p>
              </div>
            </div>
            <div className="text-emerald-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="juma_ally"
                  className="w-full pl-8 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#e4a233]/60"
                  pattern="[a-z0-9_]{3,30}"
                  minLength={3}
                  maxLength={30}
                />
                {usernameStatus === 'checking' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">Inakagua...</span>}
                {usernameStatus === 'available' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400">✓ Inapatikana</span>}
                {usernameStatus === 'taken' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400">✗ Imechukuliwa</span>}
              </div>
              <p className="text-xs text-white/30 mt-1">Herufi ndogo, nambari, na _ tu (3-30 vibambo)</p>
              {usernameError && <p className="text-xs text-red-400 mt-1">{usernameError}</p>}
              {saveSuccess && <p className="text-xs text-emerald-400 mt-1">✓ Imehifadhiwa!</p>}
            </div>

            <button
              onClick={saveUsername}
              disabled={saving || usernameStatus !== 'available' || !username || username === memberProfile?.username}
              className="w-full py-2.5 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Inahifadhi...' : 'Hifadhi Username'}
            </button>
          </div>
        )}
      </div>

      {/* Settings menu items */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] divide-y divide-white/[0.04]">
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
