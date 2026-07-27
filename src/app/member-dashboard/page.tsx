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
  BellIcon,
} from '@heroicons/react/24/outline';
import WalletDashboard from '@/components/WalletDashboard';
import Logo from '@/components/Logo';
import { useTheme } from '@/contexts/ThemeContext';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import QuickActionModal, { type ActionType } from '@/components/QuickActionModal';
import NotificationsSection from '@/components/NotificationsSection';
import AvatarPicker from '@/components/AvatarPicker';
import NotificationBell from '@/components/NotificationBell';

export default function MemberDashboard() {
  const { language, toggleLanguage, t } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<{id?: number; fullName?: string; email: string; role?: string} | null>(null);
  const [memberInfo, setMemberInfo] = useState<{id?: number; fullName?: string; email?: string} | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [memberProfile, setMemberProfile] = useState<any>(null);
  const [memberInvestments, setMemberInvestments] = useState<any[]>([]);
  const [memberTraining, setMemberTraining] = useState<any[]>([]);
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
    setLoading(true);
    try {
      // Fire everything the overview needs in parallel — sequential awaits were
      // adding a round-trip per endpoint. The heavy educational-content call is
      // deferred to the Learning tab (see loadTrainingIfNeeded).
      const [profileRes, investmentsRes] = await Promise.all([
        fetch(`/api/members/profile?userId=${userId}`).catch(() => null),
        fetch(`/api/members/investments?userId=${userId}`).catch(() => null),
      ]);
      if (profileRes?.ok) setMemberProfile(await profileRes.json());
      if (investmentsRes?.ok) setMemberInvestments(await investmentsRes.json());
    } catch (error) {
      console.error('Error loading member data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTrainingIfNeeded = React.useCallback(async () => {
    if (memberTraining.length > 0) return;
    try {
      const res = await fetch(`/api/educational-content`);
      if (!res.ok) return;
      const trainingData = await res.json();
      setMemberTraining(trainingData.map((content: any) => ({
        id: content.id,
        title: content.title,
        description: content.description,
        duration_hours: parseFloat(content.duration?.replace(/[^0-9.]/g, '') || '1'),
        category: content.category,
        level: content.difficulty_level,
        progress_status: 'not_started',
        progress_percentage: 0,
        started_at: null,
        completed_at: null,
      })));
    } catch {}
  }, [memberTraining.length]);

  useEffect(() => {
    if (activeSection === 'learning') loadTrainingIfNeeded();
  }, [activeSection, loadTrainingIfNeeded]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!mounted || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const menuItems = [
    { id: 'overview', name: t('dash.nav.overview'), icon: ChartBarIcon },
    { id: 'wallet', name: t('dash.nav.wallet'), icon: WalletIcon },
    { id: 'group', name: t('dash.nav.group'), icon: UserGroupIcon },
    { id: 'investments', name: t('dash.nav.investments'), icon: CurrencyDollarIcon },
    { id: 'learning', name: t('dash.nav.training'), icon: AcademicCapIcon },
    { id: 'notifications', name: t('notif.title'), icon: BellIcon },
    { id: 'settings', name: t('dash.nav.settings'), icon: CogIcon },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <MemberOverviewSection memberProfile={memberProfile} memberInvestments={memberInvestments} onNavigate={setActiveSection} userId={user?.id || 0} />;
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
      case 'notifications':
        return <NotificationsSection userId={user?.id || 0} />;
      case 'settings':
        return <MemberSettingsSection onNavigate={setActiveSection} user={user} memberProfile={memberProfile} loadMemberData={() => loadMemberData(user?.id || 0)} />;
      default:
        return <MemberOverviewSection memberProfile={memberProfile} memberInvestments={memberInvestments} onNavigate={setActiveSection} userId={user?.id || 0} />;
    }
  };

  const activeName = menuItems.find(m => m.id === activeSection)?.name || 'Overview';

  const initials = (user.fullName || user.email || 'U')[0].toUpperCase();

  return (
    <div className="relative min-h-[100dvh] bg-background text-foreground flex overflow-hidden">

      {/* ── Ambient warm gradient backdrop ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
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
        bg-card/95 backdrop-blur-xl border-r border-border
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-20 lg:flex lg:shrink-0
      `}>
        {/* Brand */}
        <div className="px-5 py-5 border-b border-border flex items-center justify-between" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo markOnly className="h-9 w-auto shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground leading-none">Washika<span className="text-[#e4a233]">DAU</span></p>
              <p className="text-[10px] text-muted-foreground truncate mt-1">{user.fullName || user.email}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
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
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
            <span>{t('dash.logout')}</span>
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">

        {/* Sticky branded top header — visible throughout */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 lg:px-8 h-16 border-b border-border bg-background/70 backdrop-blur-xl" style={{ height: 'calc(4rem + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile: menu + logo */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground -ml-1 p-1">
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <Logo markOnly className="h-7 w-auto" />
              <span className="text-sm font-bold">Washika<span className="text-[#e4a233]">DAU</span></span>
            </div>
            {/* Desktop: page title */}
            <h1 className="hidden lg:block text-lg font-semibold text-foreground">{activeName}</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-300">nTZS live</span>
            </div>
            {/* Notification bell — dropdown, no redirect */}
            <NotificationBell />
            <button
              onClick={toggleLanguage}
              className="rounded-full border border-border bg-card hover:bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors"
            >
              {language === 'sw' ? 'EN' : 'SW'}
            </button>
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="rounded-full border border-border bg-card hover:bg-muted p-2 text-muted-foreground transition-colors"
              aria-label={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {resolvedTheme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>
            <button onClick={() => setActiveSection('settings')} className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[#d1622b] to-[#e4a233] flex items-center justify-center ring-2 ring-border hover:ring-[#e4a233]/40 transition-all">
              {memberProfile?.avatar_url ? (
                <img src={memberProfile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">{initials}</span>
              )}
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
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/90 backdrop-blur-xl border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-end justify-around px-1 h-16">
          {[
            { id: 'overview', label: t('dash.nav.overview'), icon: ChartBarIcon },
            { id: 'wallet', label: t('dash.nav.wallet'), icon: WalletIcon },
          ].map((t) => {
            const active = activeSection === t.id;
            return (
              <button key={t.id} onClick={() => setActiveSection(t.id)} className="flex flex-col items-center gap-0.5 px-4 py-2 transition-colors">
                <t.icon className={`h-5 w-5 transition-colors ${active ? 'text-[#e4a233]' : 'text-muted-foreground'}`} />
                <span className={`text-[10px] font-medium ${active ? 'text-[#e4a233]' : 'text-muted-foreground'}`}>{t.label}</span>
              </button>
            );
          })}

          {/* Groups — elevated centre tab */}
          <button onClick={() => setActiveSection('group')} className="flex flex-col items-center gap-1 -mt-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              activeSection === 'group'
                ? 'bg-gradient-to-br from-[#d1622b] to-[#e4a233] shadow-xl shadow-[#d1622b]/40 scale-105'
                : 'bg-muted border border-[#e4a233]/25 shadow-lg shadow-[#d1622b]/10'
            }`}>
              <UserGroupIcon className={`h-6 w-6 ${activeSection === 'group' ? 'text-white' : 'text-muted-foreground'}`} />
            </div>
            <span className={`text-[10px] font-medium ${activeSection === 'group' ? 'text-[#e4a233]' : 'text-muted-foreground'}`}>{t('dash.nav.group')}</span>
          </button>

          {[
            { id: 'learning', label: t('dash.nav.training'), icon: AcademicCapIcon },
            { id: 'settings', label: t('dash.nav.more'), icon: CogIcon, extra: 'profile' },
          ].map((t) => {
            const active = activeSection === t.id || activeSection === (t as { extra?: string }).extra;
            return (
              <button key={t.id} onClick={() => setActiveSection(t.id)} className="flex flex-col items-center gap-0.5 px-4 py-2 transition-colors">
                <t.icon className={`h-5 w-5 transition-colors ${active ? 'text-[#e4a233]' : 'text-muted-foreground'}`} />
                <span className={`text-[10px] font-medium ${active ? 'text-[#e4a233]' : 'text-muted-foreground'}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

type FeedItem = {
  key: string;
  kind: 'join' | 'deposit' | 'withdraw' | 'contribution' | 'received' | 'transfer' | 'proposal';
  date: string;
  title_sw: string;
  title_en: string;
  subtitle: string | null;
  href: string;
};

function MemberOverviewSection({ memberProfile, memberInvestments, onNavigate, userId }: { memberProfile: any; memberInvestments: any[]; onNavigate: (section: string) => void; userId: number }) {
  const { t, language } = useLanguage();
  const router = useRouter();

  const [balanceTzs, setBalanceTzs] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [modal, setModal] = useState<ActionType | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [myGroups, setMyGroups] = useState<Array<{ id: number; name: string; logo_url?: string | null }>>([]);

  const fetchBalance = React.useCallback(() => {
    if (!userId) return;
    fetch(`/api/wallet/balance?userId=${userId}`)
      .then(r => r.json())
      .then(d => setBalanceTzs(d.balanceTzs ?? 0))
      .catch(() => setBalanceTzs(0))
      .finally(() => setBalanceLoading(false));
  }, [userId]);

  const fetchFeed = React.useCallback(() => {
    if (!userId) return;
    fetch(`/api/members/feed?userId=${userId}&limit=8`)
      .then(r => r.json())
      .then(d => setFeed(Array.isArray(d.items) ? d.items : []))
      .catch(() => setFeed([]));
  }, [userId]);

  useEffect(() => { fetchBalance(); fetchFeed(); }, [fetchBalance, fetchFeed]);

  useEffect(() => {
    fetch('/api/member/groups')
      .then(r => r.ok ? r.json() : { groups: [] })
      .then(d => setMyGroups((d.groups || []).map((g: any) => ({ id: g.id, name: g.name, logo_url: g.logo_url ?? null }))))
      .catch(() => setMyGroups([]));
  }, []);

  const totalInvestment = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  const expectedReturns = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.expected_return || 0), 0);
  const isActive = memberProfile?.status === 'active';

  const stats = [
    { name: t('dash.stat.membership'), value: isActive ? t('dash.stat.active') : t('dash.stat.pending'), icon: UserIcon, from: isActive ? 'from-emerald-400' : 'from-yellow-400', to: isActive ? 'to-teal-500' : 'to-amber-500' },
    { name: t('dash.stat.investment'), value: `TSh ${totalInvestment.toLocaleString()}`, icon: CurrencyDollarIcon, from: 'from-[#e4a233]', to: 'to-[#d1622b]' },
    { name: t('dash.stat.returns'), value: `TSh ${expectedReturns.toLocaleString()}`, icon: ChartBarIcon, from: 'from-fuchsia-400', to: 'to-purple-600' },
  ];

  const kindIcon: Record<FeedItem['kind'], string> = {
    join: '◉', deposit: '↓', withdraw: '↑', contribution: '⇢', received: '↙', transfer: '⇄', proposal: '✎',
  };
  const kindColor: Record<FeedItem['kind'], string> = {
    join: 'bg-blue-500/15 text-blue-500',
    deposit: 'bg-emerald-500/15 text-emerald-500',
    withdraw: 'bg-amber-500/15 text-amber-500',
    contribution: 'bg-primary/15 text-primary',
    received: 'bg-emerald-500/15 text-emerald-500',
    transfer: 'bg-sky-500/15 text-sky-500',
    proposal: 'bg-violet-500/15 text-violet-500',
  };
  const displayFeed = feed.length > 0
    ? feed.map(f => ({ ...f, label: language === 'en' ? f.title_en : f.title_sw }))
    : [{
        key: 'first',
        kind: 'join' as const,
        date: memberProfile?.created_at ?? '',
        title_sw: t('dash.joined'), title_en: t('dash.joined'),
        subtitle: null, href: '',
        label: t('dash.joined'),
      }];

  const actions: { label: string; icon: string; action: ActionType }[] = [
    { label: t('dash.action.deposit'), icon: 'M12 4v16m8-8H4', action: 'deposit' },
    { label: t('dash.action.withdraw'), icon: 'M20 12H4m8 8l-8-8 8-8', action: 'withdraw' },
    { label: t('dash.action.transfer'), icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', action: 'transfer' },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {modal && (
        <QuickActionModal userId={userId} type={modal} onClose={() => setModal(null)} onSuccess={fetchBalance} />
      )}
      {/* Greeting */}
      <div>
        <h2 className="font-display text-3xl text-foreground">
          {t('dash.greeting')}, {memberProfile?.full_name?.split(' ')[0] || t('dash.member')} 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t('dash.overview.subtitle')}</p>
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
            <p className="text-xs font-medium uppercase tracking-widest text-white/70">{t('dash.balance.label')}</p>
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

          {/* Quick actions — open modal directly (no redirect) */}
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={() => setModal(a.action)}
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="group rounded-2xl bg-card hover:bg-muted border border-border p-4 flex flex-col gap-3 transition-all hover:-translate-y-1 hover:border-primary/30 shadow-sm">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.from} ${s.to} flex items-center justify-center shadow-lg`}>
              <s.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">{s.name}</p>
              <p className="text-sm font-bold text-foreground leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* My Groups — clickable list */}
      <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-sky-400 to-blue-600" />
            {t('dash.stat.mygroup')}
          </h3>
          {myGroups.length > 0 && (
            <button
              onClick={() => onNavigate('group')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {t('inv.viewAll')} →
            </button>
          )}
        </div>
        {myGroups.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('dash.stat.nogroup')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {myGroups.map(g => (
              <button
                key={g.id}
                onClick={() => router.push(`/member-dashboard/groups/${g.id}`)}
                className="flex items-center gap-3 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-muted transition-all px-3 py-2.5 text-left group"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-bold text-sm overflow-hidden">
                  {g.logo_url ? (
                    <img src={g.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    g.name.charAt(0).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{g.name}</p>
                </div>
                <span className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all">→</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Governance teaser */}
      <button
        onClick={() => onNavigate('group')}
        className="w-full text-left relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-primary/10 to-gold/10 border border-primary/20 hover:border-primary/40 transition-all group"
      >
        <div aria-hidden className="absolute -right-6 -bottom-8 h-32 w-32 rounded-full bg-gold/15 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e4a233] to-[#d1622b] shadow-lg">
            <DocumentTextIcon className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">{t('dash.governance.title')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('dash.governance.sub')}</p>
          </div>
          <span className="text-primary group-hover:translate-x-1 transition-transform text-lg">→</span>
        </div>
      </button>

      {/* Activity + nav shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent activity — clickable feed */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-[#e4a233] to-[#d1622b]" />
            {t('dash.activity.title')}
          </h3>
          <div className="space-y-1.5">
            {displayFeed.slice(0, 6).map((f) => {
              const clickable = !!f.href;
              const content = (
                <>
                  <span className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${kindColor[f.kind]} font-bold text-sm`}>
                    {kindIcon[f.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground/90 leading-snug truncate">{f.label}</p>
                    {f.date && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(f.date).toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-GB')}</p>
                    )}
                  </div>
                  {clickable && <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>}
                </>
              );
              return clickable ? (
                <button
                  key={f.key}
                  onClick={() => router.push(f.href)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted transition-colors text-left group"
                >
                  {content}
                </button>
              ) : (
                <div key={f.key} className="w-full flex items-center gap-3 px-2 py-2">
                  {content}
                </div>
              );
            })}
          </div>
        </div>

        {/* Nav shortcuts */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-[#e4a233] to-[#d1622b]" />
            {t('dash.quicknav.title')}
          </h3>
          <div className="space-y-1.5">
            {[
              { label: t('dash.quicknav.wallet'), sub: t('dash.quicknav.wallet.sub'), icon: WalletIcon, section: 'wallet' },
              { label: t('dash.quicknav.group'), sub: t('dash.quicknav.group.sub'), icon: UserGroupIcon, section: 'group' },
              { label: t('dash.quicknav.training'), sub: t('dash.quicknav.training.sub'), icon: AcademicCapIcon, section: 'learning' },
              { label: t('dash.quicknav.investment'), sub: t('dash.quicknav.investment.sub'), icon: CurrencyDollarIcon, section: 'investments' },
            ].map((item) => (
              <button
                key={item.section}
                onClick={() => onNavigate(item.section)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left group"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/15 transition-colors shrink-0">
                  <item.icon className="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-foreground/90 group-hover:text-foreground transition-colors">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
                <span className="ml-auto text-muted-foreground group-hover:text-primary transition-colors">→</span>
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
      ? 'bg-white/5 border-border text-foreground placeholder:text-muted-foreground focus:border-[#e4a233]/60'
      : 'bg-card border-border text-muted-foreground cursor-default'
  }`;

function ProfileSection({ memberProfile, user, loadMemberData }: { memberProfile: any; user: any; loadMemberData: () => void }) {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(memberProfile?.avatar_url ?? null);
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
      setAvatar(memberProfile.avatar_url ?? null);
    }
  }, [memberProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/members/profile?userId=${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, avatarUrl: avatar }),
      });
      if (res.ok) { setIsEditing(false); loadMemberData(); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const initials = (formData.fullName || user?.email || 'U')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const Field = ({ label, type = 'text', value, field, disabled = false }: { label: string; type?: string; value: string; field?: keyof typeof formData; disabled?: boolean }) => (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
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
      <div className="rounded-xl bg-card border border-border p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#d1622b] to-[#e4a233] flex items-center justify-center shrink-0 overflow-hidden">
          {avatar ? (
            <img src={avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-white">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-foreground truncate">{formData.fullName || t('prof.member')}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{memberProfile?.email || user?.email}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${
            memberProfile?.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'
          }`}>
            {memberProfile?.status === 'active' ? t('prof.activeMember') : t('prof.pending')}
          </span>
        </div>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={saving}
          className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            isEditing
              ? 'bg-[#d1622b] hover:bg-[#b9531f] text-foreground'
              : 'bg-white/5 hover:bg-white/10 text-muted-foreground'
          }`}
        >
          {saving ? t('prof.saving') : isEditing ? t('prof.save') : t('prof.edit')}
        </button>
      </div>

      {/* Personal info */}
      <div className="rounded-xl bg-card border border-border p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('prof.personalInfo')}</h3>
        {isEditing && (
          <div className="mb-4">
            <label className="block text-xs text-muted-foreground mb-2">{t('set.field.avatar')}</label>
            <AvatarPicker
              value={avatar}
              onChange={setAvatar}
              fallbackText={formData.fullName || 'U'}
              shape="circle"
              size={72}
              label={t('mg.field.logoUpload')}
              helper={t('set.field.avatarHelper')}
            />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('prof.fullName')} value={formData.fullName} field="fullName" />
          <Field label={t('prof.email')} value={memberProfile?.email || user?.email || ''} disabled />
          <Field label={t('prof.phone')} type="tel" value={formData.phone} field="phone" />
          <Field label={t('prof.location')} value={formData.location} field="location" />
        </div>
      </div>

      {/* Business info */}
      <div className="rounded-xl bg-card border border-border p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('prof.businessInfo')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('prof.businessName')} value={formData.businessName} field="businessName" />
          <Field label={t('prof.businessType')} value={formData.businessType} field="businessType" />
          <Field label={t('prof.monthlyRevenue')} type="number" value={formData.monthlyRevenue} field="monthlyRevenue" />
          <Field label={t('prof.employeeCount')} type="number" value={formData.employeeCount} field="employeeCount" />
        </div>
        <div className="mt-3">
          <label className="block text-xs text-muted-foreground mb-1">{t('prof.businessDesc')}</label>
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
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
          >
            {t('prof.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? t('prof.saving') : t('prof.saveChanges')}
          </button>
        </div>
      )}
    </div>
  );
}

function MyGroupSection({ memberProfile }: { memberProfile: any }) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', monthlyContribution: '', votingNumerator: '3', votingDenominator: '5', contributionFrequency: 'monthly' as 'monthly' | 'weekly' });
  const [createLogo, setCreateLogo] = useState<string | null>(null);
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
      else { setJoinLookupError(d.error || t('mg.joinModal.notFound')); }
    } catch { setJoinLookupError(t('mg.joinModal.err')); }
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
          contributionFrequency: createForm.contributionFrequency,
          logoUrl: createLogo,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setCreateForm({ name: '', monthlyContribution: '', votingNumerator: '3', votingDenominator: '5', contributionFrequency: 'monthly' });
        setCreateLogo(null);
        await loadMyGroups();
        if (data.group?.id) router.push(`/member-dashboard/groups/${data.group.id}`);
      } else {
        setCreateError(data.error || 'Imeshindikana kuunda kundi.');
      }
    } catch { setCreateError('Hitilafu imetokea. Jaribu tena.'); }
    finally { setCreateLoading(false); }
  };

  const statusConfig: Record<string, { label: string; cls: string }> = {
    pending:  { label: t('mg.status.pending'), cls: 'bg-yellow-500/15 text-yellow-400' },
    approved: { label: t('mg.status.approved'), cls: 'bg-emerald-500/15 text-emerald-400' },
    rejected: { label: t('mg.status.rejected'), cls: 'bg-red-500/15 text-red-400' },
  };

  return (
    <div className="space-y-6">

      {/* Header with Create Group button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-foreground">{t('mg.title')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('mg.subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setCreateError(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-foreground text-xs font-medium transition-colors"
        >
          <span className="text-base leading-none">+</span> {t('mg.create')}
        </button>
      </div>

      {myGroups.length > 0 ? (
        <>
          <div className="grid gap-3">
            {myGroups.map((g) => (
              <div
                key={g.id}
                onClick={() => router.push(`/member-dashboard/groups/${g.id}`)}
                className="rounded-xl bg-card border border-border hover:border-primary/30 p-5 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-[#d1622b] to-[#e4a233] flex items-center justify-center text-white font-bold overflow-hidden">
                      {g.logo_url ? (
                        <img src={g.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        g.name.charAt(0).toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-base font-semibold text-foreground truncate">{g.name}</h3>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs bg-[#e4a233]/10 text-[#e4a233]">
                          {g.member_role || t('mg.role.member')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('mg.status')}: {g.membership_status || g.status || 'active'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#e4a233]">
                      TSh {parseInt(g.monthly_contribution || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{g.contribution_frequency === 'weekly' ? t('mg.perWeek') : t('mg.perMonth')}</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t('mg.tapToView')} →</p>
                  <div className="flex items-center gap-1.5">
                    <UserGroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground group-hover:text-[#e4a233] transition-colors">{t('mg.view')} →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowJoinModal(true)}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          >
            + {t('mg.joinAnother')}
          </button>
        </>
      ) : (
        <div className="rounded-xl bg-card border border-border p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <UserGroupIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-1 text-sm">{t('mg.emptyTitle')}</p>
          <p className="text-xs text-muted-foreground mb-5">{t('mg.emptyHint')}</p>
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-5 py-2 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-foreground text-sm font-medium transition-colors"
          >
            {t('mg.joinCta')}
          </button>
        </div>
      )}

      {/* Pending join requests */}
      {joinRequests.length > 0 && (
        <div className="rounded-xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('mg.myRequests')}</h3>
          <div className="space-y-2">
            {joinRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm text-foreground">{r.group_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    TSh {parseInt(r.monthly_contribution).toLocaleString()}/{t('mg.month')} · {new Date(r.created_at).toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-GB')}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${(statusConfig[r.status] || { cls: 'bg-white/5 text-muted-foreground' }).cls}`}>
                  {(statusConfig[r.status] || { label: r.status }).label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Group modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div
            className="bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 w-full max-w-md overflow-y-auto"
            style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 1rem)' }}
          >
            <h3 className="text-base font-semibold text-foreground mb-1">{t('mg.createNew.title')}</h3>
            <p className="text-xs text-muted-foreground mb-5">{t('mg.createNew.desc')}</p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-2">{t('mg.field.logo')}</label>
                <AvatarPicker
                  value={createLogo}
                  onChange={setCreateLogo}
                  fallbackText={createForm.name || 'G'}
                  shape="square"
                  size={72}
                  label={t('mg.field.logoUpload')}
                  helper={t('mg.field.logoHelper')}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('mg.field.name')} *</label>
                <input
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('mg.field.namePh')}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#e4a233]/60"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {t('grp.freq.contribAmount')} ({createForm.contributionFrequency === 'weekly' ? t('grp.freq.weekly') : t('grp.freq.monthly')}) (TSh) *
                </label>
                <input
                  type="number"
                  value={createForm.monthlyContribution}
                  onChange={e => setCreateForm(f => ({ ...f, monthlyContribution: e.target.value }))}
                  placeholder="Mfano: 50000"
                  min="1"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#e4a233]/60"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{t('grp.freq.label')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['monthly', 'weekly'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setCreateForm(prev => ({ ...prev, contributionFrequency: f }))}
                      className={`py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                        createForm.contributionFrequency === f
                          ? 'bg-[#e4a233]/15 border-[#e4a233]/50 text-[#e4a233]'
                          : 'bg-white/5 border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f === 'monthly' ? t('grp.freq.monthly') : t('grp.freq.weekly')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('mg.field.voting')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={createForm.votingNumerator}
                    onChange={e => setCreateForm(f => ({ ...f, votingNumerator: e.target.value }))}
                    min="1"
                    className="w-20 px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground text-center focus:outline-none focus:border-[#e4a233]/60"
                  />
                  <span className="text-muted-foreground text-sm">{t('mg.field.of')}</span>
                  <input
                    type="number"
                    value={createForm.votingDenominator}
                    onChange={e => setCreateForm(f => ({ ...f, votingDenominator: e.target.value }))}
                    min="1"
                    className="w-20 px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground text-center focus:outline-none focus:border-[#e4a233]/60"
                  />
                  <span className="text-xs text-muted-foreground">{t('mg.field.pass')}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('mg.field.currently')}: {createForm.votingNumerator}/{createForm.votingDenominator} {t('mg.field.votesNeeded')}
                </p>
              </div>

              {createError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{createError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateError(''); }}
                  className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
                >
                  {t('mg.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-2.5 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {createLoading ? t('mg.creating') : t('mg.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join by Code modal */}
      {showJoinModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div
            className="bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 w-full max-w-md overflow-y-auto"
            style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 1rem)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-foreground">{t('mg.joinModal.title')}</h3>
              <button onClick={resetJoinModal} className="text-muted-foreground hover:text-muted-foreground transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-5">{t('mg.joinModal.desc')}</p>

            {/* Code input + search */}
            <div className="flex gap-2 mb-4">
              <input
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinLookupResult(null); setJoinLookupError(''); setJoinFeedback(null); }}
                onKeyDown={e => { if (e.key === 'Enter') handleLookupCode(); }}
                placeholder={t('mg.joinModal.codePh')}
                maxLength={12}
                className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-[#e4a233]/60 uppercase tracking-wider"
              />
              <button
                onClick={handleLookupCode}
                disabled={joinLookupLoading || !joinCode.trim()}
                className="px-4 py-2.5 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
              >
                {joinLookupLoading ? '...' : t('mg.joinModal.search')}
              </button>
            </div>

            {/* Lookup error */}
            {joinLookupError && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{joinLookupError}</div>
            )}

            {/* Group preview */}
            {joinLookupResult && !joinFeedback && (
              <div className="mb-4 rounded-xl bg-card border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{joinLookupResult.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('mg.joinModal.leader')}: {joinLookupResult.leader_name || t('mg.joinModal.unassigned')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#e4a233]">TSh {parseInt(joinLookupResult.monthly_contribution || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{joinLookupResult.contribution_frequency === 'weekly' ? t('mg.perWeek') : t('mg.perMonth')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border">
                  <span>{joinLookupResult.member_count} {t('mg.joinModal.members')}</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className={joinLookupResult.join_policy === 'open' ? 'text-emerald-400' : 'text-yellow-400'}>
                    {joinLookupResult.join_policy === 'open' ? t('mg.joinModal.open') : t('mg.joinModal.needsApproval')}
                  </span>
                </div>

                {joinLookupResult.join_policy !== 'open' && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">{t('mg.joinModal.messageLabel')}</label>
                    <textarea
                      value={joinMessage}
                      onChange={e => setJoinMessage(e.target.value)}
                      placeholder={t('mg.joinModal.messagePh')}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#e4a233]/60 resize-none"
                      rows={2}
                    />
                  </div>
                )}

                <button
                  onClick={handleJoinByCode}
                  disabled={joinLoading}
                  className="w-full py-2.5 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {joinLoading ? t('mg.joinModal.joining') : joinLookupResult.join_policy === 'open' ? t('mg.joinModal.joinNow') : t('mg.joinModal.sendReq')}
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
  const { t, language } = useLanguage();
  const totalInvestment = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  const totalReturns = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.actual_return || 0), 0);
  const returnRate = totalInvestment > 0 ? ((totalReturns / totalInvestment) * 100).toFixed(1) : '0';

  const summaryCards = [
    { label: t('minv.totalInvested'), value: `TSh ${totalInvestment.toLocaleString()}`, accent: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: t('minv.netReturns'), value: `TSh ${totalReturns.toLocaleString()}`, accent: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: t('minv.returnRate'), value: `${returnRate}%`, accent: 'text-[#e4a233]', bg: 'bg-[#e4a233]/10' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map((c, i) => (
          <div key={i} className="rounded-xl bg-card border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-lg font-semibold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {memberInvestments.length > 0 ? (
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          {memberInvestments.map((inv, i) => (
            <div key={i} className="p-5 border-b border-border last:border-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{inv.group_name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(inv.investment_date).toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-GB')}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  inv.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'
                }`}>
                  {inv.status === 'active' ? t('minv.active') : t('minv.pending')}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: t('minv.amount'), value: `TSh ${parseFloat(inv.amount).toLocaleString()}` },
                  { label: t('minv.equity'), value: `${inv.equity_percentage}%` },
                  { label: t('minv.expectedReturn'), value: `TSh ${parseFloat(inv.expected_return || 0).toLocaleString()}` },
                  { label: t('minv.netReturns'), value: `TSh ${parseFloat(inv.actual_return || 0).toLocaleString()}` },
                ].map((item, j) => (
                  <div key={j} className="rounded-lg bg-card p-2.5">
                    <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-card border border-border p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <CurrencyDollarIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t('minv.empty')}</p>
        </div>
      )}
    </div>
  );
}

