'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  ArcElement
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserGroupIcon,
  UsersIcon
} from '@heroicons/react/24/outline';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler, ArcElement);

type ReportPayload = {
  month: string;
  period: { start: string; end: string };
  totals: {
    totalMembers: number;
    totalGroups: number;
    totalInvestment: number;
    totalReturns: number;
    returnRate: number;
  };
  monthly: {
    newMembers: number;
    newGroups: number;
    contributionsTotal: number;
    contributionsPaidCount: number;
    contributionsTotalCount: number;
    investmentsAmount: number;
    investmentsCount: number;
    returnsAmount: number;
    businessReportsCount: number;
    revenueSum: number;
    expensesSum: number;
    profitSum: number;
    revenueAvg: number;
    profitAvg: number;
    prevRevenueSum: number;
    prevProfitSum: number;
  };
  special: {
    gender: { gender: string; count: number }[];
  };
  trends: {
    month: string;
    members: number;
    groups: number;
    contributions: number;
    revenue: number;
    profit: number;
  }[];
};

function formatTsh(n: number) {
  return `TSH ${Math.round(n).toLocaleString('en-US')}`;
}

function percentChange(prev: number, curr: number) {
  if (!prev && !curr) return 0;
  if (!prev) return 100;
  return ((curr - prev) / prev) * 100;
}

function monthLabel(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' });
}

