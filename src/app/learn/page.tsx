'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AcademicCapIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ChartBarIcon,
  UserGroupIcon,
  LightBulbIcon,
  PlayCircleIcon,
  BookOpenIcon,
  CheckCircleIcon,
  LockClosedIcon,
  ArrowRightIcon,
  LanguageIcon,
} from '@heroicons/react/24/outline';

export default function LearnPortal() {
  const router = useRouter();
  const [language, setLanguage] = useState<'sw' | 'en'>('en');
  const [user, setUser] = useState<any>(null);
  const [progress, setProgress] = useState({
    totalModules: 0,
    completedModules: 0,
    currentLevel: 'Beginner',
    points: 0,
  });
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [trainingModules, setTrainingModules] = useState<any[]>([]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
      // TODO: Fetch user's learning progress
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingTracks(true);
      setTracksError(null);
      try {
        const res = await fetch('/api/public/training');
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load training');
        if (cancelled) return;
        const modules = Array.isArray(data) ? data : [];
        setTrainingModules(modules);
        setProgress((p) => ({ ...p, totalModules: modules.length }));
      } catch (e) {
        if (cancelled) return;
        setTracksError(e instanceof Error ? e.message : 'Failed to load training');
      } finally {
        if (!cancelled) setLoadingTracks(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const content = {
    en: {
      title: 'Jifunze - AI-Powered Learning Platform',
      subtitle: 'Master Financial Literacy & Crypto - Built for Tanzanian Women',
      startLearning: 'Start Your Journey',
      continueLearn: 'Continue Learning',
      myProgress: 'My Progress',
      switchLang: 'Swahili',
    },
    sw: {
      title: 'Jifunze - Jukwaa la Kujifunza lenye AI',
      subtitle: 'Jifunze Fedha & Crypto - Kwa Wanawake wa Tanzania',
      startLearning: 'Anza Safari Yako',
      continueLearn: 'Endelea Kujifunza',
      myProgress: 'Maendeleo Yangu',
      switchLang: 'English',
    },
  };

  const t = content[language];

  const getModuleIcon = (category: string | null | undefined) => {
    const c = String(category || '').toLowerCase();
    if (c.includes('finance') || c.includes('fedha')) return CurrencyDollarIcon;
    if (c.includes('business') || c.includes('biashara')) return ChartBarIcon;
    if (c.includes('leadership') || c.includes('uongozi')) return UserGroupIcon;
    if (c.includes('security') || c.includes('usalama')) return ShieldCheckIcon;
    if (c.includes('internet') || c.includes('digital') || c.includes('dijitali')) return GlobeAltIcon;
    return BookOpenIcon;
  };

  // AI Features
  const aiFeatures = [
    {
      icon: SparklesIcon,
      title: language === 'en' ? 'Personalized Learning Path' : 'Njia ya Kujifunza Binafsi',
      description: language === 'en'
        ? 'AI adapts to your pace, goals, and learning style'
        : 'AI inabadilika kulingana na kasi yako, malengo, na mtindo wako wa kujifunza',
    },
    {
      icon: LightBulbIcon,
      title: language === 'en' ? 'Real Scenario Analysis' : 'Uchambuzi wa Hali Halisi',
      description: language === 'en'
        ? 'Input your financial situations, get AI-powered guidance'
        : 'Weka hali yako ya kifedha, pata mwongozo kutoka kwa AI',
    },
    {
      icon: PlayCircleIcon,
      title: language === 'en' ? 'Interactive Practice' : 'Mazoezi ya Kushirikiana',
      description: language === 'en'
        ? 'Sandbox environment for risk-free learning'
        : 'Mazingira salama ya mazoezi bila hatari',
    },
    {
      icon: BookOpenIcon,
      title: language === 'en' ? 'Audio + Visual Learning' : 'Kujifunza kwa Sauti + Picha',
      description: language === 'en'
        ? 'Multiple formats for all learning styles'
        : 'Aina nyingi za kujifunza kwa mitindo yote',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <AcademicCapIcon className="h-8 w-8 text-orange-600 mr-3" />
                {t.title}
              </h1>
              <p className="text-gray-600 mt-1">{t.subtitle}</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setLanguage(language === 'en' ? 'sw' : 'en')}
                className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <LanguageIcon className="h-5 w-5 mr-2" />
                {t.switchLang}
              </button>
              {user && (
                <button
                  onClick={() => router.push('/member-dashboard')}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  {language === 'en' ? 'My Dashboard' : 'Dashibodi Yangu'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress Banner */}
        {user && (
          <div className="bg-white border-2 border-orange-200 rounded-lg p-8 mb-12">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{t.myProgress}</h2>
                <div className="flex items-center space-x-8">
                  <div>
                    <p className="text-gray-600 text-sm mb-1">
                      {language === 'en' ? 'Modules Completed' : 'Moduli Zilizokamilika'}
                    </p>
                    <p className="text-3xl font-bold text-orange-600">
                      {progress.completedModules}/{progress.totalModules}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm mb-1">
                      {language === 'en' ? 'Current Level' : 'Kiwango Sasa'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">{progress.currentLevel}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm mb-1">
                      {language === 'en' ? 'Points Earned' : 'Pointi Zilizochukuliwa'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">{progress.points}</p>
                  </div>
                </div>
              </div>
              <button className="bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors">
                {t.continueLearn}
                <ArrowRightIcon className="h-5 w-5 inline ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* AI Features */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <SparklesIcon className="h-6 w-6 text-orange-600 mr-2" />
            {language === 'en' ? 'AI-Powered Learning Experience' : 'Uzoefu wa Kujifunza wenye AI'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {aiFeatures.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-6 border border-gray-200 hover:border-orange-300 hover:shadow-sm transition-all"
              >
                <feature.icon className="h-10 w-10 text-orange-600 mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Learning Tracks */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {language === 'en' ? 'Learning Tracks' : 'Njia za Kujifunza'}
          </h2>
          {tracksError && (
            <div className="bg-white border border-red-200 rounded-lg p-6 text-sm text-red-700">
              {tracksError}
            </div>
          )}
          {loadingTracks && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-700">
              {language === 'en' ? 'Loading training...' : 'Inapakia mafunzo...'}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {!loadingTracks && !tracksError && trainingModules.map((track) => {
              const Icon = getModuleIcon(track.category);
              const modulesCount = Number(track.lesson_count || 0);
              const level = String(track.level || 'Beginner');
              return (
              <div
                key={track.id}
                className="bg-white rounded-lg border-2 transition-all overflow-hidden border-gray-200 hover:border-orange-400 cursor-pointer hover:shadow-md"
                onClick={() => router.push(`/learn/${track.id}`)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-lg bg-orange-50">
                      <Icon className="h-8 w-8 text-orange-600" />
                    </div>
                    <CheckCircleIcon className="h-6 w-6 text-green-500" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{track.title}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{track.description || ''}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4 pb-4 border-b border-gray-200">
                    <span className="flex items-center">
                      <BookOpenIcon className="h-4 w-4 mr-1 text-gray-500" />
                      {modulesCount} {language === 'en' ? 'lessons' : 'masomo'}
                    </span>
                    <span>{track.duration_hours ? `${track.duration_hours}h` : ''}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      level === 'beginner' || level === 'Beginner' ? 'bg-green-100 text-green-700' :
                      level === 'intermediate' || level === 'Intermediate' ? 'bg-blue-100 text-blue-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {level}
                    </span>
                    
                    <span className="text-orange-600 font-semibold flex items-center text-sm">
                      {language === 'en' ? 'Start' : 'Anza'}
                      <ArrowRightIcon className="h-4 w-4 ml-1" />
                    </span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Call to Action */}
        {!user && (
          <div className="mt-16 bg-orange-600 rounded-lg p-12 text-center">
            <h2 className="text-3xl font-bold mb-4 text-white">
              {language === 'en' 
                ? 'Ready to Transform Your Financial Future?'
                : 'Uko tayari kubadilisha mustakbali wako wa kifedha?'
              }
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-3xl mx-auto">
              {language === 'en'
                ? 'Join thousands of Tanzanian women learning to manage money, build businesses, and explore new opportunities.'
                : 'Jiunge na wanawake elfu za Tanzania wanaojifunza kudhibiti pesa, kuanzisha biashara, na kuchunguza fursa mpya.'
              }
            </p>
            <button
              onClick={() => router.push('/portal')}
              className="bg-white text-orange-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-50 transition-colors inline-flex items-center"
            >
              {t.startLearning}
              <ArrowRightIcon className="h-6 w-6 ml-2" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
