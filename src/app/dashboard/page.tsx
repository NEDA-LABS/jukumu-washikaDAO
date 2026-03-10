'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  UserGroupIcon, PlusIcon, UsersIcon, CurrencyDollarIcon, ChartBarIcon, BookOpenIcon,
  DocumentTextIcon, CogIcon, ArrowRightOnRectangleIcon, EyeIcon, PencilIcon, TrashIcon, UserMinusIcon
} from '@heroicons/react/24/outline';
import NotificationCenter from '@/components/NotificationCenter';
import GrowthChart from '@/components/GrowthChart';

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'members', name: 'Members', icon: UsersIcon },
    { name: 'Groups', id: 'groups', icon: UserGroupIcon },
    { name: 'Join Requests', id: 'join-requests', icon: UserGroupIcon },
    { name: 'Investments', id: 'investments', icon: CurrencyDollarIcon },
    { name: 'Training', id: 'content', icon: BookOpenIcon },
    { name: 'Reports', id: 'reports', icon: DocumentTextIcon },
    { name: 'Settings', id: 'settings', icon: CogIcon },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewSection adminStats={adminStats} recentActivities={recentActivities} />;
      case 'members':
        return <MembersSection members={members} groups={groups} loadAdminData={loadAdminData} />;
      case 'groups':
        return <GroupsSection groups={groups} loadAdminData={loadAdminData} />;
      case 'join-requests':
        return <JoinRequestsSection joinRequests={joinRequests} loadAdminData={loadAdminData} />;
      case 'investments':
        return <InvestmentsSection investments={investments} groups={groups} loadAdminData={loadAdminData} />;
      case 'content':
        return <ContentSection educationalContent={educationalContent} user={user} loadAdminData={loadAdminData} />;
      case 'reports':
        return <ReportsSection adminStats={adminStats} />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <OverviewSection adminStats={adminStats} recentActivities={recentActivities} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashibodi ya Msimamizi</h1>
              <p className="mt-1 text-sm text-gray-500">Simamia mfumo wa Washika DAU</p>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationCenter userId={1} className="" />
              <span className="text-sm text-gray-500">Welcome, Msimamizi</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="bg-white rounded-lg shadow-sm p-4">
              <ul className="space-y-2">
                {menuItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-200 ${
                        activeSection === item.id
                          ? 'bg-orange-100 text-orange-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : (
              renderContent()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewSection({ adminStats, recentActivities }: { adminStats: any; recentActivities: any[] }) {
  const stats = [
    { 
      name: 'Jumla ya Members', 
      value: adminStats?.totalMembers?.toLocaleString() || '0', 
      change: adminStats?.newMembersThisMonth ? `+${adminStats.newMembersThisMonth} mwezi huu` : '+0%', 
      color: 'bg-blue-500' 
    },
    { 
      name: 'Groups Vya Kazi', 
      value: adminStats?.totalGroups?.toLocaleString() || '0', 
      change: adminStats?.newGroupsThisMonth ? `+${adminStats.newGroupsThisMonth} mwezi huu` : '+0%', 
      color: 'bg-green-500' 
    },
    { 
      name: 'Uwekezaji wa Jumla', 
      value: adminStats?.totalInvestment ? `TSH ${(adminStats.totalInvestment / 1000000).toFixed(1)}M` : 'TSH 0', 
      change: `${adminStats?.returnRate || 0}% mapato`, 
      color: 'bg-orange-500' 
    },
    { 
      name: 'Mapato ya Jumla', 
      value: adminStats?.totalReturns ? `TSH ${(adminStats.totalReturns / 1000000).toFixed(1)}M` : 'TSH 0', 
      change: `${adminStats?.returnRate || 0}% kiwango`, 
      color: 'bg-red-500' 
    },
  ];

  const displayActivities = recentActivities?.slice(0, 4).map(activity => ({
    action: activity.action,
    user: activity.user_name,
    time: new Date(activity.activity_date).toLocaleDateString('sw-TZ')
  })) || [];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center mr-4`}>
                <ChartBarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-green-600">{stat.change}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ukuaji wa Members</h3>
          <GrowthChart 
            memberCount={adminStats?.totalMembers || 0}
            groupCount={adminStats?.totalGroups || 0}
          />
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Shughuli za Hivi Welcomeni</h3>
          <div className="space-y-4">
            {displayActivities.length > 0 ? (
              displayActivities.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-600">{activity.user} • {activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No shughuli za hivi karibuni</p>
                <p className="text-gray-400 text-xs mt-1">Shughuli zitaonekana hapa baada ya kuanza kutumia mfumo</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MembersSection({ members, groups, loadAdminData }: { members: any[]; groups: any[]; loadAdminData: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [editingMember, setEditingMember] = useState<any>(null);
  const [memberForm, setMemberForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    businessType: '',
    idType: '',
    idNumber: '',
    gender: '',
    age: ''
  });
  
  const filteredMembers = members.filter(member => {
    const term = searchTerm.toLowerCase();
    const name = String(member?.full_name || '').toLowerCase();
    const email = String(member?.email || '').toLowerCase();
    const matchesSearch = name.includes(term) || email.includes(term);
    const matchesStatus = !statusFilter || member.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (memberId: number, newStatus: string) => {
    try {
      await fetch('/api/admin/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberId, status: newStatus })
      });
      loadAdminData();
    } catch (error) {
      console.error('Error updating member status:', error);
    }
  };

  const handleAddToGroup = async (memberId: number, groupId: number, selectElement?: HTMLSelectElement) => {
    try {
      console.log('Adding member to group:', { memberId, groupId });
      
      const response = await fetch('/api/admin/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberId, groupId })
      });
      
      const data = await response.json();
      console.log('API response:', data);
      
      if (response.ok && data.success) {
        // Reset the dropdown
        if (selectElement) {
          selectElement.value = '';
        }
        
        loadAdminData();
        alert(data.message || 'Mmembers ameongezwa kwenye kundi kwa mafanikio!');
      } else {
        console.error('API error:', data);
        alert(data.error || 'Hitilafu imetokea wakati wa kuongeza mmembers kwenye kundi.');
        
        // Reset the dropdown on error too
        if (selectElement) {
          selectElement.value = '';
        }
      }
    } catch (error) {
      console.error('Network error adding member to group:', error);
      alert('Hitilafu ya mtandao. Hakikisha una muunganisho wa mtandao na jaribu tena.');
      
      // Reset the dropdown on error
      if (selectElement) {
        selectElement.value = '';
      }
    }
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: memberForm.fullName,
          contact: memberForm.email || memberForm.phone,
          location: memberForm.location,
          businessType: memberForm.businessType,
          groupName: '', // No group for admin-added members initially
          gender: memberForm.gender,
          age: parseInt(memberForm.age)
        }),
      });

      if (response.ok) {
        setShowMemberForm(false);
        setMemberForm({
          fullName: '',
          email: '',
          phone: '',
          location: '',
          businessType: '',
          idType: '',
          idNumber: '',
          gender: '',
          age: ''
        });
        loadAdminData();
        alert('Mmembers ameongezwa kwa mafanikio!');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Hitilafu imetokea. Jaribu tena.');
    }
  };

  const handleDeleteMember = async (member: any) => {
    const confirmDelete = window.confirm(
      `Je, una uhakika unataka kufuta mmembers "${member.full_name}"?\n\nHii itafuta:\n- Taarifa zote za mmembers\n- Historia ya michango\n- Maendeleo ya mafunzo\n- Ripoti za biashara\n\nHatua hii haiwezi kurudishwa!`
    );
    
    if (!confirmDelete) return;
    
    try {
      const response = await fetch('/api/admin/members', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: member.id }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        loadAdminData();
        alert(data.message || 'Mmembers amefutwa kwa mafanikio!');
      } else {
        alert(data.error || 'Hitilafu imetokea wakati wa kufuta mmembers.');
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Hitilafu imetokea. Hakikisha una muunganisho wa mtandao na jaribu tena.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Usimamizi wa Members</h2>
          <button 
            onClick={() => setShowMemberForm(true)}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center space-x-2"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Add Mmembers</span>
          </button>
        </div>

      {/* Search */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Search mmembers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          <option value="">Hali zote</option>
          <option value="active">Hai</option>
          <option value="pending">Inasubiri</option>
          <option value="inactive">Haifanyi kazi</option>
        </select>
      </div>

      {/* Members Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mmembers</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hali</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarehe ya Kujiunge</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vitendo</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{member.full_name}</div>
                      <div className="text-sm text-gray-500">{member.email}</div>
                      <div className="text-sm text-gray-500">{member.phone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {member.group_names || 'No kundi'}
                      {member.group_count > 0 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {member.group_count} {member.group_count === 1 ? 'kundi' : 'groups'}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{member.business_type}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={member.status}
                      onChange={(e) => handleStatusChange(member.id, e.target.value)}
                      className={`px-2 py-1 text-xs font-semibold rounded-full border-0 ${
                        member.status === 'active' ? 'bg-green-100 text-green-800' : 
                        member.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      <option value="pending">Inasubiri</option>
                      <option value="active">Hai</option>
                      <option value="inactive">Haifanyi kazi</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(member.created_at).toLocaleDateString('sw-TZ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddToGroup(member.id, parseInt(e.target.value), e.target as HTMLSelectElement);
                          }
                        }}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                        defaultValue=""
                      >
                        <option value="">Add kwenye kundi</option>
                        {groups.filter(g => g.status === 'active').map(group => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                      {member.status === 'inactive' && (
                        <button
                          onClick={() => handleDeleteMember(member)}
                          className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition-colors duration-200"
                          title="Delete Mmembers"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="text-gray-500">
                    <p className="text-lg font-medium">No members bado</p>
                    <p className="text-sm mt-1">Members wataonekana hapa baada ya kujisajili kwenye tovuti</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Add Member Form Modal */}
      {showMemberForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Mmembers Mpya</h3>
          <form onSubmit={handleMemberSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jina Kamili *
                </label>
                <input
                  type="text"
                  value={memberForm.fullName}
                  onChange={(e) => setMemberForm({...memberForm, fullName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Barua Pepe
                </label>
                <input
                  type="email"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({...memberForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nambari ya Simu
                </label>
                <input
                  type="tel"
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({...memberForm, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mahali *
                </label>
                <input
                  type="text"
                  value={memberForm.location}
                  onChange={(e) => setMemberForm({...memberForm, location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aina ya Biashara *
                </label>
                <select
                  value={memberForm.businessType}
                  onChange={(e) => setMemberForm({...memberForm, businessType: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  required
                >
                  <option value="">Chagua aina ya biashara</option>
                  <option value="kilimo">Kilimo</option>
                  <option value="ufugaji">Ufugaji</option>
                  <option value="biashara_ndogo">Biashara Ndogo</option>
                  <option value="sanaa">Sanaa na Ubunifu</option>
                  <option value="huduma">Huduma</option>
                  <option value="teknolojia">Teknolojia</option>
                  <option value="nyingine">Nyingine</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jinsia *
                </label>
                <select
                  value={memberForm.gender}
                  onChange={(e) => setMemberForm({...memberForm, gender: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  required
                >
                  <option value="">Chagua jinsia</option>
                  <option value="mwanamke">Mwanamke</option>
                  <option value="mwanamume">Mwanamume</option>
                </select>
              </div>
            </div>
            
            <div className="md:w-1/2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Umri *
              </label>
              <input
                type="number"
                value={memberForm.age}
                onChange={(e) => setMemberForm({...memberForm, age: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                min="18"
                max="100"
                required
              />
            </div>
            
            <div className="flex space-x-4">
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Save Mmembers
              </button>
              <button
                type="button"
                onClick={() => setShowMemberForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function GroupsSection({ groups, loadAdminData }: { groups: any[]; loadAdminData: () => void }) {
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
        
        alert(data.message || 'Nafasi ya uongozi imebadilishwa kwa mafanikio!');
      } else {
        alert(data.error || 'Hitilafu imetokea wakati wa kubadilisha nafasi ya uongozi.');
      }
    } catch (error) {
      console.error('Error updating member role:', error);
      alert('Hitilafu imetokea. Hakikisha una muunganisho wa mtandao na jaribu tena.');
    }
  };

  const handleRemoveFromGroup = async (memberId: number, memberName: string) => {
    if (!selectedGroup) return;
    
    const confirmRemove = window.confirm(
      `Je, una uhakika unataka kuondoa "${memberName}" kwenye kundi "${selectedGroup.name}"?\n\nMmembers ataendelea kuwa kwenye mfumo lakini hataonekana kwenye kundi hili tena.`
    );
    
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
        
        alert(data.message || 'Mmembers ameondolewa kwenye kundi kwa mafanikio!');
      } else {
        alert(data.error || 'Hitilafu imetokea wakati wa kuondoa mmembers kwenye kundi.');
      }
    } catch (error) {
      console.error('Error removing member from group:', error);
      alert('Hitilafu imetokea. Hakikisha una muunganisho wa mtandao na jaribu tena.');
    }
  };

  const handleDeleteGroup = async (group: any) => {
    const confirmDelete = window.confirm(
      `Je, una uhakika unataka kufuta kundi "${group.name}"?\n\nHii itafuta:\n- Group lote\n- Historia ya michango\n- Rekodi za uwekezaji\n- Maombi ya kujiunga\n\nHatua hii haiwezi kurudishwa!`
    );
    
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
        alert(data.message || 'Group limefutwa kwa mafanikio!');
      } else {
        alert(data.error || 'Hitilafu imetokea wakati wa kufuta kundi.');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Hitilafu imetokea. Hakikisha una muunganisho wa mtandao na jaribu tena.');
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
        alert('Group limebadilishwa kwa mafanikio!');
        setShowEditGroup(false);
        setShowGroupDetails(false);
        loadAdminData(); // Refresh the data
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Hitilafu imetokea wakati wa kubadilisha kundi.');
      }
    } catch (error) {
      console.error('Error updating group:', error);
      alert('Hitilafu imetokea wakati wa kubadilisha kundi.');
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
        alert(data.message || 'Group limeanzishwa kwa mafanikio!');
      } else {
        alert(data.error || 'Hitilafu imetokea wakati wa kuanzisha kundi.');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Hitilafu imetokea. Hakikisha una muunganisho wa mtandao na jaribu tena.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Usimamizi wa Groups</h2>
        <button 
          onClick={() => setShowGroupForm(true)}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Anzisha Group Jipya</span>
        </button>
      </div>

      {/* Group Creation Form Modal */}
      {showGroupForm && (
        <div className="mb-6 bg-white rounded-lg shadow p-6 border border-orange-200">
          <h3 className="text-lg font-semibold mb-4">Anzisha Group Jipya</h3>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jina la Group *
                </label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({...groupForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                  placeholder="Ingiza jina la kundi"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kiongozi wa Group
                </label>
                <select
                  value={groupForm.leaderId}
                  onChange={(e) => setGroupForm({...groupForm, leaderId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
                >
                  <option value="">Chagua kiongozi</option>
                  {members.filter(m => m.status === 'active').map(member => (
                    <option key={member.id} value={member.id}>{member.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mchango wa Kila Mwezi (TSH) *
                </label>
                <input
                  type="number"
                  value={groupForm.monthlyContribution}
                  onChange={(e) => setGroupForm({...groupForm, monthlyContribution: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                  placeholder="50000"
                  min="1000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tarehe ya Kuanzishwa *
                </label>
                <input
                  type="date"
                  value={groupForm.foundedDate}
                  onChange={(e) => setGroupForm({...groupForm, foundedDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
                  required
                />
              </div>
            </div>
            
            <div className="flex space-x-4">
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200"
              >
                Anzisha Group
              </button>
              <button
                type="button"
                onClick={() => setShowGroupForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.length > 0 ? (
          groups.map((group) => (
            <div key={group.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-200">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  group.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {group.status === 'active' ? 'Hai' : 'Inasubiri'}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p><strong>Members:</strong> {group.member_count || 0}</p>
                <p><strong>Kiongozi:</strong> {group.leader_name || 'No'}</p>
                <p><strong>Uwekezaji:</strong> TSH {parseFloat(group.total_investment || 0).toLocaleString()}</p>
                <p><strong>Mchango wa Kila Mwezi:</strong> TSH {parseFloat(group.monthly_contribution || 0).toLocaleString()}</p>
              </div>
              
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleViewGroup(group)}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors duration-200"
                >
                  View
                </button>
                <button 
                  onClick={() => handleEditGroup(group)}
                  className="flex-1 bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700 transition-colors duration-200"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDeleteGroup(group)}
                  className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition-colors duration-200"
                  title="Delete Group"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-500">
              <UserGroupIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No groups bado</p>
              <p className="text-sm mt-1">Groups vitaonekana hapa baada ya kuanzishwa</p>
            </div>
          </div>
        )}
      </div>

      {/* Group Details Modal */}
      {showGroupDetails && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedGroup.name}</h2>
                  <p className="text-gray-600">Maelezo ya kundi</p>
                </div>
                <button
                  onClick={() => setShowGroupDetails(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Group Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-900">Members</h3>
                  <p className="text-2xl font-bold text-blue-600">{selectedGroup.member_count || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-green-900">Mchango wa Mwezi</h3>
                  <p className="text-lg font-bold text-green-600">TSH {parseFloat(selectedGroup.monthly_contribution || 0).toLocaleString()}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-orange-900">Uwekezaji wa Jumla</h3>
                  <p className="text-lg font-bold text-orange-600">TSH {parseFloat(selectedGroup.total_investment || 0).toLocaleString()}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-purple-900">Hali</h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    selectedGroup.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedGroup.status === 'active' ? 'Hai' : 'Inasubiri'}
                  </span>
                </div>
              </div>

              {/* Group Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Maelezo ya Group</h3>
                  <div className="space-y-2 text-sm text-gray-900">
                    <p className="text-gray-900"><strong className="text-gray-900">Kiongozi:</strong> {selectedGroup.leader_name || 'No'}</p>
                    <p className="text-gray-900"><strong className="text-gray-900">Tarehe ya Kuanzishwa:</strong> {selectedGroup.founded_date ? new Date(selectedGroup.founded_date).toLocaleDateString('sw-TZ') : 'Haijajulikana'}</p>
                    <p className="text-gray-900"><strong className="text-gray-900">Tarehe ya Kutengenezwa:</strong> {new Date(selectedGroup.created_at).toLocaleDateString('sw-TZ')}</p>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Takwimu za Fedha</h3>
                  <div className="space-y-2 text-sm text-gray-900">
                    <p className="text-gray-900"><strong className="text-gray-900">Mchango wa Kila Mwezi:</strong> TSH {parseFloat(selectedGroup.monthly_contribution || 0).toLocaleString()}</p>
                    <p className="text-gray-900"><strong className="text-gray-900">Uwekezaji wa Jumla:</strong> TSH {parseFloat(selectedGroup.total_investment || 0).toLocaleString()}</p>
                    <p className="text-gray-900"><strong className="text-gray-900">Jumla ya Michango:</strong> TSH {(parseFloat(selectedGroup.monthly_contribution || 0) * (selectedGroup.member_count || 0)).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Group Members */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Members wa Group</h3>
                </div>
                <div className="p-4">
                  {groupMembers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jina</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nafasi</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarehe ya Kujiunge</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hali</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Badilisha Nafasi</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ondoa</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {groupMembers.map((member) => (
                            <tr key={member.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{member.full_name}</div>
                                  <div className="text-sm text-gray-500">{member.email}</div>
                                </div>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  member.role === 'leader' ? 'bg-blue-100 text-blue-800' : 
                                  member.role === 'mwenyekiti' ? 'bg-purple-100 text-purple-800' :
                                  member.role === 'katibu' ? 'bg-green-100 text-green-800' :
                                  member.role === 'mwekahazina' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {member.role === 'leader' ? 'Kiongozi' : 
                                   member.role === 'mwenyekiti' ? 'Mwenyekiti' :
                                   member.role === 'katibu' ? 'Katibu' :
                                   member.role === 'mwekahazina' ? 'MwekaHazina' :
                                   'Mmembers'}
                                </span>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                {member.joined_date ? new Date(member.joined_date).toLocaleDateString('sw-TZ') : 'Haijajulikana'}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {member.status === 'active' ? 'Hai' : 'Haifanyi kazi'}
                                </span>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <select
                                  value={member.role}
                                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                >
                                  <option value="member">Mmembers</option>
                                  <option value="leader">Kiongozi</option>
                                  <option value="mwenyekiti">Mwenyekiti</option>
                                  <option value="katibu">Katibu</option>
                                  <option value="mwekahazina">MwekaHazina</option>
                                </select>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <button
                                  onClick={() => handleRemoveFromGroup(member.id, member.full_name)}
                                  className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition-colors duration-200"
                                  title="Ondoa kwenye Group"
                                >
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
                      <UsersIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">No members bado</p>
                      <p className="text-sm text-gray-400 mt-1">Members wataonekana hapa baada ya kuongezwa kwenye kundi</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Proposals */}
              <div className="bg-white border border-gray-200 rounded-lg mt-6">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Proposals</h3>
                </div>
                <div className="p-4">
                  {groupProposals.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Votes</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {groupProposals.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <div className="text-sm font-medium text-gray-900">{p.title}</div>
                                {p.description ? <div className="text-xs text-gray-500 mt-0.5">{p.description}</div> : null}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  p.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                <div className="text-xs text-gray-700">Yes: {p.yes_votes || 0}</div>
                                <div className="text-xs text-gray-700">No: {p.no_votes || 0}</div>
                                <div className="text-xs text-gray-700">Abstain: {p.abstain_votes || 0}</div>
                                <div className="text-xs text-gray-500">Total: {p.total_votes || 0}</div>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{p.created_by_name || '—'}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                {p.created_at ? new Date(p.created_at).toLocaleDateString('sw-TZ') : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">No proposals bado</p>
                      <p className="text-sm text-gray-400 mt-1">Proposals zitaonekana hapa baada ya kuanzishwa</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Wallet & Transfers */}
              <div className="bg-white border border-gray-200 rounded-lg mt-6">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Wallet & Transaction History</h3>
                </div>
                <div className="p-4 space-y-4">
                  {groupWallet ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-900"><strong className="text-gray-900">Network:</strong> {groupWallet.network || '—'}</div>
                        <div className="text-sm text-gray-900 mt-1"><strong className="text-gray-900">Address:</strong> {groupWallet.address || '—'}</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-900"><strong className="text-gray-900">USDC:</strong> {groupWalletBalances?.usdc?.amountBaseUnits ?? '—'}</div>
                        <div className="text-sm text-gray-900 mt-1"><strong className="text-gray-900">ETH:</strong> {groupWalletBalances?.eth?.amountBaseUnits ?? '—'}</div>
                        {groupWalletWarning ? (
                          <div className="text-xs text-orange-700 mt-2">{groupWalletWarning}</div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <CurrencyDollarIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-500">No wallet bado</p>
                    </div>
                  )}

                  <div className="border border-gray-200 rounded-lg">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900">Transfers</h4>
                    </div>
                    <div className="p-4">
                      {groupTransfers.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (base units)</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approvals</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tx Hash</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {groupTransfers.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-xs text-gray-900">{t.to_address}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{String(t.amount_base_units ?? '')}</td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      t.status === 'executed' ? 'bg-green-100 text-green-800' :
                                      t.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                      t.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {t.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                    {t.approval_count ?? 0}/{t.approvals_required ?? 0}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-gray-900">{t.executed_tx_hash || '—'}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                    {t.created_at ? new Date(t.created_at).toLocaleDateString('sw-TZ') : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-gray-500">No transfers bado</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  onClick={() => setShowGroupDetails(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                >
                  Funga
                </button>
                <button 
                  onClick={() => handleEditGroup(selectedGroup)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200"
                >
                  Edit Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroup && editingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Edit Group</h2>
                <button
                  onClick={() => setShowEditGroup(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleUpdateGroup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Jina la Group</label>
                  <input
                    type="text"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm({...groupForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Kiongozi</label>
                  <select
                    value={groupForm.leaderId}
                    onChange={(e) => setGroupForm({...groupForm, leaderId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Chagua Kiongozi</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Mchango wa Kila Mwezi (TSH)</label>
                  <input
                    type="number"
                    value={groupForm.monthlyContribution}
                    onChange={(e) => setGroupForm({...groupForm, monthlyContribution: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Tarehe ya Kuanzishwa</label>
                  <input
                    type="date"
                    value={groupForm.foundedDate}
                    onChange={(e) => setGroupForm({...groupForm, foundedDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditGroup(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200"
                  >
                    Badilisha
                  </button>
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
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Usimamizi wa Uwekezaji</h2>
        <button 
          onClick={() => setShowInvestmentForm(true)}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Uwekezaji Mpya</span>
        </button>
      </div>

      {/* Investment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900">Jumla ya Uwekezaji</h3>
          <p className="text-2xl font-bold text-blue-600">TSH {(totalInvestment / 1000000).toFixed(1)}M</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-900">Mapato ya Jumla</h3>
          <p className="text-2xl font-bold text-green-600">TSH {(totalReturns / 1000000).toFixed(1)}M</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-900">Kiwango cha Mapato</h3>
          <p className="text-2xl font-bold text-orange-600">{returnRate}%</p>
        </div>
      </div>

      {/* Investments Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kiasi</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarehe</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hali</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mapato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vitendo</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {investments.map((investment) => (
              <tr key={investment.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{investment.group_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">TSH {parseFloat(investment.amount || 0).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(investment.investment_date).toLocaleDateString('sw-TZ')}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    investment.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {investment.status === 'active' ? 'Hai' : 'Inasubiri'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {investment.actual_return ? `TSH ${parseFloat(investment.actual_return).toLocaleString()}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button className="text-blue-600 hover:text-blue-900">View</button>
                  <button className="text-green-600 hover:text-green-900">Edit</button>
                </td>
              </tr>
            ))}
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
      alert('Hitilafu imetokea wakati wa kupakua ripoti.');
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
      alert('Hitilafu imetokea wakati wa kutengeneza ripoti.');
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
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Ripoti na Takwimu</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Ripoti za Mwezi</h3>
          {adminStats ? monthlyReports.map((report, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <span className="font-medium text-gray-900">Ripoti ya {report.label}</span>
              <button 
                onClick={() => handleDownloadMonthlyReport(report.offset)}
                disabled={downloadingReport === `monthly-${report.offset}`}
                className="text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingReport === `monthly-${report.offset}` ? 'Inafungua...' : 'Pakua PDF'}
              </button>
            </div>
          )) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No takwimu za kuonyesha</p>
              <p className="text-gray-400 text-xs mt-1">Ripoti zitaonekana baada ya kuwa na data</p>
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Ripoti za Maalum</h3>
          {adminStats ? specialReports.map((report, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <span className="font-medium text-gray-900">{report}</span>
              <button 
                onClick={() => handleGenerateSpecialReport(report)}
                disabled={generatingReport === report}
                className="text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingReport === report ? 'Inafungua...' : 'Angalia PDF'}
              </button>
            </div>
          )) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No takwimu za kuonyesha</p>
              <p className="text-gray-400 text-xs mt-1">Ripoti zitaonekana baada ya kuwa na data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContentSection({ educationalContent, user, loadAdminData }: { educationalContent: any[]; user: any; loadAdminData: () => void }) {
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
  const [contentForm, setContentForm] = useState({
    title: '',
    description: '',
    content: '',
    category: '',
    duration: '',
    difficulty_level: 'beginner',
    image_url: '',
    is_published: false
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
          is_published: false
        });
        loadAdminData();
        alert(editingContent ? 'Mafunzo yamebadilishwa kwa mafanikio!' : 'Mafunzo yameongezwa kwa mafanikio!');
      }
    } catch (error) {
      console.error('Error saving content:', error);
      alert('Hitilafu imetokea. Jaribu tena.');
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
      is_published: content.is_published
    });
    setShowContentForm(true);
  };

  const handleDeleteContent = async (contentId: number) => {
    if (confirm('Je, una uhakika unataka kufuta mafunzo haya?')) {
      try {
        const response = await fetch(`/api/educational-content/${contentId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          loadAdminData();
          alert('Mafunzo yamefutwa kwa mafanikio!');
        } else {
          const responseData = await response.json();
          alert(`Hitilafu: ${responseData.error || 'Imeshindwa kufuta'}`);
        }
      } catch (error) {
        console.error('Error deleting content:', error);
        alert('Hitilafu imetokea wakati wa kufuta.');
      }
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
        alert(currentStatus ? 'Mafunzo yamefichwa!' : 'Mafunzo yamechapishwa!');
      }
    } catch (error) {
      console.error('Error toggling publish status:', error);
      alert('Hitilafu imetokea.');
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

  const handleGenerateLessonsWithAI = async (saveToCourse: boolean) => {
    if (!managingLessons) return;

    if (!aiTopicPrompt.trim()) {
      alert('Tafadhali andika maelezo ya mada unayotaka AI itengeneze.');
      return;
    }

    if (saveToCourse && (!aiGeneratedLessons || aiGeneratedLessons.length === 0)) {
      alert('Hakuna masomo ya kuhifadhi. Tafadhali tengeneza kwanza.');
      return;
    }

    setAiError(null);
    saveToCourse ? setAiSaving(true) : setAiGenerating(true);

    try {
      const response = await fetch('/api/admin/ai/generate-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          educationalContentId: managingLessons.id,
          language: aiLanguage,
          lessonCount: aiLessonCount,
          difficulty: aiDifficulty,
          topicPrompt: aiTopicPrompt,
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
        alert('Masomo yamehifadhiwa kwa mafanikio!');
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
        alert(editingLesson ? 'Somo limebadilishwa kwa mafanikio!' : 'Somo limeongezwa kwa mafanikio!');
      }
    } catch (error) {
      console.error('Error saving lesson:', error);
      alert('Hitilafu imetokea wakati wa kuhifadhi somo.');
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (confirm('Je, una uhakika unataka kufuta somo hili? Hatua hii haiwezi kubadilishwa.')) {
      try {
        const response = await fetch(`/api/admin/educational-content/${managingLessons.id}/lessons/${lessonId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          handleManageLessons(managingLessons);
          alert('Somo limefutwa kwa mafanikio!');
        }
      } catch (error) {
        console.error('Error deleting lesson:', error);
        alert('Hitilafu imetokea wakati wa kufuta somo.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Mafunzo na Elimu</h2>
        <button
          onClick={() => {
            setEditingContent(null);
            setContentForm({
              title: '',
              description: '',
              content: '',
              category: '',
              duration: '',
              difficulty_level: 'beginner',
              image_url: '',
              is_published: false
            });
            setShowContentForm(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Mafunzo
        </button>
      </div>

      {showContentForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{editingContent ? 'Edit Mafunzo' : 'Mafunzo Mapya'}</h3>
          <form onSubmit={handleContentSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kichwa cha Habari
                </label>
                <input
                  type="text"
                  value={contentForm.title}
                  onChange={(e) => setContentForm({...contentForm, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategoria
                </label>
                <select
                  value={contentForm.category}
                  onChange={(e) => setContentForm({...contentForm, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Chagua Kategoria</option>
                  <option value="Biashara">Biashara</option>
                  <option value="Uongozi">Uongozi</option>
                  <option value="Fedha">Fedha</option>
                  <option value="Teknolojia">Teknolojia</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maelezo Mafupi
              </label>
              <textarea
                value={contentForm.description}
                onChange={(e) => setContentForm({...contentForm, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maudhui Kamili
              </label>
              <textarea
                value={contentForm.content}
                onChange={(e) => setContentForm({...contentForm, content: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={8}
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Muda
                </label>
                <input
                  type="text"
                  value={contentForm.duration}
                  onChange={(e) => setContentForm({...contentForm, duration: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Mfano: 2 masaa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kiwango
                </label>
                <select
                  value={contentForm.difficulty_level}
                  onChange={(e) => setContentForm({...contentForm, difficulty_level: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="beginner">Mwanzo</option>
                  <option value="intermediate">Kati</option>
                  <option value="advanced">Juu</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL ya Picha
                </label>
                <input
                  type="url"
                  value={contentForm.image_url}
                  onChange={(e) => setContentForm({...contentForm, image_url: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={contentForm.is_published}
                onChange={(e) => setContentForm({...contentForm, is_published: e.target.checked})}
                className="mr-2"
              />
              <label className="text-sm text-gray-700">
                Chapisha Mara Moja
              </label>
            </div>
            
            <div className="flex space-x-4">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingContent ? 'Save Mabadiliko' : 'Save Mafunzo'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowContentForm(false);
                  setEditingContent(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Content Modal */}
      {viewingContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{viewingContent.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {viewingContent.category} • {viewingContent.difficulty_level} • {viewingContent.duration} dakika
                  </p>
                </div>
                <button
                  onClick={() => setViewingContent(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Maelezo</h3>
                <p className="text-gray-700">{viewingContent.description}</p>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Maudhui</h3>
                <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                  {viewingContent.content}
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-gray-500">
                  Imeandikwa na {viewingContent.author_name} • {new Date(viewingContent.created_at).toLocaleDateString('sw-TZ')}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setViewingContent(null);
                      handleEditContent(viewingContent);
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleTogglePublish(viewingContent.id, viewingContent.is_published)}
                    className={`px-4 py-2 rounded-lg ${
                      viewingContent.is_published 
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Dhibiti Masomo - {managingLessons.title}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setShowAiLessonGenerator((s) => !s);
                      setAiError(null);
                      setAiGeneratedLessons(null);
                    }}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
                  >
                    AI Generate
                  </button>
                  <button
                    onClick={() => {
                      setEditingLesson(null);
                      setLessonForm({
                        language: 'sw',
                        title: '',
                        content: '',
                        duration_minutes: 15,
                        lesson_type: 'text',
                        video_url: ''
                      });
                      setShowLessonForm(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <PlusIcon className="h-4 w-4 inline mr-2" />
                    Add Somo
                  </button>
                  <button
                    onClick={() => setManagingLessons(null)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Funga
                  </button>
                </div>
              </div>

              {showAiLessonGenerator && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">AI Lesson Generator</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                          <select
                            value={aiLanguage}
                            onChange={(e) => setAiLanguage(e.target.value as 'sw' | 'en')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          >
                            <option value="sw">Swahili</option>
                            <option value="en">English</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                          <select
                            value={aiDifficulty}
                            onChange={(e) => setAiDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Lesson count</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={aiLessonCount}
                            onChange={(e) => setAiLessonCount(parseInt(e.target.value || '1'))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => handleGenerateLessonsWithAI(false)}
                            disabled={aiGenerating || aiSaving}
                            className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {aiGenerating ? 'Inatengeneza...' : 'Generate Preview'}
                          </button>
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Topic prompt</label>
                        <textarea
                          value={aiTopicPrompt}
                          onChange={(e) => setAiTopicPrompt(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={3}
                          placeholder="Mfano: Financial Basics - budgeting, saving, debt management..."
                        />
                      </div>

                      {aiError && (
                        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                          {aiError}
                        </div>
                      )}

                      {aiGeneratedLessons && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-gray-900">Preview ({aiGeneratedLessons.length})</h5>
                            <button
                              onClick={() => handleGenerateLessonsWithAI(true)}
                              disabled={aiSaving || aiGenerating}
                              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {aiSaving ? 'Inahifadhi...' : 'Save to Course'}
                            </button>
                          </div>
                          <div className="space-y-3">
                            {aiGeneratedLessons.map((l: any, idx: number) => (
                              <div key={idx} className="bg-white border border-orange-200 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium text-gray-900">{l.title}</div>
                                  <div className="text-xs text-gray-500">{l.duration_minutes} min • {aiLanguage.toUpperCase()}</div>
                                </div>
                                <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                                  {String(l.content || '').slice(0, 400)}{String(l.content || '').length > 400 ? '...' : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setShowAiLessonGenerator(false);
                        setAiError(null);
                        setAiGeneratedLessons(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                      title="Close"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* Lesson Form */}
              {showLessonForm && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="text-lg font-semibold mb-4">
                    {editingLesson ? 'Edit Somo' : 'Somo Jipya'}
                  </h4>
                  <form onSubmit={handleLessonSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kichwa cha Somo
                        </label>
                        <input
                          type="text"
                          value={lessonForm.title}
                          onChange={(e) => setLessonForm({...lessonForm, title: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Muda (Dakika)
                        </label>
                        <input
                          type="number"
                          value={lessonForm.duration_minutes}
                          onChange={(e) => setLessonForm({...lessonForm, duration_minutes: parseInt(e.target.value)})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          min="1"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Language
                      </label>
                      <select
                        value={(lessonForm as any).language || 'sw'}
                        onChange={(e) => setLessonForm({ ...(lessonForm as any), language: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="sw">Swahili</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maudhui ya Somo
                      </label>
                      <textarea
                        value={lessonForm.content}
                        onChange={(e) => setLessonForm({...lessonForm, content: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={8}
                        placeholder="Andika maudhui ya somo hapa..."
                        required
                      />
                    </div>

                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        {editingLesson ? 'Save Mabadiliko' : 'Save Somo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLessonForm(false);
                          setEditingLesson(null);
                        }}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Lessons List */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Masomo ({lessons.length})</h4>
                {lessons.length > 0 ? (
                  <div className="space-y-3">
                    {lessons.map((lesson, index) => (
                      <div key={lesson.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                                Somo {lesson.lesson_order}
                              </span>
                              <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2 py-1 rounded">
                                {(lesson.language || 'sw').toUpperCase()}
                              </span>
                              <span className="text-sm text-gray-500">
                                {lesson.duration_minutes} dakika
                              </span>
                            </div>
                            <h5 className="font-medium text-gray-900 mb-2">{lesson.title}</h5>
                            <p className="text-sm text-gray-600 line-clamp-3">
                              {lesson.content.substring(0, 200)}...
                            </p>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <button
                              onClick={() => {
                                setEditingLesson(lesson);
                                setLessonForm({
                                  language: lesson.language || 'sw',
                                  title: lesson.title,
                                  content: lesson.content,
                                  duration_minutes: lesson.duration_minutes,
                                  lesson_type: lesson.lesson_type,
                                  video_url: lesson.video_url || ''
                                });
                                setShowLessonForm(true);
                              }}
                              className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                              title="Delete"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpenIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No lessons added yet.</p>
                    <p className="text-sm">Click &ldquo;Add Lesson&rdquo; to start creating content.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mafunzo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kategoria
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hali
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tarehe
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vitendo
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {educationalContent.map((content) => (
              <tr key={content.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{content.title}</div>
                  <div className="text-sm text-gray-500">{content.category}</div>
                  <div className="text-sm text-gray-500">{content.difficulty_level} • {content.duration} dakika</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    content.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {content.is_published ? 'Imechapishwa' : 'Rasimu'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{content.author_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(content.created_at).toLocaleDateString('sw-TZ')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button 
                    onClick={() => handleViewContent(content)}
                    className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                    title="View"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleEditContent(content)}
                    className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleManageLessons(content)}
                    className="text-purple-600 hover:text-purple-900 p-1 rounded hover:bg-purple-50"
                    title="Dhibiti Masomo"
                  >
                    <BookOpenIcon className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteContent(content.id)}
                    className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JoinRequestsSection({ joinRequests, loadAdminData }: { joinRequests: any[]; loadAdminData: () => void }) {
  const [processingRequest, setProcessingRequest] = useState<number | null>(null);
  
  console.log('JoinRequestsSection received:', joinRequests);

  const handleApproveRequest = async (requestId: number) => {
    setProcessingRequest(requestId);
    try {
      const response = await fetch('/api/admin/join-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action: 'approve',
          reviewerId: 1,
          notes: 'Approved by admin'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        loadAdminData();
      } else {
        alert(data.error || 'Hitilafu imetokea');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Hitilafu imetokea wakati wa kukubali ombi');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    const reason = prompt('Eleza sababu ya kukataa ombi (si lazima):');
    
    setProcessingRequest(requestId);
    try {
      const response = await fetch('/api/admin/join-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action: 'reject',
          reviewerId: 1,
          notes: reason || 'Rejected by admin'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        loadAdminData();
      } else {
        alert(data.error || 'Hitilafu imetokea');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Hitilafu imetokea wakati wa kukataa ombi');
    } finally {
      setProcessingRequest(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Maombi ya Kujiunga na Groups</h2>
      
      {joinRequests.length === 0 ? (
        <div className="text-center py-8">
          <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No maombi ya kujiunga kwa sasa.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {joinRequests.map((request) => (
            <div key={request.id} className="border border-gray-200 rounded-lg p-4">
              {/* Debug info - remove in production */}
              {request.data_validation && request.data_validation !== 'OK' && (
                <div className="mb-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                  ⚠️ Data Issue: {request.data_validation} | Request ID: {request.id} | Member ID: {request.member_id}
                </div>
              )}
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {request.member_name}
                    <span className="text-xs text-gray-400 ml-2">(ID: {request.member_id})</span>
                  </h3>
                  <p className="text-sm text-gray-600">Anataka kujiunga na: <span className="font-medium">{request.group_name}</span></p>
                  <p className="text-sm text-gray-600">Barua pepe: {request.member_email}</p>
                  {request.member_phone && (
                    <p className="text-sm text-gray-600">Simu: {request.member_phone}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Imetumwa: {new Date(request.created_at).toLocaleDateString('sw-TZ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-orange-600">
                    Mchango: TSH {parseInt(request.monthly_contribution).toLocaleString()}/mwezi
                  </p>
                  <p className="text-sm text-gray-600">Kiongozi: {request.leader_name || 'Hajaainishwa'}</p>
                </div>
              </div>
              
              {request.message && (
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Ujumbe:</span> {request.message}
                  </p>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  onClick={() => handleApproveRequest(request.id)}
                  disabled={processingRequest === request.id}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {processingRequest === request.id ? 'Inakubali...' : 'Kubali'}
                </button>
                <button
                  onClick={() => handleRejectRequest(request.id)}
                  disabled={processingRequest === request.id}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {processingRequest === request.id ? 'Inakataa...' : 'Kataa'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsSection() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Mipangilio ya Mfumo</h2>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Mipangilio ya Jumla</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Kiwango cha Hisa (%)</span>
              <input type="number" defaultValue="30" className="w-20 px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Ada ya Mwezi (TSH)</span>
              <input type="number" defaultValue="50000" className="w-32 px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Arifa</h3>
          <div className="space-y-2">
            <label className="flex items-center">
              <input type="checkbox" defaultChecked className="mr-2" />
              <span className="text-gray-700">Arifa za barua pepe kwa members wapya</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" defaultChecked className="mr-2" />
              <span className="text-gray-700">Ripoti za kila wiki</span>
            </label>
          </div>
        </div>
        
        <button className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors duration-200">
          Save Mabadiliko
        </button>
      </div>
    </div>
  );
}