function LearningSection({ memberTraining, user }: { memberTraining: any[]; user: any }) {
  const { t } = useLanguage();
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
      <div className="rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#e4a233]/10 border border-[#e4a233]/20 flex items-center justify-center">
            <BookOpenIcon className="h-5 w-5 text-[#e4a233]" />
          </div>
          <h3 className="text-base font-bold text-foreground">{t('edu.title')}</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl bg-card border border-border p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t('edu.inProgress')}</p>
            <p className="text-2xl font-bold text-[#e4a233]">{coursesInProgress}</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t('edu.certsEarned')}</p>
            <p className="text-2xl font-bold text-emerald-400">{certificatesCount}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/jifunze')}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[#d1622b] hover:bg-[#b9531f] text-white transition-colors"
          >
            {t('edu.continue')}
          </button>
          <button
            onClick={() => router.push('/jifunze/vyeti')}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-muted hover:bg-border text-muted-foreground hover:text-foreground border border-border transition-colors"
          >
            {t('edu.myCerts')}
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
  const { t } = useLanguage();
  const [username, setUsername] = useState(memberProfile?.username || '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Profile photo
  const [avatar, setAvatar] = useState<string | null>(memberProfile?.avatar_url ?? null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarSaved, setAvatarSaved] = useState(false);
  const avatarDirty = (avatar ?? null) !== (memberProfile?.avatar_url ?? null);

  useEffect(() => {
    if (memberProfile?.username) setUsername(memberProfile.username);
    setAvatar(memberProfile?.avatar_url ?? null);
  }, [memberProfile]);

  const saveAvatar = async () => {
    if (!user?.id) return;
    setAvatarSaving(true); setAvatarSaved(false);
    try {
      // Patch-style: only avatar_url is written, the rest of the profile is untouched.
      const res = await fetch(`/api/members/profile?userId=${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: avatar }),
      });
      if (res.ok) {
        setAvatarSaved(true);
        loadMemberData();
        setTimeout(() => setAvatarSaved(false), 2500);
      }
    } catch (e) { console.error(e); }
    finally { setAvatarSaving(false); }
  };

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
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:bg-muted transition-all text-left"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d1622b] to-[#e4a233] flex items-center justify-center shrink-0 shadow-lg shadow-primary/20 overflow-hidden">
          {memberProfile?.avatar_url ? (
            <img src={memberProfile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-white">
              {(memberProfile?.full_name || user?.fullName || user?.email || 'U')[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{memberProfile?.full_name || user?.fullName || t('prof.member')}</p>
          <p className="text-xs text-muted-foreground truncate">{memberProfile?.username ? `@${memberProfile.username}` : memberProfile?.email || user?.email}</p>
        </div>
        <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Profile photo */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">{t('set.field.avatar')}</h3>
        <p className="text-xs text-muted-foreground mb-4">{t('set.field.avatarHelper')}</p>
        <AvatarPicker
          value={avatar}
          onChange={setAvatar}
          fallbackText={memberProfile?.full_name || user?.fullName || 'U'}
          shape="circle"
          size={80}
          label={t('mg.field.logoUpload')}
        />
        {avatarDirty && (
          <button
            onClick={saveAvatar}
            disabled={avatarSaving}
            className="mt-4 w-full py-2.5 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {avatarSaving ? t('mg.creating') : t('grp.settings.save')}
          </button>
        )}
        {avatarSaved && (
          <p className="mt-3 text-xs text-emerald-500 text-center">✓ {t('grp.settings.saved')}</p>
        )}
      </div>

      {/* Username section */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">{t('set.username.title')}</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {memberProfile?.username 
            ? t('set.username.hasDesc')
            : t('set.username.noDesc')
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
                <p className="text-xs text-muted-foreground">{t('set.username.yours')}</p>
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="juma_ally"
                  className="w-full pl-8 pr-4 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#e4a233]/60"
                  pattern="[a-z0-9_]{3,30}"
                  minLength={3}
                  maxLength={30}
                />
                {usernameStatus === 'checking' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{t('set.username.checking')}</span>}
                {usernameStatus === 'available' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400">{t('set.username.available')}</span>}
                {usernameStatus === 'taken' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400">{t('set.username.taken')}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t('set.username.hint')}</p>
              {usernameError && <p className="text-xs text-red-400 mt-1">{usernameError}</p>}
              {saveSuccess && <p className="text-xs text-emerald-400 mt-1">{t('set.username.saved')}</p>}
            </div>

            <button
              onClick={saveUsername}
              disabled={saving || usernameStatus !== 'available' || !username || username === memberProfile?.username}
              className="w-full py-2.5 rounded-lg bg-[#d1622b] hover:bg-[#b9531f] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t('set.username.saving') : t('set.username.save')}
            </button>
          </div>
        )}
      </div>

      {/* Settings menu items */}
      <div className="rounded-2xl bg-card border border-border divide-y divide-white/[0.04]">
        {[
          { label: t('set.menu.account'), desc: t('set.menu.account.desc'), icon: UserIcon },
          { label: t('set.menu.security'), desc: t('set.menu.security.desc'), icon: CogIcon },
          { label: t('set.menu.notifications'), desc: t('set.menu.notifications.desc'), icon: DocumentTextIcon },
          { label: t('set.menu.language'), desc: 'Kiswahili / English', icon: BookOpenIcon },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 px-4 py-3.5 opacity-50">
            <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center shrink-0">
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{t('set.comingSoon')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
