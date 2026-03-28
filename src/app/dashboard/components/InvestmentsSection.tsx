'use client';

import React, { useState } from 'react';
import { PlusIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { dkInput, dkSelect, dkLabel } from './shared';

export default function InvestmentsSection({ investments, groups, loadAdminData }: { investments: any[]; groups: any[]; loadAdminData: () => void }) {
  const [showInvestmentForm, setShowInvestmentForm] = useState(false);
  const [investmentForm, setInvestmentForm] = useState({ groupId: '', amount: '', equityPercentage: '', expectedReturn: '', notes: '' });

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
