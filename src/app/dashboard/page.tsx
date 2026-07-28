'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/ToastProvider';
import {
  UserGroupIcon, UsersIcon, CurrencyDollarIcon, ChartBarIcon, BookOpenIcon,
  DocumentTextIcon, CogIcon, SunIcon, MoonIcon, CodeBracketIcon
} from '@heroicons/react/24/outline';
import NotificationCenter from '@/components/NotificationCenter';
import OverviewSection from './components/OverviewSection';
import MembersSection from './components/MembersSection';
import GroupsSection from './components/GroupsSection';
import JoinRequestsSection from './components/JoinRequestsSection';
import InvestmentsSection from './components/InvestmentsSection';
import ContentSection from './components/ContentSection';
import PartnersSection from './components/PartnersSection';
import ReportsSection from './components/ReportsSection';
import SettingsSection from './components/SettingsSection';

export default function AdminDashboard() {
  const { t, language, toggleLanguage } = useLanguage();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [user, setUser] = useState<{id?: number; fullName?: string; email: string; role?: string} | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [adminStats, setAdminStats] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [educationalContent, setEducationalContent] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/login'); return; }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    if (parsedUser.role !== 'admin') { router.push('/member-dashboard'); return; }
    loadAdminData();
  }, [router]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const timestamp = new Date().getTime();
      const cacheParams = `?_t=${timestamp}`;

      const statsResponse = await fetch(`/api/admin/stats${cacheParams}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log('Admin stats loaded:', statsData);
        setAdminStats(statsData);
      }

      const membersResponse = await fetch(`/api/admin/members${cacheParams}`, { cache: 'no-store' });
      if (membersResponse.ok) setMembers(await membersResponse.json());

      const groupsResponse = await fetch(`/api/admin/groups${cacheParams}`, { cache: 'no-store' });
      if (groupsResponse.ok) setGroups(await groupsResponse.json());

      try {
        const investmentsResponse = await fetch(`/api/admin/investments${cacheParams}`, { cache: 'no-store' });
        if (investmentsResponse.ok) setInvestments(await investmentsResponse.json());
      } catch { setInvestments([]); }

      const contentResponse = await fetch(`/api/educational-content?includeUnpublished=true&_t=${timestamp}`, { cache: 'no-store' });
      setEducationalContent(await contentResponse.json());

      const activitiesResponse = await fetch('/api/admin/activities');
      if (activitiesResponse.ok) setRecentActivities(await activitiesResponse.json());

      const joinRequestsResponse = await fetch('/api/admin/join-requests');
      if (joinRequestsResponse.ok) {
        const joinRequestsData = await joinRequestsResponse.json();
        console.log('Join requests data loaded:', joinRequestsData);
        setJoinRequests(joinRequestsData.requests || []);
      } else {
        console.error('Failed to load join requests:', joinRequestsResponse.status);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const { showToast } = useToast();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Inapakia dashibodi...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'overview',      name: t('adm.nav.overview'),     icon: ChartBarIcon },
    { id: 'members',       name: t('adm.nav.members'),      icon: UsersIcon },
    { id: 'groups',        name: t('adm.nav.groups'),       icon: UserGroupIcon },
    { id: 'join-requests', name: t('adm.nav.requests'),     icon: UserGroupIcon },
    { id: 'investments',   name: t('adm.nav.investments'),  icon: CurrencyDollarIcon },
    { id: 'content',       name: t('adm.nav.training'),     icon: BookOpenIcon },
    { id: 'reports',       name: t('adm.nav.reports'),      icon: DocumentTextIcon },
    { id: 'partners',      name: t('adm.nav.partners'),     icon: CodeBracketIcon },
    { id: 'settings',      name: t('adm.nav.settings'),     icon: CogIcon },
  ];

  const pendingRequests = joinRequests.filter((r: any) => r.status === 'pending').length;

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':      return <OverviewSection adminStats={adminStats} recentActivities={recentActivities} />;
      case 'members':       return <MembersSection members={members} groups={groups} loadAdminData={loadAdminData} showToast={showToast} />;
      case 'groups':        return <GroupsSection groups={groups} loadAdminData={loadAdminData} showToast={showToast} />;
      case 'join-requests': return <JoinRequestsSection joinRequests={joinRequests} loadAdminData={loadAdminData} showToast={showToast} />;
      case 'investments':   return <InvestmentsSection investments={investments} groups={groups} loadAdminData={loadAdminData} />;
      case 'content':       return <ContentSection educationalContent={educationalContent} user={user} loadAdminData={loadAdminData} showToast={showToast} />;
      case 'reports':       return <ReportsSection adminStats={adminStats} />;
      case 'partners':      return <PartnersSection showToast={showToast} />;
      case 'settings':      return <SettingsSection />;
      default:              return <OverviewSection adminStats={adminStats} recentActivities={recentActivities} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-orange-500">A</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-none">{t('adm.title')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Washika DAU</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter userId={1} className="" />
              <button
                onClick={toggleLanguage}
                className="h-8 rounded-full bg-foreground/5 border border-border px-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {language === 'sw' ? 'EN' : 'SW'}
              </button>
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="h-8 w-8 rounded-full bg-foreground/5 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title={resolvedTheme === 'dark' ? t('adm.lightMode') : t('adm.darkMode')}
              >
                {resolvedTheme === 'dark'
                  ? <SunIcon className="h-4 w-4" />
                  : <MoonIcon className="h-4 w-4" />}
              </button>
              <div className="h-8 w-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-orange-500">
                  {(user?.fullName || user?.email || 'A').charAt(0).toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => { localStorage.removeItem('user'); router.push('/'); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('adm.logout')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-5 items-start">

          {/* ── Sidebar ── */}
          <aside className="hidden lg:flex flex-col w-48 shrink-0 sticky top-20">
            <div className="rounded-xl bg-card border border-border overflow-hidden shadow-sm">
              {menuItems.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 text-sm font-medium transition-all ${
                    activeSection === item.id
                      ? 'bg-orange-500/10 text-orange-500 border-l-2 border-orange-500'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03] border-l-2 border-transparent'
                  } ${i !== 0 ? 'border-t border-t-border' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className={`h-4 w-4 ${activeSection === item.id ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    {item.name}
                  </div>
                  {item.id === 'join-requests' && pendingRequests > 0 && (
                    <span className="text-[10px] font-bold bg-orange-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {pendingRequests}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>

          {/* ── Content ── */}
          <div className="flex-1 min-w-0">
            {renderContent()}
          </div>

        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex overflow-x-auto scrollbar-none">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`flex-1 min-w-max flex flex-col items-center gap-1 py-2.5 px-2 text-[9px] font-medium transition-all relative ${
              activeSection === item.id ? 'text-orange-500' : 'text-muted-foreground'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
            {item.id === 'join-requests' && pendingRequests > 0 && (
              <span className="absolute top-1.5 right-1.5 text-[8px] font-bold bg-orange-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {pendingRequests}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="lg:hidden h-16" />
    </div>
  );
}
