'use client';

import { ChartBarIcon } from '@heroicons/react/24/outline';
import GrowthChart from '@/components/GrowthChart';

export default function OverviewSection({ adminStats, recentActivities }: { adminStats: any; recentActivities: any[] }) {
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
        <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Ukuaji wa Wanachama</h3>
          <GrowthChart memberCount={adminStats?.totalMembers || 0} groupCount={adminStats?.totalGroups || 0} />
        </div>

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
