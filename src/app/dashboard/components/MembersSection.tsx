'use client';

import React, { useState } from 'react';
import { PlusIcon, UsersIcon, TrashIcon } from '@heroicons/react/24/outline';
import { dkInput, dkSelect, dkLabel } from './shared';

export default function MembersSection({ members, groups, loadAdminData, showToast }: { members: any[]; groups: any[]; loadAdminData: () => void; showToast: (msg: string, type?: any) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [memberForm, setMemberForm] = useState({ fullName: '', email: '', phone: '', location: '', businessType: '', idType: '', idNumber: '', gender: '', age: '' });

  const filteredMembers = members.filter(m => {
    const term = searchTerm.toLowerCase();
    const match = String(m?.full_name || '').toLowerCase().includes(term) || String(m?.email || '').toLowerCase().includes(term);
    return match && (!statusFilter || m.status === statusFilter);
  });

  const handleStatusChange = async (memberId: number, newStatus: string) => {
    try {
      await fetch('/api/admin/members', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: memberId, status: newStatus }) });
      loadAdminData();
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
  };

  const handleAddToGroup = async (memberId: number, groupId: number, el?: HTMLSelectElement) => {
    try {
      const res = await fetch('/api/admin/members', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: memberId, groupId }) });
      const data = await res.json();
      if (el) el.value = '';
      if (res.ok && data.success) { loadAdminData(); showToast(data.message || 'Mwanachama ameongezwa kwenye kundi!', 'success'); }
      else showToast(data.error || 'Hitilafu imetokea', 'error');
    } catch { if (el) el.value = ''; showToast('Hitilafu ya mtandao', 'error'); }
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: memberForm.fullName, contact: memberForm.email || memberForm.phone, location: memberForm.location, businessType: memberForm.businessType, groupName: '', gender: memberForm.gender, age: parseInt(memberForm.age) }) });
      if (res.ok) {
        setShowMemberForm(false);
        setMemberForm({ fullName: '', email: '', phone: '', location: '', businessType: '', idType: '', idNumber: '', gender: '', age: '' });
        loadAdminData();
        showToast('Mwanachama ameongezwa kwa mafanikio!', 'success');
      } else showToast('Hitilafu imetokea. Jaribu tena.', 'error');
    } catch { showToast('Hitilafu imetokea. Jaribu tena.', 'error'); }
  };

  const handleDeleteMember = async (member: any) => {
    try {
      const res = await fetch('/api/admin/members', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: member.id }) });
      const data = await res.json();
      if (res.ok && data.success) { loadAdminData(); showToast(data.message || 'Mwanachama amefutwa!', 'success'); }
      else showToast(data.error || 'Hitilafu imetokea', 'error');
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
  };

  const statusBadge = (s: string) => s === 'active' ? 'bg-emerald-500/10 text-emerald-600' : s === 'pending' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-red-500/10 text-red-600';

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Usimamizi wa Wanachama</h2>
          <button onClick={() => setShowMemberForm(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
            <PlusIcon className="h-4 w-4" /> Mwanachama Mpya
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <input type="text" placeholder="Tafuta wanachama..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={dkInput} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={dkSelect}>
            <option value="">Hali zote</option>
            <option value="active">Hai</option>
            <option value="pending">Inasubiri</option>
            <option value="inactive">Haifanyi kazi</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-border">
                {['Mwanachama','Kundi','Hali','Tarehe','Vitendo'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMembers.length > 0 ? filteredMembers.map(m => (
                <tr key={m.id} className="hover:bg-foreground/[0.02]">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">{m.full_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.email}</div>
                    <div className="text-xs text-foreground/30">{m.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-foreground/60">{m.group_names || '—'}</div>
                    {m.group_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600">{m.group_count} kundi</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select value={m.status} onChange={e => handleStatusChange(m.id, e.target.value)} className={`text-xs rounded-full px-2 py-1 border-0 cursor-pointer ${statusBadge(m.status)} bg-transparent`}>
                      <option value="pending">Inasubiri</option>
                      <option value="active">Hai</option>
                      <option value="inactive">Haifanyi kazi</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString('sw-TZ')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select onChange={e => { if (e.target.value) handleAddToGroup(m.id, parseInt(e.target.value), e.target as HTMLSelectElement); }} className="text-xs bg-foreground/5 border border-border text-foreground/50 rounded-lg px-2 py-1 focus:outline-none" defaultValue="">
                        <option value="">+ Ongeza kwenye kundi</option>
                        {groups.filter(g => g.status === 'active').map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      {m.status === 'inactive' && (
                        <button onClick={() => handleDeleteMember(m)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-colors" title="Futa">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-12 text-center">
                  <UsersIcon className="h-8 w-8 mx-auto text-foreground/10 mb-3" />
                  <p className="text-sm text-muted-foreground">Hakuna wanachama</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showMemberForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-overlay border border-border p-6 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-foreground">Mwanachama Mpya</h3>
              <button onClick={() => setShowMemberForm(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <form onSubmit={handleMemberSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className={dkLabel}>Jina Kamili *</label><input type="text" value={memberForm.fullName} onChange={e => setMemberForm({...memberForm, fullName: e.target.value})} className={dkInput} required /></div>
                <div><label className={dkLabel}>Barua Pepe</label><input type="email" value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value})} className={dkInput} /></div>
                <div><label className={dkLabel}>Nambari ya Simu</label><input type="tel" value={memberForm.phone} onChange={e => setMemberForm({...memberForm, phone: e.target.value})} className={dkInput} /></div>
                <div><label className={dkLabel}>Mahali *</label><input type="text" value={memberForm.location} onChange={e => setMemberForm({...memberForm, location: e.target.value})} className={dkInput} required /></div>
                <div><label className={dkLabel}>Aina ya Biashara *</label>
                  <select value={memberForm.businessType} onChange={e => setMemberForm({...memberForm, businessType: e.target.value})} className={dkSelect} required>
                    <option value="">Chagua...</option>
                    <option value="kilimo">Kilimo</option><option value="ufugaji">Ufugaji</option>
                    <option value="biashara_ndogo">Biashara Ndogo</option><option value="sanaa">Sanaa</option>
                    <option value="huduma">Huduma</option><option value="teknolojia">Teknolojia</option><option value="nyingine">Nyingine</option>
                  </select>
                </div>
                <div><label className={dkLabel}>Jinsia *</label>
                  <select value={memberForm.gender} onChange={e => setMemberForm({...memberForm, gender: e.target.value})} className={dkSelect} required>
                    <option value="">Chagua...</option><option value="mwanamke">Mwanamke</option><option value="mwanamume">Mwanamume</option>
                  </select>
                </div>
              </div>
              <div><label className={dkLabel}>Umri *</label><input type="number" value={memberForm.age} onChange={e => setMemberForm({...memberForm, age: e.target.value})} className={dkInput} min="18" max="100" required /></div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowMemberForm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition-colors">Ghairi</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">Hifadhi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
