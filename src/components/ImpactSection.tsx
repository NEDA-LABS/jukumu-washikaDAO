'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  StarIcon,
  EyeIcon,
  HeartIcon,
  ArrowRightIcon,
  PlayIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  BookOpenIcon,
  AcademicCapIcon,
  ClockIcon,
  UsersIcon,
  BanknotesIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';

import { useLanguage } from '@/contexts/LanguageContext';
import { ChartBarIcon, BuildingStorefrontIcon, ArrowTrendingUpIcon, LightBulbIcon } from '@heroicons/react/24/outline';

export default function ImpactSection() {
  const { t } = useLanguage();

  const stats = [
    {
      icon: UserGroupIcon,
      number: '120+',
      label: t('impact.groups'),
      color: 'from-orange-500 to-red-500',
      image: '/PXL_20250531_095142372.PORTRAIT.jpg',
    },
    {
      icon: ChartBarIcon,
      number: '42+',
      label: t('impact.cbts'),
      color: 'from-green-500 to-emerald-500',
      image: '/PXL_20250618_095258793.PORTRAIT.jpg',
    },
    {
      icon: BuildingStorefrontIcon,
      number: '200+',
      label: t('impact.businesses'),
      color: 'from-blue-500 to-indigo-500',
      image: '/PXL_20250805_160021888.PORTRAIT.jpg',
    },
    {
      icon: ArrowTrendingUpIcon,
      number: '∞',
      label: t('impact.growing'),
      color: 'from-purple-500 to-pink-500',
      image: '/PXL_20250815_151019991.PORTRAIT.jpg',
    },
  ];

  const testimonials = [
    {
      name: 'Mwanachama wa Washika DAU',
      role: 'Kundi la Biashara - Tanzania',
      quote: 'Washika DAU ni mfumo mpya wa kuwezesha wajasiriamali. Tunasubiri wanachama wajisajili.',
      image: '/PXL_20250527_143914521.PORTRAIT.jpg',
    },
    {
      name: 'Mjasiriamali',
      role: 'Kundi la Maendeleo - Tanzania',
      quote: 'Mfumo huu utasaidia wajasiriamali kupata mafunzo na msaada wa kifedha.',
      image: '/PXL_20250531_084511611.PORTRAIT.jpg',
    },
    {
      name: 'Mwanzilishi wa Biashara',
      role: 'Kundi la Uongozi - Tanzania',
      quote: 'Tunatarajia kuona mafanikio makubwa kupitia ushirikiano na Washika DAU.',
      image: '/PXL_20250722_105646219.PORTRAIT.jpg',
    },
  ];

  const [educationalContent, setEducationalContent] = useState<{id: number; title: string; description: string; category: string; categoryColor: string; duration: string; participants: number; icon: any; image: string}[]>([]);

  useEffect(() => {

    const fetchEducationalContent = async () => {
      try {
        // Use the new public training API instead of educational-content
        const response = await fetch('/api/public/training');
        if (response.ok) {
          const data = await response.json();
          // Take only the first 3 items for preview
          const previewContent = data.slice(0, 3).map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            categoryColor: getCategoryColor(item.category),
            duration: `${item.duration_hours}h • ${item.lesson_count} masomo`,
            participants: 0, // We don't track enrollment for public view yet
            icon: getCategoryIcon(item.category),
            image: '/PXL_20250618_095258793.PORTRAIT.jpg' // Default training image
          }));
          setEducationalContent(previewContent);
        }
      } catch (error) {
        console.error('Error fetching educational content:', error);
        // Fallback to empty array if API fails
        setEducationalContent([]);
      }
    };

    fetchEducationalContent();
  }, []);

  const handleCategoryFilter = (category: string) => {
    const colors: { [key: string]: string } = {
      'Biashara': 'bg-blue-100 text-blue-800',
      'Uongozi': 'bg-green-100 text-green-800',
      'Fedha': 'bg-orange-100 text-orange-800',
      'Teknolojia': 'bg-purple-100 text-purple-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Biashara': 'bg-blue-100 text-blue-800',
      'Uongozi': 'bg-green-100 text-green-800',
      'Fedha': 'bg-orange-100 text-orange-800',
      'Teknolojia': 'bg-purple-100 text-purple-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: any } = {
      'Biashara': CurrencyDollarIcon,
      'Uongozi': UserGroupIcon,
      'Fedha': BanknotesIcon,
      'Teknolojia': ComputerDesktopIcon
    };
    return icons[category] || BookOpenIcon;
  };

  const communityImages = [
    '/PXL_20250531_080619239.PORTRAIT.jpg',
    '/PXL_20250606_175204719.PORTRAIT.jpg',
    '/PXL_20250618_112718098.PORTRAIT.jpg',
    '/PXL_20250621_095639982.PORTRAIT.jpg',
    '/PXL_20250707_142902155.PORTRAIT.jpg',
    '/PXL_20250716_150000623.PORTRAIT.jpg',
    '/PXL_20250731_150045170.PORTRAIT.jpg',
    '/PXL_20250818_121921041.PORTRAIT.jpg',
  ];

  return (
    <section id="impact" className="relative py-24 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2315803d' fill-opacity='0.4'%3E%3Cpath d='M20 20c0 11.046-8.954 20-20 20v-40c11.046 0 20 8.954 20 20z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Impact Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 bg-green-100 rounded-full mb-6">
            <span className="text-green-600 text-sm font-semibold">Athari Yetu</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            {t('impact.title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Tunajenga jamii ya wajasiriamali wenye nguvu kupitia ushirikiano na maendeleo endelevu.
          </p>
        </div>

        {/* Stats Grid - Redesigned */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {stats.map((stat, index) => (
            <div key={index} className="group relative overflow-hidden rounded-3xl transform hover:scale-105 transition-all duration-500">
              <div className="absolute inset-0">
                <Image
                  src={stat.image}
                  alt={stat.label}
                  fill
                  className="object-cover"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${stat.color} opacity-80`}></div>
              </div>
              
              <div className="relative z-10 p-8 text-white text-center h-64 flex flex-col justify-center">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="h-8 w-8 text-white" />
                </div>
                <div className="text-4xl font-bold mb-2">{stat.number}</div>
                <div className="text-lg font-medium opacity-90">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Educational Hub - Learning Content Preview */}
        <div className="space-y-16">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full mb-6">
              <span className="text-blue-600 text-sm font-semibold">Kituo cha Elimu</span>
            </div>
            <h3 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Mafunzo na Elimu
            </h3>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Pata mafunzo ya kisasa ya biashara, uongozi na maendeleo ya kiuchumi
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {educationalContent.map((content, index) => (
              <div key={index} className="group relative overflow-hidden rounded-3xl bg-white shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:-translate-y-2">
                <div className="aspect-w-16 aspect-h-9 relative h-64">
                  <Image
                    src={content.image}
                    alt={content.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${content.categoryColor}`}>
                      {content.category}
                    </span>
                  </div>
                </div>
                
                <div className="p-8">
                  <div className="flex items-center mb-4">
                    <content.icon className="h-6 w-6 text-blue-600 mr-2" />
                    <span className="text-sm text-gray-500">{content.duration}</span>
                  </div>
                  
                  <h4 className="text-xl font-bold text-gray-900 mb-3">{content.title}</h4>
                  <p className="text-gray-600 leading-relaxed mb-4">{content.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-500">
                      <UserGroupIcon className="h-4 w-4 mr-1" />
                      <span>{content.participants} wanafunzi</span>
                    </div>
                    <a 
                      href="/login" 
                      className="text-blue-600 hover:text-blue-700 font-semibold text-sm transition-colors"
                    >
                      Jisajili Kusoma →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <a 
              href="/login" 
              className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
            >
              <AcademicCapIcon className="h-6 w-6 mr-3" />
              Jisajili Kuona Mafunzo Yote
            </a>
          </div>
        </div>

        {/* Community Photos Gallery */}
        <div className="mt-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 bg-purple-100 rounded-full mb-6">
              <span className="text-purple-600 text-sm font-semibold">Jamii Yetu</span>
            </div>
            <h3 className="text-4xl font-bold text-gray-900 mb-4">Jamii Yetu</h3>
            <p className="text-xl text-gray-600">
              Picha za jamii yetu ya wajasiriamali kutoka maeneo mbalimbali ya Tanzania
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {communityImages.map((image, index) => (
              <div key={index} className="group relative aspect-square rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105">
                <Image
                  src={image}
                  alt={`Community ${index + 1}`}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
