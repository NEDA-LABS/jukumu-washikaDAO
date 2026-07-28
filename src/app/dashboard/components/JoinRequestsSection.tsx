'use client';

import { useLanguage } from '@/contexts/LanguageContext';

import { useState } from 'react';
import { UserGroupIcon } from '@heroicons/react/24/outline';

export default function JoinRequestsSection({ joinRequests, loadAdminData, showToast }: { joinRequests: any[]; loadAdminData: () => void; showToast: (msg: string, type?: any) => void }) {
  const { t } = useLanguage();
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
      if (res.ok) { showToast(data.message || t('adm.jr.approved'), 'success'); loadAdminData(); }
      else showToast(data.error || t('adm.c.error'), 'error');
    } catch { showToast(t('adm.c.networkErr'), 'error'); }
    finally { setProcessingRequest(null); }
  };

  const handleRejectRequest = async (requestId: number) => {
    const reason = prompt(t('adm.jr.rejectReason'));
    setProcessingRequest(requestId);
    try {
      const res = await fetch('/api/admin/join-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'reject', reviewerId: 1, notes: reason || 'Rejected by admin' })
      });
      const data = await res.json();
      if (res.ok) { showToast(data.message || t('adm.jr.rejected'), 'success'); loadAdminData(); }
      else showToast(data.error || t('adm.c.error'), 'error');
    } catch { showToast(t('adm.c.networkErr'), 'error'); }
    finally { setProcessingRequest(null); }
  };

  const pending = joinRequests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-foreground">{t('adm.jr.title')}</h2>
        {pending.length > 0 && (
          <span className="text-[10px] font-bold bg-orange-500 text-white rounded-full px-2 py-0.5">{pending.length} {t('adm.c.pending')}</span>
        )}
      </div>

      {joinRequests.length === 0 ? (
        <div className="rounded-xl bg-card border border-border p-12 text-center shadow-sm">
          <UserGroupIcon className="h-8 w-8 mx-auto text-foreground/10 mb-3" />
          <p className="text-sm text-muted-foreground">{t('adm.jr.none')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {joinRequests.map(req => (
            <div key={req.id} className={`rounded-xl border p-4 bg-card shadow-sm ${req.status === 'pending' ? 'border-orange-500/30' : 'border-border'}`}>
              {req.data_validation && req.data_validation !== 'OK' && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-600">
                  ⚠ {req.data_validation} · ID: {req.id}
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground">{req.member_name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' : req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                      {req.status === 'pending' ? t('adm.c.pending') : req.status === 'approved' ? t('adm.c.approved') : t('adm.c.rejected')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('adm.jr.joining')} <span className="text-foreground/60 font-medium">{req.group_name}</span></p>
                  <p className="text-xs text-foreground/30 mt-0.5">{req.member_email}{req.member_phone ? ` · ${req.member_phone}` : ''}</p>
                  <p className="text-[10px] text-foreground/20 mt-1">{new Date(req.created_at).toLocaleDateString('sw-TZ')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-orange-500">TSH {parseInt(req.monthly_contribution||0).toLocaleString()}/mwezi</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Kiongozi: {req.leader_name || '—'}</p>
                </div>
              </div>

              {req.message && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-foreground/[0.03] border border-border">
                  <p className="text-xs text-foreground/50"><span className="text-muted-foreground">{t('adm.jr.message')}</span> {req.message}</p>
                </div>
              )}

              {req.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleApproveRequest(req.id)} disabled={processingRequest === req.id} className="flex-1 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-xs font-semibold border border-emerald-500/20 disabled:opacity-40 transition-colors">
                    {processingRequest === req.id ? t('adm.jr.approving') : t('adm.jr.approve')}
                  </button>
                  <button onClick={() => handleRejectRequest(req.id)} disabled={processingRequest === req.id} className="flex-1 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 text-xs font-semibold border border-red-500/20 disabled:opacity-40 transition-colors">
                    {processingRequest === req.id ? t('adm.jr.rejecting') : t('adm.jr.reject')}
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
