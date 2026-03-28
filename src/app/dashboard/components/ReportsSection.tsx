'use client';

import { useState } from 'react';

export default function ReportsSection({ adminStats }: { adminStats: any }) {
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  const handleDownloadMonthlyReport = async (monthOffset: number) => {
    const reportKey = `monthly-${monthOffset}`;
    setDownloadingReport(reportKey);
    try {
      const d = new Date();
      d.setMonth(d.getMonth() - monthOffset);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      window.open(`/dashboard/report?month=${encodeURIComponent(month)}&print=1`, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error downloading report:', error);
    } finally {
      setDownloadingReport(null);
    }
  };

  const handleGenerateSpecialReport = async (reportType: string) => {
    setGeneratingReport(reportType);
    try {
      const d = new Date();
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      window.open(`/dashboard/report?month=${encodeURIComponent(month)}&print=1`, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGeneratingReport(null);
    }
  };

  const monthlyReports = [
    { offset: 0, label: new Date().toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' }) },
    { offset: 1, label: new Date(Date.now() - 30*24*60*60*1000).toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' }) },
    { offset: 2, label: new Date(Date.now() - 60*24*60*60*1000).toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' }) }
  ];

  const specialReports = ['Takwimu za Jinsia', 'Ukuaji wa Biashara', 'Athari za Kijamii'];

  return (
    <div className="rounded-xl bg-[#141414] border border-white/[0.06] p-5">
      <h2 className="text-base font-semibold text-white mb-5">Ripoti na Takwimu</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/40 mb-3">Ripoti za Mwezi</p>
          {adminStats ? monthlyReports.map((report, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-sm text-white/60">Ripoti ya {report.label}</span>
              <button
                onClick={() => handleDownloadMonthlyReport(report.offset)}
                disabled={downloadingReport === `monthly-${report.offset}`}
                className="text-xs text-orange-400 hover:text-orange-300 font-medium disabled:opacity-40 transition-colors"
              >
                {downloadingReport === `monthly-${report.offset}` ? 'Inafungua...' : 'Pakua PDF'}
              </button>
            </div>
          )) : (
            <p className="text-xs text-white/25 py-4 text-center">Hakuna takwimu bado</p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/40 mb-3">Ripoti za Maalum</p>
          {adminStats ? specialReports.map((report, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-sm text-white/60">{report}</span>
              <button
                onClick={() => handleGenerateSpecialReport(report)}
                disabled={generatingReport === report}
                className="text-xs text-orange-400 hover:text-orange-300 font-medium disabled:opacity-40 transition-colors"
              >
                {generatingReport === report ? 'Inafungua...' : 'Angalia PDF'}
              </button>
            </div>
          )) : (
            <p className="text-xs text-white/25 py-4 text-center">Hakuna takwimu bado</p>
          )}
        </div>
      </div>
    </div>
  );
}
