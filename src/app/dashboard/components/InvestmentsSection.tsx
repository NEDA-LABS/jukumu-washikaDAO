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
    <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-foreground">Usimamizi wa Uwekezaji</h2>
        <button onClick={() => setShowInvestmentForm(v => !v)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
          <PlusIcon className="h-4 w-4" /> Uwekezaji Mpya
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Jumla ya Uwekezaji', value: `TSH ${(totalInvestment/1000000).toFixed(1)}M`, cls: 'text-blue-600' },
          { label: 'Mapato ya Jumla', value: `TSH ${(totalReturns/1000000).toFixed(1)}M`, cls: 'text-emerald-600' },
          { label: 'Kiwango cha Mapato', value: `${returnRate}%`, cls: 'text-orange-500' },
        ].map((s,i) => (
          <div key={i} className="rounded-xl bg-foreground/[0.03] border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {showInvestmentForm && (
        <form onSubmit={handleCreateInvestment} className="mb-5 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 space-y-3">
          <p className="text-xs font-semibold text-orange-500 mb-2">Uwekezaji Mpya</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className={dkLabel}>Kundi *</label>
              <select value={investmentForm.groupId} onChange={e => setInvestmentForm({...investmentForm, groupId: e.target.value})} className={dkSelect} required>
                <option value="">Chagua kundi</option>
                {groups.filter(g => g.status === 'active').map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div><label className={dkLabel}>Kiasi (TSH) *</label><input type="number" value={investmentForm.amount} onChange={e => setInvestmentForm({...investmentForm, amount: e.target.value})} className={dkInput} required /></div>
            <div><label className={dkLabel}>Asilimia ya Hisa (%)</label><input type="number" value={investmentForm.equityPercentage} onChange={e => setInvestmentForm({...investmentForm, equityPercentage: e.target.value})} className={dkInput} /></div>
            <div><label className={dkLabel}>Mapato Yanayotarajiwa (TSH)</label><input type="number" value={investmentForm.expectedReturn} onChange={e => setInvestmentForm({...investmentForm, expectedReturn: e.target.value})} className={dkInput} /></div>
          </div>
          <div><label className={dkLabel}>Maelezo</label><input type="text" value={investmentForm.notes} onChange={e => setInvestmentForm({...investmentForm, notes: e.target.value})} className={dkInput} /></div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowInvestmentForm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition-colors">Ghairi</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">Hifadhi</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead><tr className="border-b border-border">
            {['Kundi','Kiasi','Tarehe','Hali','Mapato','Vitendo'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-border">
            {investments.length > 0 ? investments.map(inv => (
              <tr key={inv.id} className="hover:bg-foreground/[0.02]">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{inv.group_name}</td>
                <td className="px-4 py-3 text-sm text-foreground/60">TSH {parseFloat(inv.amount||0).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(inv.investment_date).toLocaleDateString('sw-TZ')}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${inv.status==='active'?'bg-emerald-500/10 text-emerald-600':'bg-yellow-500/10 text-yellow-600'}`}>
                    {inv.status==='active'?'Hai':'Inasubiri'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground/50">{inv.actual_return ? `TSH ${parseFloat(inv.actual_return).toLocaleString()}` : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-xs text-blue-500 hover:text-blue-600 transition-colors">Angalia</button>
                    <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">Hariri</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-12 text-center">
                <CurrencyDollarIcon className="h-8 w-8 mx-auto text-foreground/10 mb-3" />
                <p className="text-sm text-muted-foreground">Hakuna uwekezaji bado</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
