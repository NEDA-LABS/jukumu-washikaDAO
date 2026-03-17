'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ToastProvider';
import {
  UserGroupIcon, PlusIcon, UsersIcon, CurrencyDollarIcon, ChartBarIcon, BookOpenIcon,
  DocumentTextIcon, CogIcon, EyeIcon, PencilIcon, TrashIcon, UserMinusIcon
} from '@heroicons/react/24/outline';
import NotificationCenter from '@/components/NotificationCenter';
import GrowthChart from '@/components/GrowthChart';

const dkInput = 'w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50';
const dkSelect = 'w-full px-3 py-2.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50 [&>option]:bg-[#1a1a1a] [&>option]:text-white';
const dkLabel = 'block text-xs text-white/40 mb-1';

export default function AdminDashboard() {
  const { } = useLanguage();
  const router = useRouter();
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
  // Force cache invalidation - admin dashboard with live data

  // Check authentication and load admin data
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    if (parsedUser.role !== 'admin') {
      router.push('/member-dashboard');
      return;
    }

    loadAdminData();
  }, [router]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      // Add cache busting timestamp
      const timestamp = new Date().getTime();
      const cacheParams = `?_t=${timestamp}`;
      
      // Load admin statistics
      const statsResponse = await fetch(`/api/admin/stats${cacheParams}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log('Admin stats loaded:', statsData);
        setAdminStats(statsData);
      }
      
      // Load members
      const membersResponse = await fetch(`/api/admin/members${cacheParams}`, {
        cache: 'no-store'
      });
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setMembers(membersData);
      }
      
      // Load groups
      const groupsResponse = await fetch(`/api/admin/groups${cacheParams}`, {
        cache: 'no-store'
      });
      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        setGroups(groupsData);
      }
      
      // Load investments
      try {
        const investmentsResponse = await fetch(`/api/admin/investments${cacheParams}`, {
          cache: 'no-store'
        });
        if (investmentsResponse.ok) {
          const investmentsData = await investmentsResponse.json();
          setInvestments(investmentsData);
        }
      } catch (investmentError) {
        console.log('Failed to load investments:', investmentError);
        setInvestments([]); // Set empty array as fallback
      }
      
      // Load educational content
      const contentResponse = await fetch(`/api/educational-content?includeUnpublished=true&_t=${timestamp}`, {
        cache: 'no-store'
      });
      const contentData = await contentResponse.json();
      setEducationalContent(contentData);
      
      // Load recent activities
      const activitiesResponse = await fetch('/api/admin/activities');
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setRecentActivities(activitiesData);
      }
      
      // Load join requests
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

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  const { showToast } = useToast();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-white/30">Inapakia dashibodi...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'overview',      name: 'Muhtasari',    icon: ChartBarIcon },
    { id: 'members',       name: 'Wanachama',    icon: UsersIcon },
    { id: 'groups',        name: 'Makundi',      icon: UserGroupIcon },
    { id: 'join-requests', name: 'Maombi',       icon: UserGroupIcon },
    { id: 'investments',   name: 'Uwekezaji',    icon: CurrencyDollarIcon },
    { id: 'content',       name: 'Mafunzo',      icon: BookOpenIcon },
    { id: 'reports',       name: 'Ripoti',       icon: DocumentTextIcon },
    { id: 'settings',      name: 'Mipangilio',   icon: CogIcon },
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
      case 'settings':      return <SettingsSection />;
      default:              return <OverviewSection adminStats={adminStats} recentActivities={recentActivities} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-orange-400">A</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">Dashibodi ya Msimamizi</p>
                <p className="text-xs text-white/25 mt-0.5">Washika DAU</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter userId={1} className="" />
              <div className="h-8 w-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-orange-400">
                  {(user?.fullName || user?.email || 'A').charAt(0).toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => { localStorage.removeItem('user'); router.push('/'); }}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                Toka
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-5 items-start">

          {/* ── Sidebar ── */}
          <aside className="hidden lg:flex flex-col w-48 shrink-0 sticky top-20">
            <div className="rounded-xl bg-[#141414] border border-white/[0.06] overflow-hidden">
              {menuItems.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 text-sm font-medium transition-all ${
                    activeSection === item.id
                      ? 'bg-orange-500/10 text-orange-400 border-l-2 border-orange-500'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03] border-l-2 border-transparent'
                  } ${i !== 0 ? 'border-t border-t-white/[0.04]' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className={`h-4 w-4 ${activeSection === item.id ? 'text-orange-400' : 'text-white/25'}`} />
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
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111] border-t border-white/[0.07] flex overflow-x-auto scrollbar-none">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`flex-1 min-w-max flex flex-col items-center gap-1 py-2.5 px-2 text-[9px] font-medium transition-all relative ${
              activeSection === item.id ? 'text-orange-400' : 'text-white/30'
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

function OverviewSection({ adminStats, recentActivities }: { adminStats: any; recentActivities: any[] }) {
  const stats = [
    { name: 'Wanachama', value: adminStats?.totalMembers?.toLocaleString() || '0', change: adminStats?.newMembersThisMonth ? `+${adminStats.newMembersThisMonth} mwezi huu` : '—', accent: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { name: 'Makundi Hai', value: adminStats?.totalGroups?.toLocaleString() || '0', change: adminStats?.newGroupsThisMonth ? `+${adminStats.newGroupsThisMonth} mwezi huu` : '—', accent: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { name: 'Uwekezaji', value: adminStats?.totalInvestment ? `TSH ${(adminStats.totalInvestment/1000000).toFixed(1)}M` : 'TSH 0', change: `${adminStats?.returnRate || 0}% mapato`, accent: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    { name: 'Mapato', value: adminStats?.totalReturns ? `TSH ${(adminStats.totalReturns/1000000).toFixed(1)}M` : 'TSH 0', change: `${adminStats?.returnRate || 0}% kiwango`, accent: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  ];

  const displayActivities = (recentActivities || []).slice(0, 6).map((a: any) => ({
    action: a.action, user: a.user_name,
    time: new Date(a.activity_date).toLocaleDateString('sw-TZ')
  }));

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className={`rounded-xl ${s.bg} border ${s.border} p-4`}>
            <p className="text-xs text-white/40 mb-1">{s.name}</p>
            <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
            <p className="text-xs text-white/25 mt-1">{s.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Growth chart */}
        <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Ukuaji wa Wanachama</h3>
          <GrowthChart memberCount={adminStats?.totalMembers || 0} groupCount={adminStats?.totalGroups || 0} />
        </div>

        {/* Recent activity */}
        <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Shughuli za Hivi Karibuni</h3>
          {displayActivities.length > 0 ? (
            <div className="space-y-3">
              {displayActivities.map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-white/70 leading-snug">{a.action}</p>
                    <p className="text-xs text-white/25 mt-0.5">{a.user} · {a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <ChartBarIcon className="h-8 w-8 mx-auto text-white/10 mb-3" />
              <p className="text-sm text-white/25">Hakuna shughuli za hivi karibuni</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MembersSection({ members, groups, loadAdminData, showToast }: { members: any[]; groups: any[]; loadAdminData: () => void; showToast: (msg: string, type?: any) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [memberForm, setMemberForm] = useState({ fullName: '', email: '', phone: '', location: '', businessType: '', idType: '', idNumber: '', gender: '', age: '' });

  const filteredMembers = members.filter(m => {
    const term = searchTerm.toLowerCase();
    const match = String(m?.full_name || '').toLowerCase().includes(term) || String(m?.email || '').toLowerCase().includes(term);
    return match && (!statusFilter || m.status === statusFilter);
  });

  const handleStatusChange = async (memberId: number, newStatus: string) => {
    try {
      await fetch('/api/admin/members', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: memberId, status: newStatus }) });
      loadAdminData();
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
  };

  const handleAddToGroup = async (memberId: number, groupId: number, el?: HTMLSelectElement) => {
    try {
      const res = await fetch('/api/admin/members', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: memberId, groupId }) });
      const data = await res.json();
      if (el) el.value = '';
      if (res.ok && data.success) { loadAdminData(); showToast(data.message || 'Mwanachama ameongezwa kwenye kundi!', 'success'); }
      else showToast(data.error || 'Hitilafu imetokea', 'error');
    } catch { if (el) el.value = ''; showToast('Hitilafu ya mtandao', 'error'); }
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: memberForm.fullName, contact: memberForm.email || memberForm.phone, location: memberForm.location, businessType: memberForm.businessType, groupName: '', gender: memberForm.gender, age: parseInt(memberForm.age) }) });
      if (res.ok) {
        setShowMemberForm(false);
        setMemberForm({ fullName: '', email: '', phone: '', location: '', businessType: '', idType: '', idNumber: '', gender: '', age: '' });
        loadAdminData();
        showToast('Mwanachama ameongezwa kwa mafanikio!', 'success');
      } else showToast('Hitilafu imetokea. Jaribu tena.', 'error');
    } catch { showToast('Hitilafu imetokea. Jaribu tena.', 'error'); }
  };

  const handleDeleteMember = async (member: any) => {
    try {
      const res = await fetch('/api/admin/members', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: member.id }) });
      const data = await res.json();
      if (res.ok && data.success) { loadAdminData(); showToast(data.message || 'Mwanachama amefutwa!', 'success'); }
      else showToast(data.error || 'Hitilafu imetokea', 'error');
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
  };

  const statusBadge = (s: string) => s === 'active' ? 'bg-emerald-500/10 text-emerald-400' : s === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400';

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Usimamizi wa Wanachama</h2>
          <button onClick={() => setShowMemberForm(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
            <PlusIcon className="h-4 w-4" /> Mwanachama Mpya
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <input type="text" placeholder="Tafuta wanachama..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={dkInput} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={dkSelect}>
            <option value="">Hali zote</option>
            <option value="active">Hai</option>
            <option value="pending">Inasubiri</option>
            <option value="inactive">Haifanyi kazi</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Mwanachama','Kundi','Hali','Tarehe','Vitendo'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredMembers.length > 0 ? filteredMembers.map(m => (
                <tr key={m.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{m.full_name}</div>
                    <div className="text-xs text-white/30 mt-0.5">{m.email}</div>
                    <div className="text-xs text-white/20">{m.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-white/60">{m.group_names || '—'}</div>
                    {m.group_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{m.group_count} kundi</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select value={m.status} onChange={e => handleStatusChange(m.id, e.target.value)} className={`text-xs rounded-full px-2 py-1 border-0 cursor-pointer ${statusBadge(m.status)} bg-transparent`}>
                      <option value="pending">Inasubiri</option>
                      <option value="active">Hai</option>
                      <option value="inactive">Haifanyi kazi</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/30">{new Date(m.created_at).toLocaleDateString('sw-TZ')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select onChange={e => { if (e.target.value) handleAddToGroup(m.id, parseInt(e.target.value), e.target as HTMLSelectElement); }} className="text-xs bg-white/5 border border-white/10 text-white/50 rounded-lg px-2 py-1 focus:outline-none" defaultValue="">
                        <option value="">+ Ongeza kwenye kundi</option>
                        {groups.filter(g => g.status === 'active').map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      {m.status === 'inactive' && (
                        <button onClick={() => handleDeleteMember(m)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors" title="Futa">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-12 text-center">
                  <UsersIcon className="h-8 w-8 mx-auto text-white/10 mb-3" />
                  <p className="text-sm text-white/25">Hakuna wanachama</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showMemberForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">Mwanachama Mpya</h3>
              <button onClick={() => setShowMemberForm(false)} className="text-white/30 hover:text-white/60 text-xl">×</button>
            </div>
            <form onSubmit={handleMemberSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className={dkLabel}>Jina Kamili *</label><input type="text" value={memberForm.fullName} onChange={e => setMemberForm({...memberForm, fullName: e.target.value})} className={dkInput} required /></div>
                <div><label className={dkLabel}>Barua Pepe</label><input type="email" value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value})} className={dkInput} /></div>
                <div><label className={dkLabel}>Nambari ya Simu</label><input type="tel" value={memberForm.phone} onChange={e => setMemberForm({...memberForm, phone: e.target.value})} className={dkInput} /></div>
                <div><label className={dkLabel}>Mahali *</label><input type="text" value={memberForm.location} onChange={e => setMemberForm({...memberForm, location: e.target.value})} className={dkInput} required /></div>
                <div><label className={dkLabel}>Aina ya Biashara *</label>
                  <select value={memberForm.businessType} onChange={e => setMemberForm({...memberForm, businessType: e.target.value})} className={dkSelect} required>
                    <option value="">Chagua...</option>
                    <option value="kilimo">Kilimo</option><option value="ufugaji">Ufugaji</option>
                    <option value="biashara_ndogo">Biashara Ndogo</option><option value="sanaa">Sanaa</option>
                    <option value="huduma">Huduma</option><option value="teknolojia">Teknolojia</option><option value="nyingine">Nyingine</option>
                  </select>
                </div>
                <div><label className={dkLabel}>Jinsia *</label>
                  <select value={memberForm.gender} onChange={e => setMemberForm({...memberForm, gender: e.target.value})} className={dkSelect} required>
                    <option value="">Chagua...</option><option value="mwanamke">Mwanamke</option><option value="mwanamume">Mwanamume</option>
                  </select>
                </div>
              </div>
              <div><label className={dkLabel}>Umri *</label><input type="number" value={memberForm.age} onChange={e => setMemberForm({...memberForm, age: e.target.value})} className={dkInput} min="18" max="100" required /></div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowMemberForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-colors">Ghairi</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">Hifadhi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupsSection({ groups, loadAdminData, showToast }: { groups: any[]; loadAdminData: () => void; showToast: (msg: string, type?: any) => void }) {
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [groupProposals, setGroupProposals] = useState<any[]>([]);
  const [groupWallet, setGroupWallet] = useState<any>(null);
  const [groupWalletBalances, setGroupWalletBalances] = useState<any>(null);
  const [groupWalletWarning, setGroupWalletWarning] = useState<string>('');
  const [groupTransfers, setGroupTransfers] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: '',
    leaderId: '',
    monthlyContribution: '',
    foundedDate: new Date().toISOString().split('T')[0]
  });

  const handleViewGroup = async (group: any) => {
    setSelectedGroup(group);
    setGroupMembers([]);
    setGroupProposals([]);
    setGroupWallet(null);
    setGroupWalletBalances(null);
    setGroupWalletWarning('');
    setGroupTransfers([]);
    setShowGroupDetails(true)
    
    // Fetch group members
    try {
      const response = await fetch(`/api/admin/groups/${group.id}/members`);
      if (response.ok) {
        const membersData = await response.json();
        setGroupMembers(membersData);
      }
    } catch (error) {
      console.error('Error fetching group members:', error);
      setGroupMembers([]);
    }

    // Fetch proposals + vote summary
    try {
      const proposalsResponse = await fetch(`/api/admin/groups/${group.id}/proposals`);
      if (proposalsResponse.ok) {
        const proposalsData = await proposalsResponse.json();
        setGroupProposals(proposalsData.proposals || []);
      }
    } catch (error) {
      console.error('Error fetching group proposals:', error);
      setGroupProposals([]);
    }

    // Fetch wallet + transfer history
    try {
      const walletResponse = await fetch(`/api/admin/groups/${group.id}/wallet`);
      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        setGroupWallet(walletData.wallet || null);
        setGroupWalletBalances(walletData.balances || null);
        setGroupWalletWarning(typeof walletData.warning === 'string' ? walletData.warning : '');
        setGroupTransfers(walletData.recentTransfers || []);
      }
    } catch (error) {
      console.error('Error fetching group wallet:', error);
      setGroupWallet(null);
      setGroupWalletBalances(null);
      setGroupWalletWarning('');
      setGroupTransfers([]);
    }
  };

  const handleEditGroup = (group: any) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name || '',
      leaderId: group.leader_id || '',
      monthlyContribution: group.monthly_contribution || '',
      foundedDate: group.founded_date ? group.founded_date.split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setShowEditGroup(true);
  };

  const handleRoleChange = async (memberId: number, newRole: string) => {
    if (!selectedGroup) return;
    
    try {
      const response = await fetch(`/api/admin/groups/${selectedGroup.id}/leadership`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: memberId,
          role: newRole
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh group members data
        const membersResponse = await fetch(`/api/admin/groups/${selectedGroup.id}/members`);
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          setGroupMembers(membersData);
        }
        
        // Refresh main admin data
        loadAdminData();
        
        showToast(data.message || 'Nafasi ya uongozi imebadilishwa!', 'success');
      } else {
        showToast(data.error || 'Hitilafu imetokea', 'error');
      }
    } catch (error) {
      console.error('Error updating member role:', error);
      showToast('Hitilafu ya mtandao', 'error');
    }
  };

  const handleRemoveFromGroup = async (memberId: number, memberName: string) => {
    if (!selectedGroup) return;
    const confirmRemove = true;
    
    if (!confirmRemove) return;
    
    try {
      const response = await fetch(`/api/admin/groups/${selectedGroup.id}/remove-member`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh group members data
        const membersResponse = await fetch(`/api/admin/groups/${selectedGroup.id}/members`);
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          setGroupMembers(membersData);
        }
        
        // Refresh main admin data
        loadAdminData();
        
        showToast(data.message || 'Mwanachama ameondolewa kwenye kundi!', 'success');
      } else {
        showToast(data.error || 'Hitilafu imetokea', 'error');
      }
    } catch (error) {
      console.error('Error removing member from group:', error);
      showToast('Hitilafu ya mtandao', 'error');
    }
  };

  const handleDeleteGroup = async (group: any) => {
    const confirmDelete = true;
    
    if (!confirmDelete) return;
    
    try {
      const response = await fetch('/api/admin/groups', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: group.id }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        loadAdminData();
        showToast(data.message || 'Kundi limefutwa!', 'success');
      } else {
        showToast(data.error || 'Hitilafu imetokea', 'error');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      showToast('Hitilafu ya mtandao', 'error');
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/admin/groups', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingGroup.id,
          name: groupForm.name,
          leaderId: groupForm.leaderId || null,
          monthlyContribution: parseFloat(groupForm.monthlyContribution),
          status: editingGroup.status
        }),
      });

      if (response.ok) {
        const updatedGroup = await response.json();
        showToast('Kundi limebadilishwa kwa mafanikio!', 'success');
        setShowEditGroup(false);
        setShowGroupDetails(false);
        loadAdminData();
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Hitilafu imetokea', 'error');
      }
    } catch (error) {
      console.error('Error updating group:', error);
      showToast('Hitilafu ya mtandao', 'error');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupForm)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setShowGroupForm(false);
        setGroupForm({ name: '', leaderId: '', monthlyContribution: '', foundedDate: new Date().toISOString().split('T')[0] });
        loadAdminData();
        showToast(data.message || 'Kundi limeanzishwa kwa mafanikio!', 'success');
      } else {
        showToast(data.error || 'Hitilafu imetokea', 'error');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      showToast('Hitilafu ya mtandao', 'error');
    }
  };

  const roleBadge = (r: string) => ({ leader:'bg-blue-500/10 text-blue-400', mwenyekiti:'bg-purple-500/10 text-purple-400', katibu:'bg-emerald-500/10 text-emerald-400', mwekahazina:'bg-yellow-500/10 text-yellow-400' }[r] || 'bg-white/5 text-white/30');
  const roleLabel = (r: string) => ({ leader:'Kiongozi', mwenyekiti:'Mwenyekiti', katibu:'Katibu', mwekahazina:'MwekaHazina' }[r] || 'Mwanachama');

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Usimamizi wa Makundi</h2>
          <button onClick={() => setShowGroupForm(v => !v)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
            <PlusIcon className="h-4 w-4" /> Kundi Jipya
          </button>
        </div>

        {showGroupForm && (
          <form onSubmit={handleCreateGroup} className="mb-5 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 space-y-3">
            <p className="text-xs font-semibold text-orange-400 mb-2">Anzisha Kundi Jipya</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className={dkLabel}>Jina la Kundi *</label><input type="text" value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} className={dkInput} placeholder="Jina la kundi" required /></div>
              <div><label className={dkLabel}>Kiongozi</label>
                <select value={groupForm.leaderId} onChange={e => setGroupForm({...groupForm, leaderId: e.target.value})} className={dkSelect}>
                  <option value="">Chagua kiongozi</option>
                  {members.filter(m => m.status === 'active').map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div><label className={dkLabel}>Mchango wa Kila Mwezi (TSH) *</label><input type="number" value={groupForm.monthlyContribution} onChange={e => setGroupForm({...groupForm, monthlyContribution: e.target.value})} className={dkInput} placeholder="50000" min="1000" required /></div>
              <div><label className={dkLabel}>Tarehe ya Kuanzishwa *</label><input type="date" value={groupForm.foundedDate} onChange={e => setGroupForm({...groupForm, foundedDate: e.target.value})} className={dkInput} required /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowGroupForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-colors">Ghairi</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">Anzisha</button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.length > 0 ? groups.map(g => (
            <div key={g.id} className="rounded-xl bg-[#1a1a1a] border border-white/[0.06] hover:border-orange-500/20 p-4 transition-all">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-white leading-snug">{g.name}</h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${g.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                  {g.status === 'active' ? 'Hai' : 'Inasubiri'}
                </span>
              </div>
              <div className="space-y-1 text-xs text-white/40 mb-4">
                <p><span className="text-white/25">Wanachama:</span> {g.member_count || 0}</p>
                <p><span className="text-white/25">Kiongozi:</span> {g.leader_name || '—'}</p>
                <p><span className="text-white/25">Mchango:</span> TSH {parseFloat(g.monthly_contribution || 0).toLocaleString()}/mwezi</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleViewGroup(g)} className="flex-1 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium transition-colors">Angalia</button>
                <button onClick={() => handleEditGroup(g)} className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-xs font-medium transition-colors">Hariri</button>
                <button onClick={() => handleDeleteGroup(g)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"><TrashIcon className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center py-12">
              <UserGroupIcon className="h-8 w-8 mx-auto text-white/10 mb-3" />
              <p className="text-sm text-white/25">Hakuna makundi bado</p>
            </div>
          )}
        </div>
      </div>

      {/* Group Details Modal */}
      {showGroupDetails && selectedGroup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-[#1a1a1a] border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedGroup.name}</h2>
                  <p className="text-xs text-white/30 mt-0.5">Maelezo ya kundi</p>
                </div>
                <button onClick={() => setShowGroupDetails(false)} className="text-white/30 hover:text-white/60 text-2xl leading-none">×</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Wanachama', value: selectedGroup.member_count || 0, cls: 'text-blue-400' },
                  { label: 'Mchango/Mwezi', value: `TSH ${parseFloat(selectedGroup.monthly_contribution||0).toLocaleString()}`, cls: 'text-emerald-400' },
                  { label: 'Uwekezaji', value: `TSH ${parseFloat(selectedGroup.total_investment||0).toLocaleString()}`, cls: 'text-orange-400' },
                  { label: 'Hali', value: selectedGroup.status === 'active' ? 'Hai' : 'Inasubiri', cls: selectedGroup.status === 'active' ? 'text-emerald-400' : 'text-yellow-400' },
                ].map((s,i) => (
                  <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                    <p className="text-[10px] text-white/30 mb-1">{s.label}</p>
                    <p className={`text-sm font-bold ${s.cls}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2">
                  <p className="text-xs font-semibold text-white/40 mb-2">Maelezo ya Kundi</p>
                  <p className="text-xs text-white/50"><span className="text-white/25">Kiongozi:</span> {selectedGroup.leader_name || '—'}</p>
                  <p className="text-xs text-white/50"><span className="text-white/25">Kuanzishwa:</span> {selectedGroup.founded_date ? new Date(selectedGroup.founded_date).toLocaleDateString('sw-TZ') : '—'}</p>
                  <p className="text-xs text-white/50"><span className="text-white/25">Kutengenezwa:</span> {new Date(selectedGroup.created_at).toLocaleDateString('sw-TZ')}</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2">
                  <p className="text-xs font-semibold text-white/40 mb-2">Takwimu za Fedha</p>
                  <p className="text-xs text-white/50"><span className="text-white/25">Mchango/Mwezi:</span> TSH {parseFloat(selectedGroup.monthly_contribution||0).toLocaleString()}</p>
                  <p className="text-xs text-white/50"><span className="text-white/25">Uwekezaji:</span> TSH {parseFloat(selectedGroup.total_investment||0).toLocaleString()}</p>
                  <p className="text-xs text-white/50"><span className="text-white/25">Jumla michango:</span> TSH {(parseFloat(selectedGroup.monthly_contribution||0)*(selectedGroup.member_count||0)).toLocaleString()}</p>
                </div>
              </div>

              {/* Group Members */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-xs font-semibold text-white/50">Wanachama wa Kundi</p>
                </div>
                <div className="p-3">
                  {groupMembers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead><tr className="border-b border-white/[0.06]">
                          {['Jina','Nafasi','Kujiunge','Hali','Badilisha Nafasi','Ondoa'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-white/25 uppercase">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {groupMembers.map(m => (
                            <tr key={m.id} className="hover:bg-white/[0.02]">
                              <td className="px-3 py-2.5">
                                <div className="text-xs font-medium text-white">{m.full_name}</div>
                                <div className="text-[10px] text-white/25">{m.email}</div>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${roleBadge(m.role)}`}>{roleLabel(m.role)}</span>
                              </td>
                              <td className="px-3 py-2.5 text-[10px] text-white/30">{m.joined_date ? new Date(m.joined_date).toLocaleDateString('sw-TZ') : '—'}</td>
                              <td className="px-3 py-2.5">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${m.status==='active'?'bg-emerald-500/10 text-emerald-400':'bg-red-500/10 text-red-400'}`}>
                                  {m.status==='active'?'Hai':'Haifanyi kazi'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <select value={m.role} onChange={e => handleRoleChange(m.id, e.target.value)} className="text-[10px] bg-white/5 border border-white/10 text-white/50 rounded-lg px-2 py-1 focus:outline-none">
                                  <option value="member">Mwanachama</option>
                                  <option value="leader">Kiongozi</option>
                                  <option value="mwenyekiti">Mwenyekiti</option>
                                  <option value="katibu">Katibu</option>
                                  <option value="mwekahazina">MwekaHazina</option>
                                </select>
                              </td>
                              <td className="px-3 py-2.5">
                                <button onClick={() => handleRemoveFromGroup(m.id, m.full_name)} className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                                  <UserMinusIcon className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <UsersIcon className="h-7 w-7 mx-auto text-white/10 mb-2" />
                      <p className="text-xs text-white/25">Hakuna wanachama bado</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Proposals */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4">
                <div className="px-4 py-3 border-b border-white/[0.06]"><p className="text-xs font-semibold text-white/50">Mapendekezo</p></div>
                <div className="p-3">
                  {groupProposals.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead><tr className="border-b border-white/[0.06]">
                          {['Kichwa','Hali','Kura','Mwandishi','Tarehe'].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-white/25 uppercase">{h}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {groupProposals.map(p => (
                            <tr key={p.id} className="hover:bg-white/[0.02]">
                              <td className="px-3 py-2.5">
                                <div className="text-xs font-medium text-white">{p.title}</div>
                                {p.description && <div className="text-[10px] text-white/25 mt-0.5">{p.description}</div>}
                              </td>
                              <td className="px-3 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${p.status==='open'?'bg-emerald-500/10 text-emerald-400':'bg-white/5 text-white/30'}`}>{p.status}</span></td>
                              <td className="px-3 py-2.5 text-[10px] text-white/40">✓{p.yes_votes||0} ✗{p.no_votes||0}</td>
                              <td className="px-3 py-2.5 text-[10px] text-white/30">{p.created_by_name||'—'}</td>
                              <td className="px-3 py-2.5 text-[10px] text-white/25">{p.created_at?new Date(p.created_at).toLocaleDateString('sw-TZ'):'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <DocumentTextIcon className="h-7 w-7 mx-auto text-white/10 mb-2" />
                      <p className="text-xs text-white/25">Hakuna mapendekezo bado</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Wallet & Transfers */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4">
                <div className="px-4 py-3 border-b border-white/[0.06]"><p className="text-xs font-semibold text-white/50">Pochi & Miamala</p></div>
                <div className="p-3 space-y-3">
                  {groupWallet ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-1">
                        <p className="text-[10px] text-white/25">Network: <span className="text-white/50">{groupWallet.network||'—'}</span></p>
                        <p className="text-[10px] text-white/25 break-all">Address: <span className="text-white/40 font-mono">{groupWallet.address||'—'}</span></p>
                      </div>
                      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-1">
                        <p className="text-[10px] text-white/25">USDC: <span className="text-white/50">{groupWalletBalances?.usdc?.amountBaseUnits??'—'}</span></p>
                        <p className="text-[10px] text-white/25">ETH: <span className="text-white/50">{groupWalletBalances?.eth?.amountBaseUnits??'—'}</span></p>
                        {groupWalletWarning && <p className="text-[10px] text-orange-400">{groupWalletWarning}</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <CurrencyDollarIcon className="h-7 w-7 mx-auto text-white/10 mb-2" />
                      <p className="text-xs text-white/25">Hakuna pochi bado</p>
                    </div>
                  )}
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="px-3 py-2.5 border-b border-white/[0.06]"><p className="text-[10px] font-semibold text-white/40">Miamala</p></div>
                    <div className="p-3">
                      {groupTransfers.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead><tr className="border-b border-white/[0.06]">
                              {['Kwenda','Kiasi','Hali','Idhini','Tarehe'].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-white/25 uppercase">{h}</th>)}
                            </tr></thead>
                            <tbody className="divide-y divide-white/[0.04]">
                              {groupTransfers.map(t => (
                                <tr key={t.id} className="hover:bg-white/[0.02]">
                                  <td className="px-3 py-2 text-[10px] text-white/40 font-mono truncate max-w-[120px]">{t.to_address}</td>
                                  <td className="px-3 py-2 text-[10px] text-white/50">{String(t.amount_base_units??'')}</td>
                                  <td className="px-3 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${t.status==='executed'?'bg-emerald-500/10 text-emerald-400':t.status==='approved'?'bg-blue-500/10 text-blue-400':t.status==='rejected'?'bg-red-500/10 text-red-400':'bg-white/5 text-white/30'}`}>{t.status}</span></td>
                                  <td className="px-3 py-2 text-[10px] text-white/30">{t.approval_count??0}/{t.approvals_required??0}</td>
                                  <td className="px-3 py-2 text-[10px] text-white/25">{t.created_at?new Date(t.created_at).toLocaleDateString('sw-TZ'):'—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="text-xs text-white/25 text-center py-4">Hakuna miamala bado</p>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowGroupDetails(false)} className="px-4 py-2 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-colors">Funga</button>
                <button onClick={() => handleEditGroup(selectedGroup)} className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">Hariri Kundi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroup && editingGroup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#1a1a1a] border border-white/10">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-white">Hariri Kundi</h2>
                <button onClick={() => setShowEditGroup(false)} className="text-white/30 hover:text-white/60 text-2xl leading-none">×</button>
              </div>
              
              <form onSubmit={handleUpdateGroup} className="space-y-3">
                <div><label className={dkLabel}>Jina la Kundi</label><input type="text" value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} className={dkInput} required /></div>
                <div><label className={dkLabel}>Kiongozi</label>
                  <select value={groupForm.leaderId} onChange={e => setGroupForm({...groupForm, leaderId: e.target.value})} className={dkSelect}>
                    <option value="">Chagua Kiongozi</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
                <div><label className={dkLabel}>Mchango wa Kila Mwezi (TSH)</label><input type="number" value={groupForm.monthlyContribution} onChange={e => setGroupForm({...groupForm, monthlyContribution: e.target.value})} className={dkInput} required /></div>
                <div><label className={dkLabel}>Tarehe ya Kuanzishwa</label><input type="date" value={groupForm.foundedDate} onChange={e => setGroupForm({...groupForm, foundedDate: e.target.value})} className={dkInput} required /></div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowEditGroup(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-colors">Ghairi</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">Badilisha</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function InvestmentsSection({ investments, groups, loadAdminData }: { investments: any[]; groups: any[]; loadAdminData: () => void }) {
  const [showInvestmentForm, setShowInvestmentForm] = useState(false);
  const [investmentForm, setInvestmentForm] = useState({
    groupId: '',
    amount: '',
    equityPercentage: '',
    expectedReturn: '',
    notes: ''
  });

  const handleCreateInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/admin/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(investmentForm)
      });
      setShowInvestmentForm(false);
      setInvestmentForm({ groupId: '', amount: '', equityPercentage: '', expectedReturn: '', notes: '' });
      loadAdminData();
    } catch (error) {
      console.error('Error creating investment:', error);
    }
  };

  const totalInvestment = investments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  const totalReturns = investments.reduce((sum, inv) => sum + parseFloat(inv.actual_return || 0), 0);
  const returnRate = totalInvestment > 0 ? ((totalReturns / totalInvestment) * 100).toFixed(1) : '0';

  return (
    <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-white">Usimamizi wa Uwekezaji</h2>
        <button onClick={() => setShowInvestmentForm(v => !v)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
          <PlusIcon className="h-4 w-4" /> Uwekezaji Mpya
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Jumla ya Uwekezaji', value: `TSH ${(totalInvestment/1000000).toFixed(1)}M`, cls: 'text-blue-400' },
          { label: 'Mapato ya Jumla', value: `TSH ${(totalReturns/1000000).toFixed(1)}M`, cls: 'text-emerald-400' },
          { label: 'Kiwango cha Mapato', value: `${returnRate}%`, cls: 'text-orange-400' },
        ].map((s,i) => (
          <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-xs text-white/30 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="border-b border-white/[0.06]">
            {['Kundi','Kiasi','Tarehe','Hali','Mapato','Vitendo'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-white/30 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-white/[0.04]">
            {investments.length > 0 ? investments.map(inv => (
              <tr key={inv.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-sm font-medium text-white">{inv.group_name}</td>
                <td className="px-4 py-3 text-sm text-white/60">TSH {parseFloat(inv.amount||0).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-white/40">{new Date(inv.investment_date).toLocaleDateString('sw-TZ')}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${inv.status==='active'?'bg-emerald-500/10 text-emerald-400':'bg-yellow-500/10 text-yellow-400'}`}>
                    {inv.status==='active'?'Hai':'Inasubiri'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-white/50">{inv.actual_return ? `TSH ${parseFloat(inv.actual_return).toLocaleString()}` : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Angalia</button>
                    <button className="text-xs text-white/30 hover:text-white/60 transition-colors">Hariri</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-12 text-center">
                <CurrencyDollarIcon className="h-8 w-8 mx-auto text-white/10 mb-3" />
                <p className="text-sm text-white/25">Hakuna uwekezaji bado</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsSection({ adminStats }: { adminStats: any }) {
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  const handleDownloadMonthlyReport = async (monthOffset: number) => {
    const reportDate = new Date(Date.now() - monthOffset * 30 * 24 * 60 * 60 * 1000);
    const reportKey = `monthly-${monthOffset}`;
    
    setDownloadingReport(reportKey);
    
    try {
      const d = new Date();
      d.setMonth(d.getMonth() - monthOffset);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      window.open(`/dashboard/report?month=${encodeURIComponent(month)}&print=1`, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error downloading report:', error);
      console.error('Hitilafu imetokea wakati wa kupakua ripoti.');
    } finally {
      setDownloadingReport(null);
    }
  };

  const handleGenerateSpecialReport = async (reportType: string) => {
    setGeneratingReport(reportType);
    
    try {
      const d = new Date();
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      window.open(`/dashboard/report?month=${encodeURIComponent(month)}&print=1`, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error generating report:', error);
      console.error('Hitilafu imetokea wakati wa kutengeneza ripoti.');
    } finally {
      setGeneratingReport(null);
    }
  };

  const generateMonthlyReportCSV = async (date: Date, stats: any) => {
    const monthYear = date.toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' });
    
    let csv = `Ripoti ya Mwezi wa ${monthYear}\n\n`;
    csv += `Takwimu za Jumla\n`;
    csv += `Jina,Idadi\n`;
    csv += `Members Wapya,${stats?.newMembersThisMonth || 0}\n`;
    csv += `Groups Vipya,${stats?.newGroupsThisMonth || 0}\n`;
    csv += `Uwekezaji Mpya,TSH ${(stats?.monthlyInvestment || 0).toLocaleString()}\n`;
    csv += `Mapato,TSH ${(stats?.monthlyReturns || 0).toLocaleString()}\n\n`;
    
    csv += `Tarehe ya Kutengeneza,${new Date().toLocaleDateString('sw-TZ')}\n`;
    
    return csv;
  };

  const generateGenderReportCSV = async (stats: any) => {
    let csv = `Takwimu za Jinsia\n\n`;
    csv += `Jinsia,Idadi,Asilimia\n`;
    
    const totalMembers = stats?.totalMembers || 0;
    const maleMembers = Math.floor(totalMembers * 0.45); // Estimated distribution
    const femaleMembers = totalMembers - maleMembers;
    
    csv += `Wanaume,${maleMembers},${totalMembers > 0 ? ((maleMembers/totalMembers)*100).toFixed(1) : 0}%\n`;
    csv += `Wanawake,${femaleMembers},${totalMembers > 0 ? ((femaleMembers/totalMembers)*100).toFixed(1) : 0}%\n\n`;
    
    csv += `Tarehe ya Kutengeneza,${new Date().toLocaleDateString('sw-TZ')}\n`;
    
    return csv;
  };

  const generateBusinessGrowthReportCSV = async (stats: any) => {
    let csv = `Ukuaji wa Biashara\n\n`;
    csv += `Kipimo,Thamani\n`;
    csv += `Jumla ya Uwekezaji,TSH ${(stats?.totalInvestment || 0).toLocaleString()}\n`;
    csv += `Kiwango cha Mapato,${stats?.returnRate || 0}%\n`;
    csv += `Groups Vya Kazi,${stats?.totalGroups || 0}\n`;
    csv += `Wastani wa Uwekezaji kwa Group,TSH ${stats?.totalGroups > 0 ? ((stats?.totalInvestment || 0) / stats.totalGroups).toLocaleString() : 0}\n\n`;
    
    csv += `Tarehe ya Kutengeneza,${new Date().toLocaleDateString('sw-TZ')}\n`;
    
    return csv;
  };

  const generateSocialImpactReportCSV = async (stats: any) => {
    let csv = `Athari za Kijamii\n\n`;
    csv += `Kipimo,Thamani\n`;
    csv += `Members Waliofaidika,${stats?.totalMembers || 0}\n`;
    csv += `Groups Vilivyoanzishwa,${stats?.totalGroups || 0}\n`;
    csv += `Jumla ya Uwekezaji,TSH ${(stats?.totalInvestment || 0).toLocaleString()}\n`;
    csv += `Athari za Kiuchumi,TSH ${(stats?.totalReturns || 0).toLocaleString()}\n\n`;
    
    csv += `Tarehe ya Kutengeneza,${new Date().toLocaleDateString('sw-TZ')}\n`;
    
    return csv;
  };

  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const monthlyReports = [
    { offset: 0, label: new Date().toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' }) },
    { offset: 1, label: new Date(Date.now() - 30*24*60*60*1000).toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' }) },
    { offset: 2, label: new Date(Date.now() - 60*24*60*60*1000).toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' }) }
  ];

  const specialReports = ['Takwimu za Jinsia', 'Ukuaji wa Biashara', 'Athari za Kijamii'];

  return (
    <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-5">
      <h2 className="text-base font-semibold text-white mb-5">Ripoti na Takwimu</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/40 mb-3">Ripoti za Mwezi</p>
          {adminStats ? monthlyReports.map((report, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-sm text-white/60">Ripoti ya {report.label}</span>
              <button
                onClick={() => handleDownloadMonthlyReport(report.offset)}
                disabled={downloadingReport === `monthly-${report.offset}`}
                className="text-xs text-orange-400 hover:text-orange-300 font-medium disabled:opacity-40 transition-colors"
              >
                {downloadingReport === `monthly-${report.offset}` ? 'Inafungua...' : 'Pakua PDF'}
              </button>
            </div>
          )) : (
            <p className="text-xs text-white/25 py-4 text-center">Hakuna takwimu bado</p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/40 mb-3">Ripoti za Maalum</p>
          {adminStats ? specialReports.map((report, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-sm text-white/60">{report}</span>
              <button
                onClick={() => handleGenerateSpecialReport(report)}
                disabled={generatingReport === report}
                className="text-xs text-orange-400 hover:text-orange-300 font-medium disabled:opacity-40 transition-colors"
              >
                {generatingReport === report ? 'Inafungua...' : 'Angalia PDF'}
              </button>
            </div>
          )) : (
            <p className="text-xs text-white/25 py-4 text-center">Hakuna takwimu bado</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ContentSection({ educationalContent, user, loadAdminData, showToast }: { educationalContent: any[]; user: any; loadAdminData: () => void; showToast: (msg: string, type?: any) => void }) {
  const [showContentForm, setShowContentForm] = useState(false);
  const [editingContent, setEditingContent] = useState<any>(null);
  const [viewingContent, setViewingContent] = useState<any>(null);
  const [managingLessons, setManagingLessons] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [lessonForm, setLessonForm] = useState({
    language: 'sw',
    title: '',
    content: '',
    duration_minutes: 15,
    lesson_type: 'text',
    video_url: ''
  });
  const [showAiLessonGenerator, setShowAiLessonGenerator] = useState(false);
  const [aiLanguage, setAiLanguage] = useState<'sw' | 'en'>('sw');
  const [aiLessonCount, setAiLessonCount] = useState(6);
  const [aiDifficulty, setAiDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [aiTopicPrompt, setAiTopicPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiGeneratedLessons, setAiGeneratedLessons] = useState<any[] | null>(null);
  // AI Course Generator
  const [showAiCourseModal, setShowAiCourseModal] = useState(false);
  const [aiCoursePrompt, setAiCoursePrompt] = useState('');
  const [aiCourseLang, setAiCourseLang] = useState<'sw' | 'en'>('sw');
  const [aiCourseDiff, setAiCourseDiff] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [aiCourseLessonCount, setAiCourseLessonCount] = useState(6);
  const [aiCourseCategory, setAiCourseCategory] = useState('Biashara');
  const [aiCourseGenerating, setAiCourseGenerating] = useState(false);
  const [aiCourseSaving, setAiCourseSaving] = useState(false);
  const [aiCourseError, setAiCourseError] = useState<string | null>(null);
  const [aiCoursePreview, setAiCoursePreview] = useState<any | null>(null);
  const [contentForm, setContentForm] = useState({
    title: '',
    description: '',
    content: '',
    category: '',
    duration: '',
    difficulty_level: 'beginner',
    image_url: '',
    is_published: false,
    certificates_enabled: false,
    pass_threshold: 100
  });

  const handleContentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingContent ? `/api/educational-content/${editingContent.id}` : '/api/educational-content';
      const method = editingContent ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...contentForm,
          author_id: user?.id || 1
        }),
      });

      if (response.ok) {
        setShowContentForm(false);
        setEditingContent(null);
        setContentForm({
          title: '',
          description: '',
          content: '',
          category: '',
          duration: '',
          difficulty_level: 'beginner',
          image_url: '',
          is_published: false,
          certificates_enabled: false,
          pass_threshold: 100
        });
        loadAdminData();
        showToast(editingContent ? 'Mafunzo yamebadilishwa kwa mafanikio!' : 'Mafunzo yameongezwa kwa mafanikio!', 'success');
      }
    } catch (error) {
      console.error('Error saving content:', error);
      showToast('Hitilafu imetokea. Jaribu tena.', 'error');
    }
  };

  const handleViewContent = (content: any) => {
    setViewingContent(content);
  };

  const handleEditContent = (content: any) => {
    setEditingContent(content);
    setContentForm({
      title: content.title,
      description: content.description,
      content: content.content,
      category: content.category,
      duration: content.duration,
      difficulty_level: content.difficulty_level,
      image_url: content.image_url || '',
      is_published: content.is_published,
      certificates_enabled: content.certificates_enabled ?? false,
      pass_threshold: content.pass_threshold ?? 100
    });
    setShowContentForm(true);
  };

  const handleDeleteContent = async (contentId: number) => {
    try {
      const response = await fetch(`/api/educational-content/${contentId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        loadAdminData();
        showToast('Mafunzo yamefutwa kwa mafanikio!', 'success');
      } else {
        const responseData = await response.json();
        showToast(`Hitilafu: ${responseData.error || 'Imeshindwa kufuta'}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting content:', error);
      showToast('Hitilafu imetokea wakati wa kufuta.', 'error');
    }
  };

  const handleTogglePublish = async (contentId: number, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: contentId, 
          is_published: !currentStatus 
        })
      });
      
      if (response.ok) {
        loadAdminData();
        showToast(currentStatus ? 'Mafunzo yamefichwa!' : 'Mafunzo yamechapishwa!', 'success');
      }
    } catch (error) {
      console.error('Error toggling publish status:', error);
      showToast('Hitilafu imetokea.', 'error');
    }
  };

  const handleManageLessons = async (content: any) => {
    setManagingLessons(content);
    try {
      const response = await fetch(`/api/admin/educational-content/${content.id}/lessons`);
      if (response.ok) {
        const lessonsData = await response.json();
        setLessons(lessonsData);
      }
    } catch (error) {
      console.error('Error loading lessons:', error);
    }
  };

  const handleAiGenerateCourse = async (saveNow: boolean) => {
    if (!aiCoursePrompt.trim()) {
      showToast('Tafadhali andika mada ya kozi.', 'error'); return;
    }
    if (saveNow && !aiCoursePreview) {
      showToast('Tengeneza preview kwanza.', 'error'); return;
    }
    setAiCourseError(null);
    saveNow ? setAiCourseSaving(true) : setAiCourseGenerating(true);
    try {
      const res = await fetch('/api/admin/ai/generate-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicPrompt: aiCoursePrompt,
          language: aiCourseLang,
          difficulty: aiCourseDiff,
          lessonCount: aiCourseLessonCount,
          category: aiCourseCategory,
          authorId: user?.id,
          publishImmediately: saveNow,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAiCourseError(data?.error || 'Imeshindikana.'); return; }
      if (saveNow) {
        setShowAiCourseModal(false);
        setAiCoursePreview(null);
        setAiCoursePrompt('');
        loadAdminData();
        showToast(`Kozi "${data.course?.title}" imeundwa na masomo ${data.course?.lesson_count}!`, 'success');
      } else {
        setAiCoursePreview(data.course);
      }
    } catch {
      setAiCourseError('Hitilafu ya mtandao.');
    } finally {
      setAiCourseGenerating(false);
      setAiCourseSaving(false);
    }
  };

  const handleGenerateLessonsWithAI = async (saveToCourse: boolean) => {
    if (!managingLessons) return;

    if (!aiTopicPrompt.trim()) {
      showToast('Tafadhali andika maelezo ya mada unayotaka AI itengeneze.', 'error'); return;
    }

    if (saveToCourse && (!aiGeneratedLessons || aiGeneratedLessons.length === 0)) {
      showToast('Hakuna masomo ya kuhifadhi. Tafadhali tengeneza kwanza.', 'error'); return;
    }

    setAiError(null);
    saveToCourse ? setAiSaving(true) : setAiGenerating(true);

    try {
      const response = await fetch('/api/admin/ai/generate-lessons-anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: managingLessons.id,
          language: aiLanguage,
          lessonCount: aiLessonCount,
          difficulty: aiDifficulty,
          topicPrompt: aiTopicPrompt,
          lessonType: 'course_lesson',
          saveToCourse
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setAiError(data?.error || 'Imeshindikana kutengeneza masomo.');
        return;
      }

      if (saveToCourse) {
        setAiGeneratedLessons(null);
        setShowAiLessonGenerator(false);
        setAiTopicPrompt('');
        await handleManageLessons(managingLessons);
        showToast('Masomo yamehifadhiwa kwa mafanikio!', 'success');
        return;
      }

      setAiGeneratedLessons(Array.isArray(data?.lessons) ? data.lessons : []);
    } catch (error) {
      console.error('Error generating lessons with AI:', error);
      setAiError('Hitilafu imetokea wakati wa kutengeneza masomo.');
    } finally {
      setAiGenerating(false);
      setAiSaving(false);
    }
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingLesson 
        ? `/api/admin/educational-content/${managingLessons.id}/lessons/${editingLesson.id}`
        : `/api/admin/educational-content/${managingLessons.id}/lessons`;
      
      const method = editingLesson ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lessonForm)
      });

      if (response.ok) {
        setShowLessonForm(false);
        setEditingLesson(null);
        setLessonForm({
          language: 'sw',
          title: '',
          content: '',
          duration_minutes: 15,
          lesson_type: 'text',
          video_url: ''
        });
        // Reload lessons
        handleManageLessons(managingLessons);
        showToast(editingLesson ? 'Somo limebadilishwa kwa mafanikio!' : 'Somo limeongezwa kwa mafanikio!', 'success');
      }
    } catch (error) {
      console.error('Error saving lesson:', error);
      showToast('Hitilafu imetokea wakati wa kuhifadhi somo.', 'error');
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    try {
      const response = await fetch(`/api/admin/educational-content/${managingLessons.id}/lessons/${lessonId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        handleManageLessons(managingLessons);
        showToast('Somo limefutwa kwa mafanikio!', 'success');
      }
    } catch (error) {
      console.error('Error deleting lesson:', error);
      showToast('Hitilafu imetokea wakati wa kufuta somo.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Mafunzo na Elimu</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAiCourseModal(true); setAiCoursePreview(null); setAiCourseError(null); setAiCoursePrompt(''); }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-sm font-medium transition-colors"
          >
            ✦ AI Tengeneza Kozi
          </button>
          <button
            onClick={() => {
              setEditingContent(null);
              setContentForm({ title: '', description: '', content: '', category: '', duration: '', difficulty_level: 'beginner', image_url: '', is_published: false, certificates_enabled: false, pass_threshold: 100 });
              setShowContentForm(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
          >
            <PlusIcon className="h-4 w-4" /> Mafunzo Mapya
          </button>
        </div>
      </div>

      {/* AI Course Generator Modal */}
      {showAiCourseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#1a1a1a] border border-purple-500/20 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-semibold text-white">✦ AI Tengeneza Kozi Kamili</h3>
                  <p className="text-xs text-white/30 mt-0.5">Claude ataunda kichwa, maelezo, na masomo yote</p>
                </div>
                <button onClick={() => { setShowAiCourseModal(false); setAiCoursePreview(null); setAiCourseError(null); }} className="text-white/30 hover:text-white/60 text-2xl leading-none">×</button>
              </div>

              {!aiCoursePreview ? (
                <div className="space-y-4">
                  <div>
                    <label className={dkLabel}>Mada ya Kozi *</label>
                    <textarea
                      value={aiCoursePrompt}
                      onChange={e => setAiCoursePrompt(e.target.value)}
                      className={`${dkInput} resize-none`}
                      rows={3}
                      placeholder="Mfano: Jinsi ya kuanzisha na kukuza biashara ndogo Tanzania..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={dkLabel}>Lugha</label>
                      <select value={aiCourseLang} onChange={e => setAiCourseLang(e.target.value as 'sw'|'en')} className={dkSelect}>
                        <option value="sw">Swahili</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div>
                      <label className={dkLabel}>Kiwango</label>
                      <select value={aiCourseDiff} onChange={e => setAiCourseDiff(e.target.value as any)} className={dkSelect}>
                        <option value="beginner">Mwanzo</option>
                        <option value="intermediate">Kati</option>
                        <option value="advanced">Juu</option>
                      </select>
                    </div>
                    <div>
                      <label className={dkLabel}>Kategoria</label>
                      <select value={aiCourseCategory} onChange={e => setAiCourseCategory(e.target.value)} className={dkSelect}>
                        <option value="Biashara">Biashara</option>
                        <option value="Fedha">Fedha</option>
                        <option value="Uongozi">Uongozi</option>
                        <option value="Akiba">Akiba</option>
                        <option value="Teknolojia">Teknolojia</option>
                      </select>
                    </div>
                    <div>
                      <label className={dkLabel}>Idadi ya Masomo</label>
                      <input type="number" min={1} max={20} value={aiCourseLessonCount} onChange={e => setAiCourseLessonCount(parseInt(e.target.value||'1'))} className={dkInput} />
                    </div>
                  </div>
                  {aiCourseError && <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">{aiCourseError}</div>}
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowAiCourseModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-colors">Ghairi</button>
                    <button onClick={() => handleAiGenerateCourse(false)} disabled={aiCourseGenerating || !aiCoursePrompt.trim()} className="flex-1 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium disabled:opacity-40 transition-colors">
                      {aiCourseGenerating ? 'Inatengeneza...' : '✦ Tengeneza Preview'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 p-4">
                    <p className="text-xs text-purple-400 font-semibold mb-3">✦ Preview ya Kozi</p>
                    <h4 className="text-base font-bold text-white mb-1">{aiCoursePreview.title}</h4>
                    <p className="text-xs text-white/50 mb-2">{aiCoursePreview.description}</p>
                    <div className="flex items-center gap-3 text-xs text-white/30">
                      <span>{aiCoursePreview.category}</span>
                      <span>·</span>
                      <span>{aiCoursePreview.difficulty_level}</span>
                      <span>·</span>
                      <span>{aiCoursePreview.duration}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/40 mb-2">Masomo ({aiCoursePreview.lessons?.length})</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {aiCoursePreview.lessons?.map((l: any, i: number) => (
                        <div key={i} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-white">{i+1}. {l.title}</p>
                            <p className="text-[10px] text-white/25">{l.duration_minutes} min</p>
                          </div>
                          <p className="text-[10px] text-white/30 mt-1 line-clamp-2">{String(l.content||'').slice(0, 120)}...</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {aiCourseError && <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">{aiCourseError}</div>}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => { setAiCoursePreview(null); setAiCourseError(null); }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-colors">← Rudi</button>
                    <button onClick={() => handleAiGenerateCourse(true)} disabled={aiCourseSaving} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-40 transition-colors">
                      {aiCourseSaving ? 'Inahifadhi...' : '✓ Hifadhi Kozi na Masomo'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showContentForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#1a1a1a] border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-white">{editingContent ? 'Hariri Mafunzo' : 'Mafunzo Mapya'}</h3>
                <button onClick={() => { setShowContentForm(false); setEditingContent(null); }} className="text-white/30 hover:text-white/60 text-2xl leading-none">×</button>
              </div>
              <form onSubmit={handleContentSubmit} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><label className={dkLabel}>Kichwa cha Habari *</label><input type="text" value={contentForm.title} onChange={e => setContentForm({...contentForm, title: e.target.value})} className={dkInput} required /></div>
                  <div><label className={dkLabel}>Kategoria *</label>
                    <select value={contentForm.category} onChange={e => setContentForm({...contentForm, category: e.target.value})} className={dkSelect} required>
                      <option value="">Chagua Kategoria</option>
                      <option value="Biashara">Biashara</option>
                      <option value="Uongozi">Uongozi</option>
                      <option value="Fedha">Fedha</option>
                      <option value="Teknolojia">Teknolojia</option>
                    </select>
                  </div>
                </div>
                <div><label className={dkLabel}>Maelezo Mafupi *</label><textarea value={contentForm.description} onChange={e => setContentForm({...contentForm, description: e.target.value})} className={`${dkInput} resize-none`} rows={3} required /></div>
                <div><label className={dkLabel}>Maudhui Kamili *</label><textarea value={contentForm.content} onChange={e => setContentForm({...contentForm, content: e.target.value})} className={`${dkInput} resize-none`} rows={6} required /></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><label className={dkLabel}>Muda</label><input type="text" value={contentForm.duration} onChange={e => setContentForm({...contentForm, duration: e.target.value})} className={dkInput} placeholder="2 masaa" /></div>
                  <div><label className={dkLabel}>Kiwango</label>
                    <select value={contentForm.difficulty_level} onChange={e => setContentForm({...contentForm, difficulty_level: e.target.value})} className={dkSelect}>
                      <option value="beginner">Mwanzo</option>
                      <option value="intermediate">Kati</option>
                      <option value="advanced">Juu</option>
                    </select>
                  </div>
                  <div><label className={dkLabel}>URL ya Picha</label><input type="url" value={contentForm.image_url} onChange={e => setContentForm({...contentForm, image_url: e.target.value})} className={dkInput} /></div>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4 space-y-3">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Chaguo za Kozi</p>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={contentForm.is_published} onChange={e => setContentForm({...contentForm, is_published: e.target.checked})} className="accent-orange-500 w-4 h-4" />
                    <span className="text-sm text-white/60">Chapisha mara moja (inaonekana kwa wanachama)</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={contentForm.certificates_enabled} onChange={e => setContentForm({...contentForm, certificates_enabled: e.target.checked})} className="accent-orange-500 w-4 h-4" />
                    <div>
                      <span className="text-sm text-white/60">Toa Cheti cha Kukamilisha</span>
                      <p className="text-xs text-white/25 mt-0.5">Wanachama watapata cheti baada ya kukamilisha kozi</p>
                    </div>
                  </label>
                  {contentForm.certificates_enabled && (
                    <div className="pl-6">
                      <label className={dkLabel}>Kiwango cha Kupita (% ya masomo)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range" min={50} max={100} step={5}
                          value={contentForm.pass_threshold}
                          onChange={e => setContentForm({...contentForm, pass_threshold: parseInt(e.target.value)})}
                          className="flex-1 accent-orange-500"
                        />
                        <span className="text-sm font-semibold text-orange-400 w-12 text-right">{contentForm.pass_threshold}%</span>
                      </div>
                      <p className="text-xs text-white/20 mt-1">Mwanachama lazima akamilishe angalau {contentForm.pass_threshold}% ya masomo kupata cheti.</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => { setShowContentForm(false); setEditingContent(null); }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-colors">Ghairi</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">{editingContent ? 'Hifadhi Mabadiliko' : 'Hifadhi'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Content Modal */}
      {viewingContent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-[#1a1a1a] border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-white">{viewingContent.title}</h2>
                  <p className="text-xs text-white/30 mt-1">{viewingContent.category} · {viewingContent.difficulty_level} · {viewingContent.duration} dakika</p>
                </div>
                <button onClick={() => setViewingContent(null)} className="text-white/30 hover:text-white/60 text-2xl leading-none">×</button>
              </div>
              <div className="mb-4">
                <p className="text-xs font-semibold text-white/30 mb-2">Maelezo</p>
                <p className="text-sm text-white/60">{viewingContent.description}</p>
              </div>
              <div className="mb-5">
                <p className="text-xs font-semibold text-white/30 mb-2">Maudhui</p>
                <div className="text-sm text-white/50 whitespace-pre-wrap leading-relaxed">{viewingContent.content}</div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                <p className="text-xs text-white/25">Imeandikwa na {viewingContent.author_name} · {new Date(viewingContent.created_at).toLocaleDateString('sw-TZ')}</p>
                <div className="flex gap-2">
                  <button onClick={() => { setViewingContent(null); handleEditContent(viewingContent); }} className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 text-sm transition-colors">Hariri</button>
                  <button onClick={() => handleTogglePublish(viewingContent.id, viewingContent.is_published)} className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${viewingContent.is_published ? 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'}`}>
                    {viewingContent.is_published ? 'Ficha' : 'Chapisha'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Management Modal */}
      {managingLessons && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-[#1a1a1a] border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-semibold text-white">Dhibiti Masomo</h3>
                  <p className="text-xs text-white/30 mt-0.5">{managingLessons.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowAiLessonGenerator(s => !s); setAiError(null); setAiGeneratedLessons(null); }} className="px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-semibold border border-orange-500/20 transition-colors">AI Generate</button>
                  <button onClick={() => { setEditingLesson(null); setLessonForm({ language: 'sw', title: '', content: '', duration_minutes: 15, lesson_type: 'text', video_url: '' }); setShowLessonForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-semibold border border-blue-500/20 transition-colors"><PlusIcon className="h-3.5 w-3.5" /> Somo Jipya</button>
                  <button onClick={() => setManagingLessons(null)} className="text-white/30 hover:text-white/60 text-2xl leading-none">×</button>
                </div>
              </div>

              {showAiLessonGenerator && (
                <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-4 mb-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <p className="text-sm font-semibold text-orange-400">AI Lesson Generator</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><label className={dkLabel}>Lugha</label>
                          <select value={aiLanguage} onChange={e => setAiLanguage(e.target.value as 'sw'|'en')} className={dkSelect}>
                            <option value="sw">Swahili</option><option value="en">English</option>
                          </select>
                        </div>
                        <div><label className={dkLabel}>Kiwango</label>
                          <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value as any)} className={dkSelect}>
                            <option value="beginner">Mwanzo</option><option value="intermediate">Kati</option><option value="advanced">Juu</option>
                          </select>
                        </div>
                        <div><label className={dkLabel}>Idadi ya Masomo</label>
                          <input type="number" min={1} max={20} value={aiLessonCount} onChange={e => setAiLessonCount(parseInt(e.target.value||'1'))} className={dkInput} />
                        </div>
                        <div className="flex items-end">
                          <button onClick={() => handleGenerateLessonsWithAI(false)} disabled={aiGenerating||aiSaving} className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors">
                            {aiGenerating ? 'Inatengeneza...' : 'Preview'}
                          </button>
                        </div>
                      </div>
                      <div><label className={dkLabel}>Mada ya Masomo</label>
                        <textarea value={aiTopicPrompt} onChange={e => setAiTopicPrompt(e.target.value)} className={`${dkInput} resize-none`} rows={2} placeholder="Mfano: Financial Basics — budgeting, saving..." />
                      </div>
                      {aiError && <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">{aiError}</div>}
                      {aiGeneratedLessons && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-white/40">Preview ({aiGeneratedLessons.length} masomo)</p>
                            <button onClick={() => handleGenerateLessonsWithAI(true)} disabled={aiSaving||aiGenerating} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 disabled:opacity-40">
                              {aiSaving ? 'Inahifadhi...' : 'Hifadhi Kwa Kozi'}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {aiGeneratedLessons.map((l: any, i: number) => (
                              <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-semibold text-white">{l.title}</p>
                                  <p className="text-[10px] text-white/25">{l.duration_minutes} min · {aiLanguage.toUpperCase()}</p>
                                </div>
                                <p className="text-[10px] text-white/30 whitespace-pre-wrap">{String(l.content||'').slice(0,300)}{String(l.content||'').length>300?'...':''}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => { setShowAiLessonGenerator(false); setAiError(null); setAiGeneratedLessons(null); }} className="text-white/30 hover:text-white/60 text-xl leading-none">×</button>
                  </div>
                </div>
              )}

              {showLessonForm && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 mb-5">
                  <p className="text-sm font-semibold text-white mb-3">{editingLesson ? 'Hariri Somo' : 'Somo Jipya'}</p>
                  <form onSubmit={handleLessonSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div><label className={dkLabel}>Kichwa cha Somo *</label><input type="text" value={lessonForm.title} onChange={e => setLessonForm({...lessonForm, title: e.target.value})} className={dkInput} required /></div>
                      <div><label className={dkLabel}>Muda (Dakika) *</label><input type="number" value={lessonForm.duration_minutes} onChange={e => setLessonForm({...lessonForm, duration_minutes: parseInt(e.target.value)})} className={dkInput} min="1" required /></div>
                    </div>
                    <div><label className={dkLabel}>Lugha</label>
                      <select value={(lessonForm as any).language||'sw'} onChange={e => setLessonForm({...(lessonForm as any), language: e.target.value})} className={dkSelect}>
                        <option value="sw">Swahili</option><option value="en">English</option>
                      </select>
                    </div>
                    <div><label className={dkLabel}>Maudhui ya Somo *</label><textarea value={lessonForm.content} onChange={e => setLessonForm({...lessonForm, content: e.target.value})} className={`${dkInput} resize-none`} rows={6} placeholder="Andika maudhui ya somo hapa..." required /></div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setShowLessonForm(false); setEditingLesson(null); }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-colors">Ghairi</button>
                      <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">{editingLesson ? 'Hifadhi Mabadiliko' : 'Hifadhi Somo'}</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs font-semibold text-white/40">Masomo ({lessons.length})</p>
                {lessons.length > 0 ? lessons.map(lesson => (
                  <div key={lesson.id} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold">#{lesson.lesson_order}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30 font-semibold">{(lesson.language||'sw').toUpperCase()}</span>
                          <span className="text-[10px] text-white/25">{lesson.duration_minutes} dakika</span>
                        </div>
                        <p className="text-sm font-semibold text-white mb-1">{lesson.title}</p>
                        <p className="text-xs text-white/30 line-clamp-2">{lesson.content.substring(0,200)}...</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => { setEditingLesson(lesson); setLessonForm({ language: lesson.language||'sw', title: lesson.title, content: lesson.content, duration_minutes: lesson.duration_minutes, lesson_type: lesson.lesson_type, video_url: lesson.video_url||'' }); setShowLessonForm(true); }} className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/10 text-white/30 hover:text-emerald-400 transition-colors"><PencilIcon className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDeleteLesson(lesson.id)} className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"><TrashIcon className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10">
                    <BookOpenIcon className="h-8 w-8 mx-auto text-white/10 mb-3" />
                    <p className="text-sm text-white/25">Hakuna masomo bado</p>
                    <p className="text-xs text-white/15 mt-1">Bonyeza &ldquo;Somo Jipya&rdquo; kuanza</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Table */}
      <div className="rounded-xl bg-[#141414] border border-white/[0.06] overflow-hidden">
        <table className="min-w-full">
          <thead><tr className="border-b border-white/[0.06]">
            {['Mafunzo','Hali','Mwandishi','Tarehe','Vitendo'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-white/30 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-white/[0.04]">
            {educationalContent.length > 0 ? educationalContent.map(c => (
              <tr key={c.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-white">{c.title}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{c.category} · {c.difficulty_level} · {c.duration} dakika</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${c.is_published ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                    {c.is_published ? 'Imechapishwa' : 'Rasimu'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-white/40">{c.author_name}</td>
                <td className="px-4 py-3 text-xs text-white/25">{new Date(c.created_at).toLocaleDateString('sw-TZ')}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleViewContent(c)} className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-500/10 text-white/30 hover:text-blue-400 transition-colors"><EyeIcon className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleEditContent(c)} className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/10 text-white/30 hover:text-emerald-400 transition-colors"><PencilIcon className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleManageLessons(c)} className="p-1.5 rounded-lg bg-white/5 hover:bg-purple-500/10 text-white/30 hover:text-purple-400 transition-colors"><BookOpenIcon className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDeleteContent(c.id)} className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"><TrashIcon className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-12 text-center">
                <BookOpenIcon className="h-8 w-8 mx-auto text-white/10 mb-3" />
                <p className="text-sm text-white/25">Hakuna mafunzo bado</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JoinRequestsSection({ joinRequests, loadAdminData, showToast }: { joinRequests: any[]; loadAdminData: () => void; showToast: (msg: string, type?: any) => void }) {
  const [processingRequest, setProcessingRequest] = useState<number | null>(null);

  const handleApproveRequest = async (requestId: number) => {
    setProcessingRequest(requestId);
    try {
      const res = await fetch('/api/admin/join-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'approve', reviewerId: 1, notes: 'Approved by admin' })
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message || 'Ombi limekubaliwa!', 'success'); loadAdminData(); }
      else showToast(data.error || 'Hitilafu imetokea', 'error');
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
    finally { setProcessingRequest(null); }
  };

  const handleRejectRequest = async (requestId: number) => {
    const reason = prompt('Sababu ya kukataa (si lazima):');
    setProcessingRequest(requestId);
    try {
      const res = await fetch('/api/admin/join-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'reject', reviewerId: 1, notes: reason || 'Rejected by admin' })
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message || 'Ombi limekataliwa', 'success'); loadAdminData(); }
      else showToast(data.error || 'Hitilafu imetokea', 'error');
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
    finally { setProcessingRequest(null); }
  };

  const pending = joinRequests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white">Maombi ya Kujiunga</h2>
        {pending.length > 0 && (
          <span className="text-[10px] font-bold bg-orange-500 text-white rounded-full px-2 py-0.5">{pending.length} Inasubiri</span>
        )}
      </div>

      {joinRequests.length === 0 ? (
        <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-12 text-center">
          <UserGroupIcon className="h-8 w-8 mx-auto text-white/10 mb-3" />
          <p className="text-sm text-white/25">Hakuna maombi ya kujiunga kwa sasa</p>
        </div>
      ) : (
        <div className="space-y-3">
          {joinRequests.map(req => (
            <div key={req.id} className={`rounded-xl border p-4 ${req.status === 'pending' ? 'bg-[#141414] border-orange-500/20' : 'bg-[#141414] border-white/[0.06]'}`}>
              {req.data_validation && req.data_validation !== 'OK' && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                  ⚠ {req.data_validation} · ID: {req.id}
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white">{req.member_name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {req.status === 'pending' ? 'Inasubiri' : req.status === 'approved' ? 'Imekubaliwa' : 'Imekataliwa'}
                    </span>
                  </div>
                  <p className="text-xs text-white/40">Kujiunga na: <span className="text-white/60 font-medium">{req.group_name}</span></p>
                  <p className="text-xs text-white/30 mt-0.5">{req.member_email}{req.member_phone ? ` · ${req.member_phone}` : ''}</p>
                  <p className="text-[10px] text-white/20 mt-1">{new Date(req.created_at).toLocaleDateString('sw-TZ')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-orange-400">TSH {parseInt(req.monthly_contribution||0).toLocaleString()}/mwezi</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Kiongozi: {req.leader_name || '—'}</p>
                </div>
              </div>

              {req.message && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-white/40"><span className="text-white/25">Ujumbe:</span> {req.message}</p>
                </div>
              )}

              {req.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleApproveRequest(req.id)}
                    disabled={processingRequest === req.id}
                    className="flex-1 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 disabled:opacity-40 transition-colors"
                  >
                    {processingRequest === req.id ? 'Inakubali...' : 'Kubali'}
                  </button>
                  <button
                    onClick={() => handleRejectRequest(req.id)}
                    disabled={processingRequest === req.id}
                    className="flex-1 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 disabled:opacity-40 transition-colors"
                  >
                    {processingRequest === req.id ? 'Inakataa...' : 'Kataa'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsSection() {
  return (
    <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-5">
      <h2 className="text-base font-semibold text-white mb-5">Mipangilio ya Mfumo</h2>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-white/40 mb-3">Mipangilio ya Jumla</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-sm text-white/60">Kiwango cha Hisa (%)</span>
              <input type="number" defaultValue="30" className="w-20 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white text-right focus:outline-none focus:border-orange-500/50" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-sm text-white/60">Ada ya Mwezi (TSH)</span>
              <input type="number" defaultValue="50000" className="w-32 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white text-right focus:outline-none focus:border-orange-500/50" />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-white/40 mb-3">Arifa</p>
          <div className="space-y-2">
            {['Arifa za barua pepe kwa wanachama wapya', 'Ripoti za kila wiki'].map((label, i) => (
              <label key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-orange-500" />
                <span className="text-sm text-white/60">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <button className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
          Hifadhi Mabadiliko
        </button>
      </div>
    </div>
  );
}