export default function AdminReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const month = searchParams.get('month');
  const print = searchParams.get('print');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportPayload | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'admin') {
      router.push('/member-dashboard');
    }
  }, [router]);

  useEffect(() => {
    const validMonth = month && /^[0-9]{4}-[0-9]{2}$/.test(month) ? month : null;
    if (!validMonth) {
      const d = new Date();
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      router.replace(`/dashboard/report?month=${m}${print ? `&print=${encodeURIComponent(print)}` : ''}`);
      return;
    }

    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/report?month=${encodeURIComponent(validMonth)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load report');
        if (!active) return;
        setData(json);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [month, print, router]);

  useEffect(() => {
    if (!data) return;
    if (print !== '1') return;
    const t = setTimeout(() => window.print(), 800);
    return () => clearTimeout(t);
  }, [data, print]);

  const label = useMemo(() => (data?.month ? monthLabel(data.month) : ''), [data?.month]);

  const charts = useMemo(() => {
    if (!data) return null;

    const labels = data.trends.map((t) => t.month);

    const growth = {
      data: {
        labels,
        datasets: [
          {
            label: 'Wanachama (Members)',
            data: data.trends.map((t) => t.members),
            borderColor: 'rgb(249, 115, 22)',
            backgroundColor: 'rgba(249, 115, 22, 0.10)',
            fill: true,
            tension: 0.35
          },
          {
            label: 'Vikundi (Groups)',
            data: data.trends.map((t) => t.groups),
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.10)',
            fill: true,
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' as const } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
      }
    };

    const genderRows = data.special.gender;
    const gender = {
      data: {
        labels: genderRows.map((r) => r.gender),
        datasets: [
          {
            data: genderRows.map((r) => r.count),
            backgroundColor: ['#f97316', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#64748b'],
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right' as const } }
      }
    };

    return { growth, gender };
  }, [data]);

  const narrative = useMemo(() => {
    if (!data) return [] as string[];

    const contribRate = data.monthly.contributionsTotalCount
      ? (data.monthly.contributionsPaidCount / data.monthly.contributionsTotalCount) * 100
      : 0;

    const revMoM = percentChange(data.monthly.prevRevenueSum, data.monthly.revenueSum);
    const profitMoM = percentChange(data.monthly.prevProfitSum, data.monthly.profitSum);

    return [
      `Kwa mwezi wa ${label}, tuna jumla ya wanachama ${data.totals.totalMembers.toLocaleString('sw-TZ')} na vikundi ${data.totals.totalGroups.toLocaleString('sw-TZ')}. Mwezi huu tumeongeza wanachama ${data.monthly.newMembers.toLocaleString('sw-TZ')} na vikundi vipya ${data.monthly.newGroups.toLocaleString('sw-TZ')}.`,
      `Michango ya mwezi: jumla ${formatTsh(data.monthly.contributionsTotal)}. Kiwango cha malipo ni ${contribRate.toFixed(1)}% (${data.monthly.contributionsPaidCount}/${data.monthly.contributionsTotalCount}).`,
      `Ripoti za biashara zilizowasilishwa: ${data.monthly.businessReportsCount.toLocaleString('sw-TZ')}. Mapato ${formatTsh(data.monthly.revenueSum)} na faida ${formatTsh(data.monthly.profitSum)}. Mabadiliko ya ${revMoM.toFixed(1)}% (mapato) na ${profitMoM.toFixed(1)}% (faida) ukilinganisha na mwezi uliopita.`,
      `Uwekezaji mpya: ${formatTsh(data.monthly.investmentsAmount)} (miamala ${data.monthly.investmentsCount.toLocaleString('sw-TZ')}).`
    ];
  }, [data, label]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600">Inapakia ripoti...</p>
        </div>
      </div>
    );
  }

  if (error || !data || !charts) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-xl font-bold text-gray-900">Imeshindikana kupakia ripoti</h1>
          <p className="mt-2 text-sm text-gray-600">{error || 'Haijulikani'}</p>
          <div className="mt-4 flex gap-3">
            <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-orange-600 text-white font-medium">Jaribu tena</button>
            <button onClick={() => router.push('/dashboard')} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900 font-medium">Rudi Dashibodi</button>
          </div>
        </div>
      </div>
    );
  }

  const contributionRate = data.monthly.contributionsTotalCount
    ? (data.monthly.contributionsPaidCount / data.monthly.contributionsTotalCount) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-card { box-shadow: none !important; border: none !important; }
          .page-break { break-before: page; page-break-before: always; }
        }
      `}</style>

      <div className="no-print bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-6 w-6 text-orange-600" />
            <div>
              <p className="text-sm text-gray-500">Ripoti Kamili</p>
              <p className="text-lg font-semibold text-gray-900">{label}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700">Pakua PDF (Print)</button>
            <button onClick={() => router.push('/dashboard')} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900 font-medium hover:bg-gray-200">Rudi Dashibodi</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 print-card">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Ripoti ya JUKUMU</h1>
              <p className="mt-1 text-sm text-gray-600">Ripoti ya mwezi na ripoti maalum (nyaraka moja)</p>
              <p className="mt-2 text-sm text-gray-600">Kipindi: {new Date(data.period.start).toLocaleDateString('sw-TZ')} - {new Date(data.period.end).toLocaleDateString('sw-TZ')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Tarehe ya Kutolewa</p>
              <p className="text-sm font-medium text-gray-900">{new Date().toLocaleDateString('sw-TZ')}</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><UsersIcon className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <p className="text-xs text-gray-500">Wanachama</p>
                  <p className="text-xl font-bold text-gray-900">{data.totals.totalMembers.toLocaleString('sw-TZ')}</p>
                  <p className="text-xs text-green-600">+{data.monthly.newMembers.toLocaleString('sw-TZ')} mwezi huu</p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><UserGroupIcon className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-xs text-gray-500">Vikundi</p>
                  <p className="text-xl font-bold text-gray-900">{data.totals.totalGroups.toLocaleString('sw-TZ')}</p>
                  <p className="text-xs text-green-600">+{data.monthly.newGroups.toLocaleString('sw-TZ')} mwezi huu</p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center"><CurrencyDollarIcon className="h-5 w-5 text-orange-600" /></div>
                <div>
                  <p className="text-xs text-gray-500">Michango (mwezi)</p>
                  <p className="text-xl font-bold text-gray-900">{formatTsh(data.monthly.contributionsTotal)}</p>
                  <p className="text-xs text-gray-600">Malipo {contributionRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><ChartBarIcon className="h-5 w-5 text-red-600" /></div>
                <div>
                  <p className="text-xs text-gray-500">Mapato ya Jumla</p>
                  <p className="text-xl font-bold text-gray-900">{formatTsh(data.totals.totalReturns)}</p>
                  <p className="text-xs text-gray-600">ROI {data.totals.returnRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900">Simulizi (Story) ya Takwimu</h2>
            <div className="mt-3 space-y-2">
              {narrative.map((t, i) => (
                <p key={i} className="text-sm text-gray-700 leading-6">{t}</p>
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-5">
              <h3 className="text-base font-semibold text-gray-900">Ukuaji (miezi 6)</h3>
              <div className="mt-4 h-64">
                <Line data={charts.growth.data} options={charts.growth.options} />
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-5">
              <h3 className="text-base font-semibold text-gray-900">Takwimu za Jinsia</h3>
              <div className="mt-4 h-64">
                <Doughnut data={charts.gender.data} options={charts.gender.options} />
              </div>
            </div>
          </div>

          <div className="page-break mt-10">
            <h2 className="text-xl font-bold text-gray-900">Ripoti za Maalum (Muhtasari)</h2>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-500">Ukuaji wa Biashara</p>
                <p className="mt-1 text-sm text-gray-900">Mapato: <span className="font-semibold">{formatTsh(data.monthly.revenueSum)}</span></p>
                <p className="text-sm text-gray-900">Faida: <span className="font-semibold">{formatTsh(data.monthly.profitSum)}</span></p>
                <p className="text-xs text-gray-600 mt-2">Wastani wa mapato: {formatTsh(data.monthly.revenueAvg)}</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-500">Michango</p>
                <p className="mt-1 text-sm text-gray-900">Jumla: <span className="font-semibold">{formatTsh(data.monthly.contributionsTotal)}</span></p>
                <p className="text-xs text-gray-600 mt-2">Malipo: {data.monthly.contributionsPaidCount}/{data.monthly.contributionsTotalCount}</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-500">Uwekezaji</p>
                <p className="mt-1 text-sm text-gray-900">Mwezi huu: <span className="font-semibold">{formatTsh(data.monthly.investmentsAmount)}</span></p>
                <p className="text-xs text-gray-600 mt-2">Miamala: {data.monthly.investmentsCount.toLocaleString('sw-TZ')}</p>
              </div>
            </div>

            <div className="mt-6 border border-gray-200 rounded-lg p-4">
              <h3 className="text-base font-semibold text-gray-900">Muhtasari wa Fedha (Mwezi)</h3>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Mapato</p>
                  <p className="text-sm font-semibold text-gray-900">{formatTsh(data.monthly.revenueSum)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Matumizi</p>
                  <p className="text-sm font-semibold text-gray-900">{formatTsh(data.monthly.expensesSum)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Faida</p>
                  <p className="text-sm font-semibold text-gray-900">{formatTsh(data.monthly.profitSum)}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-xs text-gray-500">
              <p>Ripoti hii imetengenezwa moja kwa moja kutoka kwenye mfumo wa JUKUMU. Kwa maswali au marekebisho ya data, tafadhali wasiliana na msimamizi wa mfumo.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
