'use client';

import React, { useState } from 'react';
import { PlusIcon, UserGroupIcon, UsersIcon, CurrencyDollarIcon, DocumentTextIcon, TrashIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { dkInput, dkSelect, dkLabel } from './shared';

export default function GroupsSection({ groups, loadAdminData, showToast }: { groups: any[]; loadAdminData: () => void; showToast: (msg: string, type?: any) => void }) {
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [groupProposals, setGroupProposals] = useState<any[]>([]);
  const [executingProposalId, setExecutingProposalId] = useState<number | null>(null);
  const [groupWallet, setGroupWallet] = useState<any>(null);
  const [groupWalletBalances, setGroupWalletBalances] = useState<any>(null);
  const [groupWalletWarning, setGroupWalletWarning] = useState<string>('');
  const [groupTransfers, setGroupTransfers] = useState<any[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [provisioningWallet, setProvisioningWallet] = useState(false);
  const [provisioningCardId, setProvisioningCardId] = useState<number | null>(null);
  const [members] = useState<any[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', leaderId: '', monthlyContribution: '', foundedDate: new Date().toISOString().split('T')[0] });

  const fetchGroupWallet = async (groupId: number) => {
    setWalletLoading(true);
    setGroupWallet(null);
    setGroupWalletBalances(null);
    setGroupWalletWarning('');
    setGroupTransfers([]);
    try {
      const r = await fetch(`/api/admin/groups/${groupId}/wallet`);
      if (r.ok) {
        const d = await r.json();
        setGroupWallet(d.wallet || null);
        setGroupWalletBalances(d.balanceTzs != null ? { balanceTzs: d.balanceTzs } : null);
        setGroupWalletWarning(d.balanceError || (typeof d.warning === 'string' ? d.warning : ''));
        setGroupTransfers(d.recentTransactions || []);
      } else {
        setGroupWalletWarning('Imeshindwa kupakia data ya pochi');
      }
    } catch {
      setGroupWalletWarning('Hitilafu ya mtandao wakati wa kupakia pochi');
    } finally {
      setWalletLoading(false);
    }
  };

  const handleProvisionWallet = async (group: any) => {
    setProvisioningWallet(true);
    try {
      const r = await fetch(`/api/admin/groups/${group.id}/wallet`, { method: 'POST' });
      const d = await r.json();
      if (r.ok && d.success) {
        showToast(d.message || 'Wallet created!', 'success');
        await fetchGroupWallet(group.id);
      } else {
        showToast(d.error || 'Failed to create wallet', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setProvisioningWallet(false);
    }
  };

  const handleProvisionWalletCard = async (group: any) => {
    setProvisioningCardId(group.id);
    try {
      const r = await fetch(`/api/admin/groups/${group.id}/wallet`, { method: 'POST' });
      const d = await r.json();
      if (r.ok && d.success) {
        showToast(d.message || 'Wallet created!', 'success');
        loadAdminData();
      } else {
        showToast(d.error || 'Failed to create wallet', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setProvisioningCardId(null);
    }
  };

  const handleViewGroup = async (group: any) => {
    setSelectedGroup(group);
    setGroupMembers([]);
    setGroupProposals([]);
    setShowGroupDetails(true);
    try {
      const r = await fetch(`/api/admin/groups/${group.id}/members`);
      if (r.ok) setGroupMembers(await r.json());
    } catch { setGroupMembers([]); }
    try {
      const r = await fetch(`/api/admin/groups/${group.id}/proposals`);
      if (r.ok) { const d = await r.json(); setGroupProposals(d.proposals || []); }
    } catch { setGroupProposals([]); }
    fetchGroupWallet(group.id);
  };

  const reloadProposals = async (groupId: number) => {
    try {
      const r = await fetch(`/api/admin/groups/${groupId}/proposals`);
      if (r.ok) { const d = await r.json(); setGroupProposals(d.proposals || []); }
    } catch { /* keep current list */ }
  };

  const handleExecuteProposal = async (proposalId: number) => {
    if (!selectedGroup) return;
    setExecutingProposalId(proposalId);
    try {
      const r = await fetch(`/api/member/groups/${selectedGroup.id}/proposals/${proposalId}/execute`, { method: 'POST' });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.success) {
        showToast('Malipo yamekamilika! (Funds disbursed)', 'success');
        await reloadProposals(selectedGroup.id);
        fetchGroupWallet(selectedGroup.id);
      } else {
        showToast(d?.error || d?.details || 'Imeshindikana kutekeleza malipo', 'error');
      }
    } catch {
      showToast('Hitilafu ya mtandao', 'error');
    } finally {
      setExecutingProposalId(null);
    }
  };

  const handleEditGroup = (group: any) => {
    setEditingGroup(group);
    setGroupForm({ name: group.name || '', leaderId: group.leader_id || '', monthlyContribution: group.monthly_contribution || '', foundedDate: group.founded_date ? group.founded_date.split('T')[0] : new Date().toISOString().split('T')[0] });
    setShowEditGroup(true);
  };

  const handleRoleChange = async (memberId: number, newRole: string) => {
    if (!selectedGroup) return;
    try {
      const r = await fetch(`/api/admin/groups/${selectedGroup.id}/leadership`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, role: newRole }) });
      const d = await r.json();
      if (r.ok && d.success) {
        const mr = await fetch(`/api/admin/groups/${selectedGroup.id}/members`);
        if (mr.ok) setGroupMembers(await mr.json());
        loadAdminData();
        showToast(d.message || 'Nafasi ya uongozi imebadilishwa!', 'success');
      } else showToast(d.error || 'Hitilafu imetokea', 'error');
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
  };

  const handleRemoveFromGroup = async (memberId: number) => {
    if (!selectedGroup) return;
    try {
      const r = await fetch(`/api/admin/groups/${selectedGroup.id}/remove-member`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }) });
      const d = await r.json();
      if (r.ok && d.success) {
        const mr = await fetch(`/api/admin/groups/${selectedGroup.id}/members`);
        if (mr.ok) setGroupMembers(await mr.json());
        loadAdminData();
        showToast(d.message || 'Mwanachama ameondolewa!', 'success');
      } else showToast(d.error || 'Hitilafu imetokea', 'error');
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
  };

  const handleDeleteGroup = async (group: any) => {
    try {
      const r = await fetch('/api/admin/groups', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: group.id }) });
      const d = await r.json();
      if (r.ok && d.success) { loadAdminData(); showToast(d.message || 'Kundi limefutwa!', 'success'); }
      else showToast(d.error || 'Hitilafu imetokea', 'error');
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch('/api/admin/groups', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingGroup.id, name: groupForm.name, leaderId: groupForm.leaderId || null, monthlyContribution: parseFloat(groupForm.monthlyContribution), status: editingGroup.status }) });
      if (r.ok) { showToast('Kundi limebadilishwa kwa mafanikio!', 'success'); setShowEditGroup(false); setShowGroupDetails(false); loadAdminData(); }
      else { const d = await r.json(); showToast(d.error || 'Hitilafu imetokea', 'error'); }
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch('/api/admin/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(groupForm) });
      const d = await r.json();
      if (r.ok && d.success) { setShowGroupForm(false); setGroupForm({ name: '', leaderId: '', monthlyContribution: '', foundedDate: new Date().toISOString().split('T')[0] }); loadAdminData(); showToast(d.message || 'Kundi limeanzishwa!', 'success'); }
      else showToast(d.error || 'Hitilafu imetokea', 'error');
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
  };

  const roleBadge = (r: string) => ({ leader:'bg-blue-500/10 text-blue-600', mwenyekiti:'bg-purple-500/10 text-purple-600', katibu:'bg-emerald-500/10 text-emerald-600', mwekahazina:'bg-yellow-500/10 text-yellow-600' }[r] || 'bg-foreground/5 text-foreground/40');
  const roleLabel = (r: string) => ({ leader:'Kiongozi', mwenyekiti:'Mwenyekiti', katibu:'Katibu', mwekahazina:'MwekaHazina' }[r] || 'Mwanachama');

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Usimamizi wa Makundi</h2>
          <button onClick={() => setShowGroupForm(v => !v)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
            <PlusIcon className="h-4 w-4" /> Kundi Jipya
          </button>
        </div>

        {showGroupForm && (
          <form onSubmit={handleCreateGroup} className="mb-5 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 space-y-3">
            <p className="text-xs font-semibold text-orange-500 mb-2">Anzisha Kundi Jipya</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className={dkLabel}>Jina la Kundi *</label><input type="text" value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} className={dkInput} required /></div>
              <div><label className={dkLabel}>Kiongozi</label>
                <select value={groupForm.leaderId} onChange={e => setGroupForm({...groupForm, leaderId: e.target.value})} className={dkSelect}>
                  <option value="">Chagua kiongozi</option>
                  {members.filter((m: any) => m.status === 'active').map((m: any) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div><label className={dkLabel}>Mchango wa Kila Mwezi (TSH) *</label><input type="number" value={groupForm.monthlyContribution} onChange={e => setGroupForm({...groupForm, monthlyContribution: e.target.value})} className={dkInput} min="1000" required /></div>
              <div><label className={dkLabel}>Tarehe ya Kuanzishwa *</label><input type="date" value={groupForm.foundedDate} onChange={e => setGroupForm({...groupForm, foundedDate: e.target.value})} className={dkInput} required /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowGroupForm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition-colors">Ghairi</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">Anzisha</button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.length > 0 ? groups.map(g => (
            <div key={g.id} className="rounded-xl bg-background border border-border hover:border-orange-500/30 p-4 transition-all shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground leading-snug">{g.name}</h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${g.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
                  {g.status === 'active' ? 'Active' : 'Pending'}
                </span>
              </div>
              <div className="space-y-1 text-xs text-foreground/50 mb-3">
                <p><span className="text-muted-foreground">Members:</span> {g.member_count || 0}</p>
                <p><span className="text-muted-foreground">Leader:</span> {g.leader_name || '—'}</p>
                <p><span className="text-muted-foreground">Contribution:</span> TSH {parseFloat(g.monthly_contribution || 0).toLocaleString()}/mo</p>
              </div>
              {/* Wallet status */}
              <div className="mb-3">
                {g.ntzs_user_id ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                    ◆ Wallet Active
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">◌ No Wallet</span>
                    <button
                      onClick={() => handleProvisionWalletCard(g)}
                      disabled={provisioningCardId === g.id}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white transition-colors"
                    >
                      {provisioningCardId === g.id ? 'Creating...' : '+ Provision'}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleViewGroup(g)} className="flex-1 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 text-xs font-medium transition-colors">View</button>
                <button onClick={() => handleEditGroup(g)} className="flex-1 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/50 text-xs font-medium transition-colors">Edit</button>
                <button onClick={() => handleDeleteGroup(g)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-colors"><TrashIcon className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center py-12">
              <UserGroupIcon className="h-8 w-8 mx-auto text-foreground/10 mb-3" />
              <p className="text-sm text-muted-foreground">Hakuna makundi bado</p>
            </div>
          )}
        </div>
      </div>

      {showGroupDetails && selectedGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-overlay border border-border max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{selectedGroup.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Maelezo ya kundi</p>
                </div>
                <button onClick={() => setShowGroupDetails(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Wanachama', value: selectedGroup.member_count || 0, cls: 'text-blue-600' },
                  { label: 'Mchango/Mwezi', value: `TSH ${parseFloat(selectedGroup.monthly_contribution||0).toLocaleString()}`, cls: 'text-emerald-600' },
                  { label: 'Uwekezaji', value: `TSH ${parseFloat(selectedGroup.total_investment||0).toLocaleString()}`, cls: 'text-orange-500' },
                  { label: 'Hali', value: selectedGroup.status === 'active' ? 'Hai' : 'Inasubiri', cls: selectedGroup.status === 'active' ? 'text-emerald-600' : 'text-yellow-600' },
                ].map((s,i) => (
                  <div key={i} className="rounded-xl bg-foreground/[0.03] border border-border p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">{s.label}</p>
                    <p className={`text-sm font-bold ${s.cls}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl bg-foreground/[0.03] border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Maelezo ya Kundi</p>
                  <p className="text-xs text-foreground/50"><span className="text-muted-foreground">Kiongozi:</span> {selectedGroup.leader_name || '—'}</p>
                  <p className="text-xs text-foreground/50"><span className="text-muted-foreground">Kuanzishwa:</span> {selectedGroup.founded_date ? new Date(selectedGroup.founded_date).toLocaleDateString('sw-TZ') : '—'}</p>
                  <p className="text-xs text-foreground/50"><span className="text-muted-foreground">Kutengenezwa:</span> {new Date(selectedGroup.created_at).toLocaleDateString('sw-TZ')}</p>
                </div>
                <div className="rounded-xl bg-foreground/[0.03] border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Takwimu za Fedha</p>
                  <p className="text-xs text-foreground/50"><span className="text-muted-foreground">Mchango/Mwezi:</span> TSH {parseFloat(selectedGroup.monthly_contribution||0).toLocaleString()}</p>
                  <p className="text-xs text-foreground/50"><span className="text-muted-foreground">Uwekezaji:</span> TSH {parseFloat(selectedGroup.total_investment||0).toLocaleString()}</p>
                  <p className="text-xs text-foreground/50"><span className="text-muted-foreground">Jumla michango:</span> TSH {(parseFloat(selectedGroup.monthly_contribution||0)*(selectedGroup.member_count||0)).toLocaleString()}</p>
                </div>
              </div>

              <div className="rounded-xl bg-foreground/[0.03] border border-border mb-4">
                <div className="px-4 py-3 border-b border-border"><p className="text-xs font-semibold text-muted-foreground">Wanachama wa Kundi</p></div>
                <div className="p-3">
                  {groupMembers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead><tr className="border-b border-border">
                          {['Jina','Nafasi','Kujiunge','Hali','Badilisha Nafasi','Ondoa'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody className="divide-y divide-border">
                          {groupMembers.map(m => (
                            <tr key={m.id} className="hover:bg-foreground/[0.02]">
                              <td className="px-3 py-2.5"><div className="text-xs font-medium text-foreground">{m.full_name}</div><div className="text-[10px] text-muted-foreground">{m.email}</div></td>
                              <td className="px-3 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${roleBadge(m.role)}`}>{roleLabel(m.role)}</span></td>
                              <td className="px-3 py-2.5 text-[10px] text-muted-foreground">{m.joined_date ? new Date(m.joined_date).toLocaleDateString('sw-TZ') : '—'}</td>
                              <td className="px-3 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${m.status==='active'?'bg-emerald-500/10 text-emerald-600':'bg-red-500/10 text-red-600'}`}>{m.status==='active'?'Hai':'Haifanyi kazi'}</span></td>
                              <td className="px-3 py-2.5">
                                <select value={m.role} onChange={e => handleRoleChange(m.id, e.target.value)} className="text-[10px] bg-background border border-border text-foreground/50 rounded-lg px-2 py-1 focus:outline-none">
                                  <option value="member">Mwanachama</option><option value="leader">Kiongozi</option><option value="mwenyekiti">Mwenyekiti</option><option value="katibu">Katibu</option><option value="mwekahazina">MwekaHazina</option>
                                </select>
                              </td>
                              <td className="px-3 py-2.5"><button onClick={() => handleRemoveFromGroup(m.id)} className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 transition-colors"><UserMinusIcon className="h-3 w-3" /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8"><UsersIcon className="h-7 w-7 mx-auto text-foreground/10 mb-2" /><p className="text-xs text-muted-foreground">Hakuna wanachama bado</p></div>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-foreground/[0.03] border border-border mb-4">
                <div className="px-4 py-3 border-b border-border"><p className="text-xs font-semibold text-muted-foreground">Mapendekezo</p></div>
                <div className="p-3">
                  {groupProposals.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead><tr className="border-b border-border">{['Kichwa','Hali','Kura','Mwandishi','Tarehe','Kitendo'].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>)}</tr></thead>
                        <tbody className="divide-y divide-border">
                          {groupProposals.map(p => (
                            <tr key={p.id} className="hover:bg-foreground/[0.02]">
                              <td className="px-3 py-2.5"><div className="text-xs font-medium text-foreground">{p.title}</div>{p.description && <div className="text-[10px] text-muted-foreground mt-0.5">{p.description}</div>}</td>
                              <td className="px-3 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${p.status==='open'?'bg-emerald-500/10 text-emerald-600':'bg-foreground/5 text-foreground/40'}`}>{p.status}</span></td>
                              <td className="px-3 py-2.5 text-[10px] text-foreground/40">✓{p.yes_votes||0} ✗{p.no_votes||0}</td>
                              <td className="px-3 py-2.5 text-[10px] text-muted-foreground">{p.created_by_name||'—'}</td>
                              <td className="px-3 py-2.5 text-[10px] text-foreground/30">{p.created_at?new Date(p.created_at).toLocaleDateString('sw-TZ'):'—'}</td>
                              <td className="px-3 py-2.5">
                                {p.payment_status === 'completed' ? (
                                  <span className="text-[10px] text-emerald-600 font-semibold">✓ Imelipwa</span>
                                ) : p.can_execute ? (
                                  <button
                                    onClick={() => handleExecuteProposal(p.id)}
                                    disabled={executingProposalId === p.id}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {executingProposalId === p.id ? 'Inatekeleza...' : `Tekeleza TZS ${Number(p.payment_amount_tzs||0).toLocaleString()}`}
                                  </button>
                                ) : p.is_payment ? (
                                  <span className="text-[10px] text-foreground/30">{Number(p.yes_votes||0)}/{p.required_yes||0} kura</span>
                                ) : (
                                  <span className="text-[10px] text-foreground/20">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="text-center py-8"><DocumentTextIcon className="h-7 w-7 mx-auto text-foreground/10 mb-2" /><p className="text-xs text-muted-foreground">Hakuna mapendekezo bado</p></div>}
                </div>
              </div>

              <div className="rounded-xl bg-foreground/[0.03] border border-border mb-4">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">Pochi &amp; Miamala</p>
                  {!walletLoading && groupWallet && (
                    <button onClick={() => fetchGroupWallet(selectedGroup.id)} className="text-[10px] text-orange-500 hover:text-orange-600 font-medium transition-colors">↻ Sasisha</button>
                  )}
                </div>
                <div className="p-3 space-y-3">

                  {/* ── Loading ── */}
                  {walletLoading && (
                    <div className="flex items-center justify-center gap-2 py-8">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent" />
                      <p className="text-xs text-muted-foreground">Inapakia pochi...</p>
                    </div>
                  )}

                  {/* ── No wallet provisioned ── */}
                  {!walletLoading && !groupWallet && (
                    <div className="text-center py-6 space-y-3">
                      <CurrencyDollarIcon className="h-8 w-8 mx-auto text-foreground/10" />
                      {groupWalletWarning ? (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-left">
                          <p className="text-xs font-semibold text-red-600 mb-0.5">Failed to load wallet</p>
                          <p className="text-[10px] text-red-500/80">{groupWalletWarning}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No treasury wallet set up yet</p>
                      )}
                      <button
                        onClick={() => handleProvisionWallet(selectedGroup)}
                        disabled={provisioningWallet}
                        className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                      >
                        {provisioningWallet ? 'Creating...' : '+ Create nTZS Treasury'}
                      </button>
                    </div>
                  )}

                  {/* ── Wallet loaded ── */}
                  {!walletLoading && groupWallet && (
                    <div className="space-y-3">
                      {/* Balance hero card */}
                      <div className={`rounded-xl p-4 border ${groupWalletWarning ? 'bg-orange-500/5 border-orange-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Salio la Pochi</p>
                        {groupWalletWarning ? (
                          <>
                            <p className="text-xl font-bold text-orange-500">Haijulikani</p>
                            <p className="text-[10px] text-orange-500/80 mt-1">⚠ {groupWalletWarning}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-emerald-600">
                              TSH {(groupWalletBalances?.balanceTzs ?? 0).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">Imesasishwa sasa hivi · Base (nTZS)</p>
                          </>
                        )}
                      </div>

                      {/* Wallet address */}
                      <div className="rounded-xl bg-foreground/[0.03] border border-border p-3">
                        <p className="text-[10px] text-muted-foreground mb-1">Anwani ya Pochi</p>
                        <p className="text-[10px] font-mono text-foreground/50 break-all">{groupWallet.address || '—'}</p>
                      </div>
                    </div>
                  )}

                  {/* ── Transactions ── */}
                  {!walletLoading && (
                    <div className="rounded-xl bg-foreground/[0.03] border border-border">
                      <div className="px-3 py-2.5 border-b border-border"><p className="text-[10px] font-semibold text-muted-foreground">Miamala ({groupTransfers.length})</p></div>
                      <div className="p-3">
                        {groupTransfers.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full">
                              <thead><tr className="border-b border-border">{['Aina','Kiasi','Hali','Maelezo','Tarehe'].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>)}</tr></thead>
                              <tbody className="divide-y divide-border">
                                {groupTransfers.map(t => (
                                  <tr key={t.id} className="hover:bg-foreground/[0.02]">
                                    <td className="px-3 py-2 text-[10px] text-foreground/50 capitalize">{t.purpose || t.type}</td>
                                    <td className="px-3 py-2 text-[10px] font-medium text-foreground/70">TSH {(t.amount_tzs ?? 0).toLocaleString()}</td>
                                    <td className="px-3 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${t.status==='completed'||t.status==='minted'?'bg-emerald-500/10 text-emerald-600':t.status==='pending'||t.status==='processing'?'bg-blue-500/10 text-blue-600':t.status==='failed'?'bg-red-500/10 text-red-600':'bg-foreground/5 text-foreground/30'}`}>{t.status}</span></td>
                                    <td className="px-3 py-2 text-[10px] text-muted-foreground">{t.note || '—'}</td>
                                    <td className="px-3 py-2 text-[10px] text-foreground/30 whitespace-nowrap">{t.created_at ? new Date(t.created_at).toLocaleDateString('sw-TZ') : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-4">Hakuna miamala bado</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowGroupDetails(false)} className="px-4 py-2 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition-colors">Funga</button>
                <button onClick={() => handleEditGroup(selectedGroup)} className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">Hariri Kundi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditGroup && editingGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-overlay border border-border shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-foreground">Hariri Kundi</h2>
                <button onClick={() => setShowEditGroup(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
              </div>
              <form onSubmit={handleUpdateGroup} className="space-y-3">
                <div><label className={dkLabel}>Jina la Kundi</label><input type="text" value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} className={dkInput} required /></div>
                <div><label className={dkLabel}>Kiongozi</label>
                  <select value={groupForm.leaderId} onChange={e => setGroupForm({...groupForm, leaderId: e.target.value})} className={dkSelect}>
                    <option value="">Chagua Kiongozi</option>
                    {members.map((m: any) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
                <div><label className={dkLabel}>Mchango wa Kila Mwezi (TSH)</label><input type="number" value={groupForm.monthlyContribution} onChange={e => setGroupForm({...groupForm, monthlyContribution: e.target.value})} className={dkInput} required /></div>
                <div><label className={dkLabel}>Tarehe ya Kuanzishwa</label><input type="date" value={groupForm.foundedDate} onChange={e => setGroupForm({...groupForm, foundedDate: e.target.value})} className={dkInput} required /></div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowEditGroup(false)} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition-colors">Ghairi</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">Badilisha</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
