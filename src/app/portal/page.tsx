'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  UserCircleIcon, 
  UserGroupIcon, 
  AcademicCapIcon, 
  CurrencyDollarIcon,
  BellIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

export default function MemberPortal() {
  const { } = useLanguage();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{fullName?: string; email: string} | null>(null);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    setMounted(true);
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      router.push('/login');
    }
  }, [router]);

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
    { id: 'profile', name: 'Wasifu Wangu', icon: UserCircleIcon },
    { id: 'group', name: 'Kundi Langu', icon: UserGroupIcon },
    { id: 'training', name: 'Mafunzo', icon: AcademicCapIcon },
    { id: 'funding', name: 'Fedha', icon: CurrencyDollarIcon },
    { id: 'announcements', name: 'Matangazo', icon: BellIcon },
    { id: 'reports', name: 'Ripoti', icon: ChartBarIcon },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSection user={user} />;
      case 'group':
        return <GroupSection />;
      case 'training':
        return <TrainingSection />;
      case 'funding':
        return <FundingSection />;
      case 'announcements':
        return <AnnouncementsSection />;
      case 'reports':
        return <ReportsSection />;
      default:
        return <ProfileSection user={user} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-red-500">
                <span className="text-lg font-bold text-white">J</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Washika DAU Portal</h1>
                <p className="text-sm text-gray-600">Karibu, {user.fullName || user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span>Toka</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="bg-white rounded-lg shadow-sm p-4">
              <ul className="space-y-2">
                {menuItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-200 ${
                        activeTab === item.id
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
          <div className="lg:col-span-3">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ user }: { user: any }) {
  const [profile, setProfile] = useState({
    fullName: user.name || '',
    email: user.email || '',
    phone: '+255 123 456 789',
    location: 'Mwanza, Tanzania',
    businessType: 'Kilimo',
    businessName: 'Shamba la Mazao',
    revenue: '500,000 TSH',
    employees: '3',
    description: 'Tunalima mahindi, maharage na nazi. Tunahitaji msaada wa kiufundi na fedha za kuongeza mazao.',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Wasifu Wangu</h2>
      
      <form className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jina Kamili
            </label>
            <input
              type="text"
              name="fullName"
              value={profile.fullName}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Barua Pepe
            </label>
            <input
              type="email"
              name="email"
              value={profile.email}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nambari ya Simu
            </label>
            <input
              type="tel"
              name="phone"
              value={profile.phone}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mahali
            </label>
            <input
              type="text"
              name="location"
              value={profile.location}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aina ya Biashara
            </label>
            <select
              name="businessType"
              value={profile.businessType}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
            >
              <option value="kilimo">Kilimo</option>
              <option value="ufugaji">Ufugaji</option>
              <option value="biashara_ndogo">Biashara Ndogo</option>
              <option value="sanaa">Sanaa na Ubunifu</option>
              <option value="huduma">Huduma</option>
              <option value="teknolojia">Teknolojia</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jina la Biashara
            </label>
            <input
              type="text"
              name="businessName"
              value={profile.businessName}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maelezo ya Biashara
          </label>
          <textarea
            name="description"
            rows={4}
            value={profile.description}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors duration-200"
        >
          Hifadhi Mabadiliko
        </button>
      </form>
    </div>
  );
}

function GroupSection() {
  const groupData = {
    name: 'Kundi la Biashara',
    members: 0,
    leader: 'Hakuna kiongozi bado',
    founded: '2025',
    totalInvestment: '0 TSH',
    monthlyContribution: '0 TSH',
  };

  const members = [
    { name: 'Hakuna wanachama bado', role: 'Mfumo mpya', business: 'Subiri wanachama wajisajili' },
  ];

  return (
    <div className="space-y-6">
      {/* Group Overview */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Kundi Langu</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{groupData.members}</div>
            <div className="text-sm text-gray-600">Wanachama</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{groupData.totalInvestment}</div>
            <div className="text-sm text-gray-600">Jumla ya Uwekezaji</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{groupData.monthlyContribution}</div>
            <div className="text-sm text-gray-600">Michango ya Kila Mwezi</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Maelezo ya Kundi</h3>
            <p className="text-gray-600 mb-2"><strong>Jina:</strong> {groupData.name}</p>
            <p className="text-gray-600 mb-2"><strong>Kiongozi:</strong> {groupData.leader}</p>
            <p className="text-gray-600"><strong>Mwaka wa Kuanzishwa:</strong> {groupData.founded}</p>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Wanachama wa Kundi</h3>
        <div className="space-y-4">
          {members.map((member, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-red-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">{member.name.charAt(0)}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{member.name}</h4>
                  <p className="text-sm text-gray-600">{member.business}</p>
                </div>
              </div>
              <span className="text-sm text-orange-600 font-medium">{member.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrainingSection() {
  const trainings = [
    {
      title: 'Uongozi wa Biashara',
      description: 'Jifunze jinsi ya kuongoza biashara yako kwa ufanisi',
      duration: '2 masaa',
      status: 'completed',
      progress: 100,
    },
    {
      title: 'Utunzaji wa Fedha',
      description: 'Mafunzo ya jinsi ya kutunza na kupanga fedha za biashara',
      duration: '1.5 masaa',
      status: 'in_progress',
      progress: 60,
    },
    {
      title: 'Masoko na Uuzaji',
      description: 'Jinsi ya kupata na kuwashawishi wateja',
      duration: '3 masaa',
      status: 'available',
      progress: 0,
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Mafunzo</h2>
      
      <div className="space-y-6">
        {trainings.map((training, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{training.title}</h3>
                <p className="text-gray-600 mt-1">{training.description}</p>
                <p className="text-sm text-gray-500 mt-2">Muda: {training.duration}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                training.status === 'completed' ? 'bg-green-100 text-green-800' :
                training.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {training.status === 'completed' ? 'Imekamilika' :
                 training.status === 'in_progress' ? 'Inaendelea' : 'Inapatikana'}
              </span>
            </div>
            
            {training.progress > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Maendeleo</span>
                  <span>{training.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${training.progress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            <button className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
              training.status === 'completed' ? 'bg-green-100 text-green-700' :
              'bg-orange-600 text-white hover:bg-orange-700'
            }`}>
              {training.status === 'completed' ? 'Angalia Tena' :
               training.status === 'in_progress' ? 'Endelea' : 'Anza'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FundingSection() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Ombi la Fedha</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Current Status */}
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Hali ya Sasa</h3>
            <p className="text-blue-700">Haujaomba fedha bado. Unaweza kuomba fedha za kuongeza biashara yako.</p>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Mahitaji ya Ombi</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Uwe mwanachama wa kundi kwa miezi 6+
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Umalize mafunzo ya kimsingi
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Uwe na mpango wa biashara
              </li>
            </ul>
          </div>
        </div>

        {/* Application Form */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Omba Fedha</h3>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kiasi cha Fedha (TSH)
              </label>
              <input
                type="number"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="500,000"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Madhumuni ya Fedha
              </label>
              <select className="w-full px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50 [&>option]:bg-[#1a1a1a] [&>option]:text-white">
                <option>Kuongeza mazao</option>
                <option>Kununua vifaa</option>
                <option>Kuongeza wafanyakazi</option>
                <option>Kuongeza masoko</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maelezo ya Mradi
              </label>
              <textarea
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Eleza jinsi utakavyotumia fedha hizi..."
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 transition-colors duration-200"
            >
              Wasilisha Ombi
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function AnnouncementsSection() {
  const announcements = [
    {
      title: 'Mafunzo Mapya ya Kilimo',
      date: '2024-08-28',
      content: 'Tutakuwa na mafunzo mapya ya kilimo cha kisasa tarehe 5 Septemba. Wanachama wote wanahimizwa kushiriki.',
      priority: 'high',
    },
    {
      title: 'Mkutano wa Kundi',
      date: '2024-08-25',
      content: 'Mkutano wa kila mwezi utafanyika Jumamosi tarehe 2 Septemba saa 2 asubuhi.',
      priority: 'medium',
    },
    {
      title: 'Mafanikio ya Kundi',
      date: '2024-08-20',
      content: 'Hongera! Kundi letu limepata uwekezaji wa TSH 500,000 kutoka Washika DAU Fund.',
      priority: 'low',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Matangazo</h2>
      
      <div className="space-y-4">
        {announcements.map((announcement, index) => (
          <div key={index} className={`border-l-4 p-4 rounded-lg ${
            announcement.priority === 'high' ? 'border-red-500 bg-red-50' :
            announcement.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
            'border-green-500 bg-green-50'
          }`}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
              <span className="text-sm text-gray-500">{announcement.date}</span>
            </div>
            <p className="text-gray-700">{announcement.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsSection() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Ripoti za Biashara</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Mapato ya Mwezi</h3>
          <p className="text-3xl font-bold">TSH 450,000</p>
          <p className="text-sm opacity-90">+15% kutoka mwezi uliopita</p>
        </div>
        
        <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Faida ya Mwezi</h3>
          <p className="text-3xl font-bold">TSH 180,000</p>
          <p className="text-sm opacity-90">+8% kutoka mwezi uliopita</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Ripoti za Hivi Karibuni</h3>
        
        <div className="space-y-3">
          {['Ripoti ya Mwezi wa 8', 'Ripoti ya Mwezi wa 7', 'Ripoti ya Mwezi wa 6'].map((report, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
              <div className="flex items-center space-x-3">
                <DocumentTextIcon className="h-8 w-8 text-orange-600" />
                <span className="font-medium text-gray-900">{report}</span>
              </div>
              <button className="text-orange-600 hover:text-orange-700 font-medium">
                Pakua
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
