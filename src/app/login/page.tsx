'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function LoginPage() {
  const { } = useLanguage();
  const router = useRouter();
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: formData.identifier,
          password: formData.password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Role-based redirect
        if (data.user.role === 'admin') {
          router.push('/dashboard');
        } else {
          router.push('/member-dashboard');
        }
      } else {
        let errorData: { error?: string } | null = null;
        try {
          errorData = await response.json();
        } catch {
          errorData = null;
        }

        if (response.status === 409) {
          setError(
            errorData?.error ||
              'Namba ya simu inatumika kwenye akaunti zaidi ya moja. Tafadhali ingia kwa barua pepe au wasiliana nasi.'
          );
        } else if (response.status === 500) {
          const details =
            typeof (errorData as { details?: unknown } | null)?.details === 'string'
              ? ` (${(errorData as { details?: string }).details})`
              : '';
          const requestId =
            typeof (errorData as { requestId?: unknown } | null)?.requestId === 'string'
              ? ` [${(errorData as { requestId?: string }).requestId}]`
              : '';
          setError((errorData?.error || 'Hitilafu imetokea. Jaribu tena.') + details + requestId);
        } else {
          setError('Barua pepe/nambari ya simu au nywila si sahihi. Hakikisha umesajili kwanza.');
        }
      }
    } catch (error: unknown) {
      console.error('Login error:', error);
      setError('Hitilafu imetokea. Jaribu tena.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent to-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-primary to-destructive">
              <span className="text-xl font-bold text-white">W</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">JUKUMU</h1>
            </div>
          </Link>
          <h2 className="text-3xl font-bold text-foreground">Ingia kwenye akaunti yako</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Au{' '}
            <Link href="/register" className="font-medium text-primary hover:text-primary/80">
              jisajili kama mwanachama mpya
            </Link>
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-card rounded-xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-muted-foreground mb-2">
                Barua pepe au nambari ya simu
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                required
                value={formData.identifier}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
                placeholder="07xx xxx xxx au email@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-2">
                Nywila
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200 pr-12"
                  placeholder="Weka nywila yako"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary focus:ring-ring border-border rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-foreground">
                  Nikumbuke
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-primary hover:text-primary/80">
                  Umesahau nywila?
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Inaingia...
                </div>
              ) : (
                'Ingia'
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
