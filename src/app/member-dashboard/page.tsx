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
    { id: 'profile', name: 'Profile', icon: UserIcon },
    { id: 'group', name: 'My Group', icon: UserGroupIcon },
    { id: 'investments', name: 'My Investments', icon: CurrencyDollarIcon },
    { id: 'learning', name: 'Training', icon: AcademicCapIcon },
    { id: 'settings', name: 'Settings', icon: CogIcon },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <MemberOverviewSection memberProfile={memberProfile} memberInvestments={memberInvestments} recentActivities={recentActivities} onNavigate={setActiveSection} />;
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
        return <MemberSettingsSection />;
      default:
        return <MemberOverviewSection memberProfile={memberProfile} memberInvestments={memberInvestments} recentActivities={recentActivities} onNavigate={setActiveSection} />;
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-red-500">
                <span className="text-lg font-bold text-white">J</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">JUKUMU</h1>
                <p className="text-sm text-muted-foreground">Welcome, {user.fullName || user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="bg-card rounded-lg shadow-sm p-4">
              <ul className="space-y-2">
                {menuItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-200 ${
                        activeSection === item.id
                          ? 'bg-accent text-primary'
                          : 'text-muted-foreground hover:bg-muted'
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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

function MemberOverviewSection({ memberProfile, memberInvestments, recentActivities, onNavigate }: { memberProfile: any; memberInvestments: any[]; recentActivities: any[]; onNavigate: (section: string) => void }) {
  const totalInvestment = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  const expectedReturns = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.expected_return || 0), 0);
  
  const stats = [
    { name: 'Membership Status', value: memberProfile?.status === 'active' ? 'Active' : 'Pending', color: memberProfile?.status === 'active' ? 'bg-green-500' : 'bg-yellow-500' },
    { name: 'My Group', value: memberProfile?.group_name || 'None', color: 'bg-blue-500' },
    { name: 'My Investment', value: totalInvestment > 0 ? `TSH ${totalInvestment.toLocaleString()}` : 'TSH 0', color: 'bg-primary' },
    { name: 'Expected Returns', value: expectedReturns > 0 ? `TSH ${expectedReturns.toLocaleString()}` : 'TSH 0', color: 'bg-purple-500' },
  ];

  const displayActivities = recentActivities.length > 0 ? recentActivities.map(activity => ({
    action: activity.action_text,
    time: new Date(activity.activity_date).toLocaleDateString('en-US')
  })) : [
    { action: 'Joined JUKUMU', time: memberProfile?.created_at ? new Date(memberProfile.created_at).toLocaleDateString('en-US') : 'Today' }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-card rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center mr-4`}>
                <ChartBarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.name}</p>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activities</h3>
          <div className="space-y-4">
            {displayActivities.slice(0, 4).map((activity, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={() => onNavigate('group')}
              className="w-full text-left p-3 border border-primary/20 rounded-lg bg-accent hover:bg-accent transition-colors duration-200"
            >
              <div className="flex items-center space-x-3">
                <CurrencyDollarIcon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-accent-foreground">💳 Lipa Mchango</span>
              </div>
            </button>
            <button 
              onClick={() => onNavigate('learning')}
              className="w-full text-left p-3 border border-border rounded-lg hover:bg-accent hover:border-primary/30 transition-colors duration-200"
            >
              <div className="flex items-center space-x-3">
                <BookOpenIcon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">View Training</span>
              </div>
            </button>
            <button 
              onClick={() => onNavigate('group')}
              className="w-full text-left p-3 border border-border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors duration-200"
            >
              <div className="flex items-center space-x-3">
                <UserGroupIcon className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-foreground">View Group</span>
              </div>
            </button>
            <button 
              onClick={() => onNavigate('investments')}
              className="w-full text-left p-3 border border-border rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors duration-200"
            >
              <div className="flex items-center space-x-3">
                <CurrencyDollarIcon className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-foreground">Track Investments</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ memberProfile, user, loadMemberData }: { memberProfile: any; user: any; loadMemberData: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: memberProfile?.full_name || '',
    phone: memberProfile?.phone || '',
    location: memberProfile?.location || '',
    businessType: memberProfile?.business_type || '',
    businessName: memberProfile?.business_name || '',
    businessDescription: memberProfile?.business_description || '',
    monthlyRevenue: memberProfile?.monthly_revenue || '',
    employeeCount: memberProfile?.employee_count || ''
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
        employeeCount: memberProfile.employee_count || ''
      });
    }
  }, [memberProfile]);

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/members/profile?userId=${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setIsEditing(false);
        loadMemberData();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">My Profile</h2>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          {isEditing ? 'Save' : 'Edit'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Full Name</label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-border rounded-md disabled:bg-muted"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
          <input
            type="email"
            value={memberProfile?.email || user?.email || ''}
            disabled
            className="w-full px-3 py-2 border border-border rounded-md bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-border rounded-md disabled:bg-muted"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-border rounded-md disabled:bg-muted"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Business Type</label>
          <input
            type="text"
            value={formData.businessType}
            onChange={(e) => setFormData({...formData, businessType: e.target.value})}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-border rounded-md disabled:bg-muted"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Business Name</label>
          <input
            type="text"
            value={formData.businessName}
            onChange={(e) => setFormData({...formData, businessName: e.target.value})}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-border rounded-md disabled:bg-muted"
          />
        </div>
      </div>
      
      <div className="mt-4">
        <label className="block text-sm font-medium text-muted-foreground mb-1">Business Description</label>
        <textarea
          value={formData.businessDescription}
          onChange={(e) => setFormData({...formData, businessDescription: e.target.value})}
          disabled={!isEditing}
          rows={3}
          className="w-full px-3 py-2 border border-border rounded-md disabled:bg-muted"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Monthly Revenue (TSH)</label>
          <input
            type="number"
            value={formData.monthlyRevenue}
            onChange={(e) => setFormData({...formData, monthlyRevenue: e.target.value})}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-border rounded-md disabled:bg-muted"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Employee Count</label>
          <input
            type="number"
            value={formData.employeeCount}
            onChange={(e) => setFormData({...formData, employeeCount: e.target.value})}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-border rounded-md disabled:bg-muted"
          />
        </div>
      </div>
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
  const [paymentModal, setPaymentModal] = useState<{ group: any; type: 'contribution' | 'topup' } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payPhone, setPayPhone] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [payStatus, setPayStatus] = useState<'input' | 'waiting' | 'success' | 'failed'>('input');
  const [payReference, setPayReference] = useState('');
  const [paymentsByGroup, setPaymentsByGroup] = useState<Record<number, any[]>>({});

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      loadMyGroups();
      loadAvailableGroups();
      loadJoinRequests();
      loadAllPayments();
    }
  }, [memberProfile]);

  const loadAllPayments = async () => {
    try {
      const res = await fetch('/api/member/contributions');
      if (res.ok) {
        const data = await res.json();
        const grouped: Record<number, any[]> = {};
        for (const p of (data.payments || [])) {
          const gid = p.group_id;
          if (!grouped[gid]) grouped[gid] = [];
          grouped[gid].push(p);
        }
        setPaymentsByGroup(grouped);
      }
    } catch { /* ignore */ }
  };

  const loadMyGroups = async () => {
    try {
      const response = await fetch('/api/member/groups');
      if (response.ok) {
        const data = await response.json();
        setMyGroups(data.groups || []);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error loading my groups:', error);
    }
  };

  const loadAvailableGroups = async () => {
    try {
      const response = await fetch('/api/member/available-groups');
      if (response.ok) {
        const data = await response.json();
        setAvailableGroups(data.groups || []);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error loading available groups:', error);
    }
  };

  const loadJoinRequests = async () => {
    try {
      const response = await fetch('/api/member/join-requests');
      if (response.ok) {
        const data = await response.json();
        setJoinRequests(data.requests || []);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error loading join requests:', error);
    }
  };

  const handleJoinRequest = async (groupId: number) => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/member/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          message: joinMessage
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        setSelectedGroup(null);
        setJoinMessage('');
        await Promise.all([loadJoinRequests(), loadAvailableGroups()]);
      } else {
        alert(data.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Error sending join request:', error);
      alert('An error occurred while sending request');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayment = (group: any, type: 'contribution' | 'topup') => {
    setPayAmount(type === 'contribution' ? String(parseInt(group.monthly_contribution || '0')) : '');
    setPayPhone(memberProfile?.phone || '');
    setPayError('');
    setPayStatus('input');
    setPayReference('');
    setPaymentModal({ group, type });
  };

  const handleClosePayment = () => {
    setPaymentModal(null);
    setPayError('');
    setPayStatus('input');
    setPayReference('');
  };

  const handlePay = async () => {
    if (!paymentModal) return;
    const amount = parseInt(payAmount);
    if (!amount || amount <= 0) {
      setPayError('Ingiza kiasi sahihi (TZS)');
      return;
    }
    if (!payPhone || payPhone.length < 9) {
      setPayError('Ingiza nambari sahihi ya simu');
      return;
    }
    setPayLoading(true);
    setPayError('');
    try {
      const endpoint = paymentModal.type === 'contribution'
        ? '/api/member/contributions'
        : `/api/member/groups/${paymentModal.group.id}/topup`;
      const body = paymentModal.type === 'contribution'
        ? { groupId: paymentModal.group.id, amount, phone_number: payPhone }
        : { amount, phone_number: payPhone };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const rawText = await res.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(rawText); } catch { /* non-JSON body */ }
      if (!res.ok) {
        setPayError((data.error as string) || `Hitilafu ${res.status}: ${rawText.slice(0, 120)}`);
        return;
      }
      // USSD push sent successfully — show waiting screen and start polling
      setPayReference(data.reference as string);
      setPayStatus('waiting');
      pollPaymentStatus(data.reference as string);
    } catch {
      setPayError('Hitilafu imetokea. Jaribu tena.');
    } finally {
      setPayLoading(false);
    }
  };

  const pollPaymentStatus = (reference: string) => {
    let attempts = 0;
    const maxAttempts = 60; // poll for up to 5 minutes (every 5s)
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setPayStatus('failed');
        setPayError('Muda wa malipo umekwisha. Jaribu tena.');
        return;
      }
      try {
        const res = await fetch(`/api/member/payments/status?reference=${encodeURIComponent(reference)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'completed') {
          clearInterval(interval);
          setPayStatus('success');
          loadAllPayments();
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setPayStatus('failed');
          setPayError(data.failure_reason || 'Malipo yameshindwa.');
        }
      } catch { /* ignore polling errors */ }
    }, 5000);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    const labels = {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badges[status as keyof typeof badges] || 'bg-gray-100 text-accent-foreground'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  return (
    <div className="bg-card rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">My Groups</h2>
      
      {myGroups.length > 0 ? (
        <div className="space-y-4">
          <div className="grid gap-4">
            {myGroups.map((g) => (
              <div key={g.id} onClick={() => router.push(`/member-dashboard/groups/${g.id}`)} className="border border-border rounded-lg p-4 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{g.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">Role: {g.member_role || 'member'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: {g.membership_status || g.status || 'active'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary">
                      TSH {parseInt(g.monthly_contribution || 0).toLocaleString()}/month
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Bonyeza kuona →</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenPayment(g, 'contribution'); }}
                    className="flex-1 px-3 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors"
                  >
                    💳 Lipa Mchango
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenPayment(g, 'topup'); }}
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ➕ Weka Mfuko
                  </button>
                </div>
                {/* Recent payments for this group */}
                {(paymentsByGroup[g.id] || []).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Malipo ya Hivi Karibuni</p>
                    <div className="space-y-1">
                      {(paymentsByGroup[g.id] || []).slice(0, 3).map((p: any) => (
                        <div key={p.reference} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              p.status === 'completed' ? 'bg-green-500' :
                              p.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}></span>
                            <span className="text-muted-foreground">
                              TSH {parseInt(p.amount_tzs || 0).toLocaleString()}
                            </span>
                            <span className="text-gray-400">
                              {p.payment_type === 'contribution' ? 'Mchango' : 'Mfuko'}
                            </span>
                          </div>
                          <span className="text-gray-400">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short' }) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              onClick={() => setShowAvailableGroups(!showAvailableGroups)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              {showAvailableGroups ? 'Hide Groups' : 'Join Another Group'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* No Group Message */}
          <div className="text-center py-8">
            <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">You haven&apos;t joined any group yet.</p>
            <button 
              onClick={() => setShowAvailableGroups(!showAvailableGroups)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              {showAvailableGroups ? 'Hide Groups' : 'Join a Group'}
            </button>
          </div>

          {/* Join Requests Status */}
          {joinRequests.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">My Requests</h3>
              <div className="space-y-3">
                {joinRequests.map((request) => (
                  <div key={request.id} className="border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-foreground">{request.group_name}</h4>
                        <p className="text-sm text-muted-foreground">Contribution: TSH {parseInt(request.monthly_contribution).toLocaleString()}/month</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Sent: {new Date(request.created_at).toLocaleDateString('en-US')}
                        </p>
                      </div>
                      <div>
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Groups */}
          {showAvailableGroups && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Available Groups</h3>
              {availableGroups.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No groups available at the moment.</p>
              ) : (
                <div className="grid gap-4">
                  {availableGroups.map((group) => (
                    <div key={group.id} className="border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-foreground">{group.name}</h4>
                          <p className="text-sm text-muted-foreground">Leader: {group.leader_name || 'Not assigned'}</p>
                          <p className="text-sm text-muted-foreground">Members: {group.member_count}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-primary">
                            TSH {parseInt(group.monthly_contribution).toLocaleString()}/month
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Founded: {new Date(group.founded_date).toLocaleDateString('en-US')}
                          </p>
                        </div>
                      </div>
                      
                      {/* Check if already requested */}
                      {joinRequests.some(req => req.group_id === group.id && req.status === 'pending') ? (
                        <button disabled className="w-full px-4 py-2 bg-gray-300 text-muted-foreground rounded-lg cursor-not-allowed">
                          Request Sent
                        </button>
                      ) : (
                        <button 
                          onClick={() => setSelectedGroup(group)}
                          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                        >
                          Request to Join
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Snippe USSD Push Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm mx-4">

            {/* INPUT SCREEN */}
            {payStatus === 'input' && (
              <>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {paymentModal.type === 'contribution' ? '💳 Lipa Mchango' : '➕ Weka Fedha Mfukoni'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">{paymentModal.group.name}</p>

                {paymentModal.type === 'contribution' && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Mchango wa kawaida: TSH {parseInt(paymentModal.group.monthly_contribution || '0').toLocaleString()}/mwezi
                  </p>
                )}

                <label className="block text-sm font-medium text-muted-foreground mb-1">Kiasi (TZS)</label>
                <input
                  type="number"
                  min="1"
                  value={payAmount}
                  onChange={(e) => { setPayAmount(e.target.value); setPayError(''); }}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 border border-border rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
                />

                <label className="block text-sm font-medium text-muted-foreground mb-1">Nambari ya Simu</label>
                <input
                  type="tel"
                  value={payPhone}
                  onChange={(e) => { setPayPhone(e.target.value); setPayError(''); }}
                  placeholder="255712345678"
                  className="w-full px-3 py-2 border border-border rounded-md mb-1 focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {payError && <p className="text-xs text-red-600 mb-2">{payError}</p>}

                <p className="text-xs text-gray-400 mb-4">
                  Utapokea arifa ya USSD kwenye simu yako. Ingiza PIN yako kuthibitisha malipo.
                </p>

                <div className="flex space-x-3">
                  <button
                    onClick={handleClosePayment}
                    disabled={payLoading}
                    className="flex-1 px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted disabled:opacity-50"
                  >
                    Ghairi
                  </button>
                  <button
                    onClick={handlePay}
                    disabled={payLoading}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {payLoading ? 'Inatuma...' : 'Lipa Sasa'}
                  </button>
                </div>
              </>
            )}

            {/* WAITING SCREEN */}
            {payStatus === 'waiting' && (
              <div className="text-center py-4">
                <div className="inline-block w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Inasubiri Uthibitisho...</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Arifa ya USSD imetumwa kwa <strong>{payPhone}</strong>
                </p>
                <p className="text-xs text-gray-400 mb-4">
                  Tafadhali ingiza PIN yako kwenye simu yako kuthibitisha malipo ya TSH {parseInt(payAmount).toLocaleString()}
                </p>
                <div className="bg-accent border border-primary/20 rounded-lg p-3 mb-4">
                  <p className="text-xs text-primary">Usifunge ukurasa huu hadi uthibitishe malipo kwenye simu yako.</p>
                </div>
                <button
                  onClick={handleClosePayment}
                  className="text-sm text-muted-foreground hover:text-muted-foreground underline"
                >
                  Ghairi
                </button>
              </div>
            )}

            {/* SUCCESS SCREEN */}
            {payStatus === 'success' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">Malipo Yamefanikiwa!</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  TSH {parseInt(payAmount).toLocaleString()} - {paymentModal.group.name}
                </p>
                <p className="text-xs text-gray-400 mb-4">Ref: {payReference}</p>
                <button
                  onClick={handleClosePayment}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Funga
                </button>
              </div>
            )}

            {/* FAILED SCREEN */}
            {payStatus === 'failed' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Malipo Yameshindwa</h3>
                {payError && <p className="text-sm text-red-600 mb-4">{payError}</p>}
                <div className="flex space-x-3">
                  <button
                    onClick={handleClosePayment}
                    className="flex-1 px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted"
                  >
                    Funga
                  </button>
                  <button
                    onClick={() => { setPayStatus('input'); setPayError(''); }}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                  >
                    Jaribu Tena
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Join Request Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Request to Join {selectedGroup.name}
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Monthly Contribution: TSH {parseInt(selectedGroup.monthly_contribution).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mb-4">Leader: {selectedGroup.leader_name || 'Not assigned'}</p>
              
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Message (optional)
              </label>
              <textarea
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                placeholder="Explain why you would like to join this group..."
                className="w-full px-3 py-2 border border-border rounded-md resize-none"
                rows={3}
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setSelectedGroup(null);
                  setJoinMessage('');
                }}
                className="flex-1 px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => handleJoinRequest(selectedGroup.id)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Request'}
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
  
  return (
    <div className="bg-card rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">My Investments</h2>
      
      {/* Investment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900">Total Investment</h3>
          <p className="text-xl font-bold text-blue-600">TSH {totalInvestment.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-900">Actual Returns</h3>
          <p className="text-xl font-bold text-green-600">TSH {totalReturns.toLocaleString()}</p>
        </div>
        <div className="bg-accent p-4 rounded-lg">
          <h3 className="text-sm font-medium text-accent-foreground">Return Rate</h3>
          <p className="text-xl font-bold text-primary">
            {totalInvestment > 0 ? ((totalReturns / totalInvestment) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>
      
      {/* Investments List */}
      {memberInvestments.length > 0 ? (
        <div className="space-y-4">
          {memberInvestments.map((investment, index) => (
            <div key={index} className="border border-border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-foreground">{investment.group_name}</h3>
                  <p className="text-sm text-muted-foreground">Date: {new Date(investment.investment_date).toLocaleDateString('en-US')}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  investment.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {investment.status === 'active' ? 'Active' : 'Pending'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">TSH {parseFloat(investment.amount).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Equity</p>
                  <p className="font-medium">{investment.equity_percentage}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expected Returns</p>
                  <p className="font-medium">TSH {parseFloat(investment.expected_return || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actual Returns</p>
                  <p className="font-medium">TSH {parseFloat(investment.actual_return || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <CurrencyDollarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-muted-foreground">You don&apos;t have any investments yet.</p>
        </div>
      )}
    </div>
  );
}

function LearningSection({ memberTraining, user }: { memberTraining: any[]; user: any }) {
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [trainingDetails, setTrainingDetails] = useState<any>(null);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleViewTraining = async (training: any) => {
    setLoading(true);
    try {
      // Use educational content lessons API
      const response = await fetch(`/api/admin/educational-content/${training.id}/lessons`);
      if (response.ok) {
        const lessons = await response.json();
        setSelectedTraining(training);
        setTrainingDetails({
          module: training,
          lessons: lessons,
          totalLessons: lessons.length,
          completedLessons: 0 // TODO: Add progress tracking
        });
        // Start with first lesson if available
        if (lessons && lessons.length > 0) {
          setCurrentLesson(lessons[0]);
        }
      } else {
        alert('An error occurred while loading training');
      }
    } catch (error) {
      console.error('Error loading training:', error);
      alert('An error occurred while loading training');
    } finally {
      setLoading(false);
    }
  };

  const handleLessonComplete = async (lessonId: number, completed: boolean) => {
    try {
      const response = await fetch('/api/training/lesson-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, lessonId, completed })
      });
      
      if (response.ok) {
        // Update lesson status locally
        if (trainingDetails) {
          const updatedLessons = trainingDetails.lessons.map((lesson: any) => 
            lesson.id === lessonId ? { ...lesson, completed } : lesson
          );
          setTrainingDetails({ ...trainingDetails, lessons: updatedLessons });
        }
        
        if (completed) {
          alert('Congratulations! You have completed this lesson.');
        }
      } else {
        alert('An error occurred while recording progress');
      }
    } catch (error) {
      console.error('Error updating lesson progress:', error);
      alert('An error occurred while recording progress');
    }
  };

  const handleStartTraining = async (trainingId: number) => {
    try {
      await fetch('/api/members/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, trainingId, action: 'start' })
      });
      // Refresh the page or update state
      window.location.reload();
    } catch (error) {
      console.error('Error starting training:', error);
    }
  };
  
  const handleCompleteTraining = async (trainingId: number) => {
    try {
      await fetch('/api/members/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, trainingId, action: 'complete' })
      });
      // Refresh the page or update state
      window.location.reload();
    } catch (error) {
      console.error('Error completing training:', error);
    }
  };
  
  // Show lesson viewer if training is selected
  if (selectedTraining && trainingDetails) {
    return (
      <div className="bg-card rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => {
                setSelectedTraining(null);
                setTrainingDetails(null);
                setCurrentLesson(null);
              }}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
            >
              ← Back to Training
            </button>
            <h2 className="text-2xl font-bold text-foreground">{selectedTraining.title}</h2>
            <p className="text-muted-foreground">{selectedTraining.description}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              Progress: {trainingDetails.completedLessons}/{trainingDetails.totalLessons} lessons
            </div>
            <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${(trainingDetails.completedLessons / trainingDetails.totalLessons) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Lessons Sidebar */}
          <div className="lg:col-span-1">
            <h3 className="font-semibold text-foreground mb-4">Lessons</h3>
            <div className="space-y-2">
              {trainingDetails.lessons.map((lesson: any, index: number) => (
                <button
                  key={lesson.id}
                  onClick={() => setCurrentLesson(lesson)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    currentLesson?.id === lesson.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{lesson.title}</div>
                      <div className="text-xs text-muted-foreground">{lesson.duration_minutes} minutes</div>
                    </div>
                    {lesson.completed && (
                      <span className="text-green-600 text-sm">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Lesson Content */}
          <div className="lg:col-span-3">
            {currentLesson ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-foreground">{currentLesson.title}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">{currentLesson.duration_minutes} minutes</span>
                    <button
                      onClick={() => handleLessonComplete(currentLesson.id, !currentLesson.completed)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        currentLesson.completed
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {currentLesson.completed ? 'Completed ✓' : 'Complete Lesson'}
                    </button>
                  </div>
                </div>
                
                <div className="prose max-w-none">
                  <div 
                    className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: currentLesson.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                  />
                </div>

                {/* Navigation */}
                <div className="flex justify-between mt-8 pt-6 border-t">
                  <button
                    onClick={() => {
                      const currentIndex = trainingDetails.lessons.findIndex((l: any) => l.id === currentLesson.id);
                      if (currentIndex > 0) {
                        setCurrentLesson(trainingDetails.lessons[currentIndex - 1]);
                      }
                    }}
                    disabled={trainingDetails.lessons.findIndex((l: any) => l.id === currentLesson.id) === 0}
                    className="px-4 py-2 bg-gray-100 text-muted-foreground rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Previous Lesson
                  </button>
                  
                  <button
                    onClick={() => {
                      const currentIndex = trainingDetails.lessons.findIndex((l: any) => l.id === currentLesson.id);
                      if (currentIndex < trainingDetails.lessons.length - 1) {
                        setCurrentLesson(trainingDetails.lessons[currentIndex + 1]);
                      }
                    }}
                    disabled={trainingDetails.lessons.findIndex((l: any) => l.id === currentLesson.id) === trainingDetails.lessons.length - 1}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next Lesson →
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-muted-foreground">Select a lesson from the left sidebar to start reading.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show training modules list
  return (
    <div className="bg-card rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">Training</h2>
      
      {memberTraining.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {memberTraining.map((training, index) => (
            <div key={index} className="border border-border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-foreground">{training.title}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  training.progress_status === 'completed' ? 'bg-green-100 text-green-800' :
                  training.progress_status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-accent-foreground'
                }`}>
                  {training.progress_status === 'completed' ? 'Completed' :
                   training.progress_status === 'in_progress' ? 'In Progress' :
                   'Not Started'}
                </span>
              </div>
              
              <p className="text-sm text-muted-foreground mb-3">{training.description}</p>
              
              <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                <span>Category: {training.category}</span>
                <span>Level: {training.level}</span>
                <span>Duration: {training.duration_hours}h</span>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleViewTraining(training)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'View Lessons'}
                </button>
                
                {training.progress_status === 'completed' ? (
                  <div className="flex items-center px-3 py-2 bg-green-100 text-green-800 rounded-lg">
                    <span className="text-sm font-medium">✓ Completed</span>
                  </div>
                ) : training.progress_status === 'in_progress' ? (
                  <button
                    onClick={() => handleCompleteTraining(training.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Complete
                  </button>
                ) : (
                  <button
                    onClick={() => handleStartTraining(training.id)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                  >
                    Start
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-muted-foreground">No training available.</p>
        </div>
      )}
    </div>
  );
}

function MemberSettingsSection() {
  return (
    <div className="bg-card rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">Settings</h2>
      <p className="text-muted-foreground">Your account settings.</p>
    </div>
  );
}
