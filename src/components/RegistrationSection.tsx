'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { UserPlusIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function RegistrationSection({ title }: { title?: string }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    location: '',
    businessType: '',
    idType: '',
    idNumber: '',
    gender: '',
    age: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Nywila hazifanani');
      setIsSubmitting(false);
      return;
    }

    try {
      // Save member data to database first
      console.log('Saving member data to database...');
      const memberResponse = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email.trim() ? formData.email.trim() : null,
          phone: formData.phone,
          location: formData.location,
          businessType: formData.businessType,
          idType: formData.idType,
          idNumber: formData.idNumber,
          gender: formData.gender,
          age: formData.age,
          status: 'pending'
        }),
      });

      if (!memberResponse.ok) {
        const errorData = await memberResponse.json();
        const details =
          typeof errorData?.details === 'string' && errorData.details
            ? ` (${errorData.details})`
            : '';
        throw new Error((errorData.error || 'Failed to save member data') + details);
      }

      const memberData = await memberResponse.json();

      console.log('Member data saved successfully');

      // Create user account with custom auth
      console.log('Creating user account...');
      const authResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim() ? formData.email.trim() : null,
          phone: formData.phone,
          memberId: memberData?.id,
          password: formData.password,
          fullName: formData.fullName,
        }),
      });

      if (authResponse.ok) {
        const authData = await authResponse.json();
        localStorage.setItem('user', JSON.stringify(authData.user));
      
        // Role-based redirect
        if (authData.user.role === 'admin') {
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/member-dashboard';
        }
      } else {
        const authError = await authResponse.json();
        console.error('Auth signup failed:', authError);
        setError('Usajili umekamilika lakini kuna tatizo la kuingia. Jaribu kuingia kwa kutumia barua pepe na nywila uliyoweka.');
        setIsSubmitted(true);
      }
    } catch (error: unknown) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'Hitilafu imetokea. Jaribu tena.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <section id="join" className="py-16 bg-gradient-to-br from-success/10 to-muted">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-card rounded-xl p-8 shadow-lg">
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-4">Asante!</h2>
            <p className="text-muted-foreground mb-6">
              Ombi lako limepokelewa. Timu yetu itawasiliana nawe hivi karibuni.
            </p>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setFormData({
                  fullName: '',
                  email: '',
                  phone: '',
                  password: '',
                  confirmPassword: '',
                  location: '',
                  businessType: '',
                  idType: '',
                  idNumber: '',
                  gender: '',
                  age: '',
                });
              }}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors duration-200"
            >
              Sajili Mwingine
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="join" className="relative py-24 bg-gradient-to-br from-accent via-destructive/5 to-muted overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ea580c' fill-opacity='0.4'%3E%3Cpath d='M30 30c0 16.569-13.431 30-30 30v-60c16.569 0 30 13.431 30 30z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Side - Images and Info */}
          <div className="space-y-8">
            <div className="text-left">
              <div className="inline-flex items-center px-4 py-2 bg-accent rounded-full mb-6">
                <span className="text-primary text-sm font-semibold">Jiunge Nasi</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
                {title ?? t('registration.title')}
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed mb-8">
                Jiunge na jamii ya wajasiriamali na uanze safari yako ya mafanikio kupitia ushirikiano na mafunzo ya kisasa.
              </p>
              
              {/* Benefits List */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="text-muted-foreground">Mafunzo ya biashara bila malipo</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="text-muted-foreground">Uongozi wa kikundi na msaada wa mtandao</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="text-muted-foreground">Fursa za uwekezaji na ukuaji wa biashara</span>
                </div>
              </div>
            </div>

            {/* Image Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src="/PXL_20250531_074211116.PORTRAIT.jpg"
                    alt="Washika DAU member"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src="/PXL_20250618_095258793.PORTRAIT.jpg"
                    alt="Business training"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="space-y-4 pt-8">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src="/PXL_20250621_095639982.PORTRAIT.jpg"
                    alt="Group meeting"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-xl">
                  <Image
                    src="/PXL_20250707_142902155.PORTRAIT.jpg"
                    alt="Success story"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Registration Form */}
          <div className="bg-card rounded-3xl shadow-2xl p-8 lg:p-12">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-foreground mb-2">Jaza Fomu</h3>
              <p className="text-muted-foreground">Hatua ya kwanza ya kujiunge na Washika DAU</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-muted-foreground mb-2">
                  {t('registration.name')} *
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
                  placeholder="Jina lako kamili"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">
                  Barua Pepe (si lazima)
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
                  placeholder="email@example.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-muted-foreground mb-2">
                  Nambari ya Simu *
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
                  placeholder="+255 123 456 789"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-2">
                  Nywila *
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
                  placeholder="Weka nywila yako"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-muted-foreground mb-2">
                  Thibitisha Nywila *
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
                  placeholder="Rudia nywila yako"
                />
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-muted-foreground mb-2">
                  {t('registration.location')} *
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  required
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
                  placeholder="Mji/Mkoa"
                />
              </div>

              {/* Business Type */}
              <div>
                <label htmlFor="businessType" className="block text-sm font-medium text-muted-foreground mb-2">
                  {t('registration.business_type')} *
                </label>
                <select
                  id="businessType"
                  name="businessType"
                  required
                  value={formData.businessType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200 text-foreground"
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

              {/* ID Type */}
              <div>
                <label htmlFor="idType" className="block text-sm font-medium text-muted-foreground mb-2">
                  Aina ya Kitambulisho *
                </label>
                <select
                  id="idType"
                  name="idType"
                  required
                  value={formData.idType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200 text-foreground"
                >
                  <option value="">Chagua aina ya kitambulisho</option>
                  <option value="national_id">Kitambulisho cha Taifa</option>
                  <option value="voter_id">Kitambulisho cha Mpiga Kura</option>
                  <option value="passport">Paspoti</option>
                </select>
              </div>

              {/* ID Number */}
              <div>
                <label htmlFor="idNumber" className="block text-sm font-medium text-muted-foreground mb-2">
                  Nambari ya Kitambulisho *
                </label>
                <input
                  type="text"
                  id="idNumber"
                  name="idNumber"
                  required
                  value={formData.idNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
                  placeholder="Ingiza nambari ya kitambulisho"
                />
              </div>

              {/* Gender */}
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-muted-foreground mb-2">
                  {t('registration.gender')} *
                </label>
                <select
                  id="gender"
                  name="gender"
                  required
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200 text-foreground"
                >
                  <option value="">Chagua jinsia</option>
                  <option value="mwanamke">Mwanamke</option>
                  <option value="mwanamume">Mwanamume</option>
                </select>
              </div>
            </div>

            {/* Age */}
            <div className="md:w-1/2">
              <label htmlFor="age" className="block text-sm font-medium text-muted-foreground mb-2">
                {t('registration.age')} *
              </label>
              <input
                type="number"
                id="age"
                name="age"
                required
                min="18"
                max="100"
                value={formData.age}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
                placeholder="Umri wako"
              />
            </div>

            {/* Submit Button */}
            <div className="text-center pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Inawasilisha...
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="h-5 w-5 mr-2" />
                    {t('registration.submit')}
                  </>
                )}
              </button>
            </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
