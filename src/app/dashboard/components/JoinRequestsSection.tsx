'use client';

import { useState } from 'react';
import { UserGroupIcon } from '@heroicons/react/24/outline';

export default function JoinRequestsSection({ joinRequests, loadAdminData, showToast }: { joinRequests: any[]; loadAdminData: () => void; showToast: (msg: string, type?: any) => void }) {
  const [processingRequest, setProcessingRequest] = useState<number | null>(null);

  const handleApproveRequest = async (requestId: number) => {
    setProcessingRequest(requestId);
    try {
      const res = await fetch('/api/admin/join-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'approve', reviewerId: 1, notes: 'Approved by admin' })
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message || 'Ombi limekubaliwa!', 'success'); loadAdminData(); }
      else showToast(data.error || 'Hitilafu imetokea', 'error');
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
    finally { setProcessingRequest(null); }
  };

  const handleRejectRequest = async (requestId: number) => {
    const reason = prompt('Sababu ya kukataa (si lazima):');
    setProcessingRequest(requestId);
    try {
      const res = await fetch('/api/admin/join-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'reject', reviewerId: 1, notes: reason || 'Rejected by admin' })
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message || 'Ombi limekataliwa', 'success'); loadAdminData(); }
      else showToast(data.error || 'Hitilafu imetokea', 'error');
    } catch { showToast('Hitilafu ya mtandao', 'error'); }
    finally { setProcessingRequest(null); }
  };

  const pending = joinRequests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white">Maombi ya Kujiunga</h2>
        {pending.length > 0 && (
          <span className="text-[10px] font-bold bg-orange-500 text-white rounded-full px-2 py-0.5">{pending.length} Inasubiri</span>
        )}
      </div>

      {joinRequests.length === 0 ? (
        <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-12 text-center">
          <UserGroupIcon className="h-8 w-8 mx-auto text-white/10 mb-3" />
          <p className="text-sm text-white/25">Hakuna maombi ya kujiunga kwa sasa</p>
        </div>
      ) : (
        <div className="space-y-3">
          {joinRequests.map(req => (
            <div key={req.id} className={`rounded-xl border p-4 ${req.status === 'pending' ? 'bg-[#141414] border-orange-500/20' : 'bg-[#141414] border-white/[0.06]'}`}>
              {req.data_validation && req.data_validation !== 'OK' && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                  ⚠ {req.data_validation} · ID: {req.id}
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white">{req.member_name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {req.status === 'pending' ? 'Inasubiri' : req.status === 'approved' ? 'Imekubaliwa' : 'Imekataliwa'}
                    </span>
                  </div>
                  <p className="text-xs text-white/40">Kujiunga na: <span className="text-white/60 font-medium">{req.group_name}</span></p>
                  <p className="text-xs text-white/30 mt-0.5">{req.member_email}{req.member_phone ? ` · ${req.member_phone}` : ''}</p>
                  <p className="text-[10px] text-white/20 mt-1">{new Date(req.created_at).toLocaleDateString('sw-TZ')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-orange-400">TSH {parseInt(req.monthly_contribution||0).toLocaleString()}/mwezi</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Kiongozi: {req.leader_name || '—'}</p>
                </div>
              </div>

              {req.message && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-white/40"><span className="text-white/25">Ujumbe:</span> {req.message}</p>
                </div>
              )}

              {req.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleApproveRequest(req.id)} disabled={processingRequest === req.id} className="flex-1 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 disabled:opacity-40 transition-colors">
                    {processingRequest === req.id ? 'Inakubali...' : 'Kubali'}
                  </button>
                  <button onClick={() => handleRejectRequest(req.id)} disabled={processingRequest === req.id} className="flex-1 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 disabled:opacity-40 transition-colors">
                    {processingRequest === req.id ? 'Inakataa...' : 'Kataa'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
