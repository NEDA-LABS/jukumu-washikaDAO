'use client';

import { useLanguage } from '@/contexts/LanguageContext';

import { useState } from 'react';

export default function ReportsSection({ adminStats }: { adminStats: any }) {
  const { t } = useLanguage();
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

  const specialReports = [t('adm.r.gender'), t('adm.r.bizGrowth'), t('adm.r.socialImpact')];

  return (
    <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground mb-5">{t('adm.r.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground mb-3">{t('adm.r.monthly')}</p>
          {adminStats ? monthlyReports.map((report, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-foreground/[0.03] border border-border">
              <span className="text-sm text-foreground/60">Ripoti ya {report.label}</span>
              <button
                onClick={() => handleDownloadMonthlyReport(report.offset)}
                disabled={downloadingReport === `monthly-${report.offset}`}
                className="text-xs text-orange-500 hover:text-orange-600 font-medium disabled:opacity-40 transition-colors"
              >
                {downloadingReport === `monthly-${report.offset}` ? t('adm.r.opening') : t('adm.r.downloadPdf')}
              </button>
            </div>
          )) : (
            <p className="text-xs text-muted-foreground py-4 text-center">{t('adm.r.none')}</p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground mb-3">{t('adm.r.special')}</p>
          {adminStats ? specialReports.map((report, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-foreground/[0.03] border border-border">
              <span className="text-sm text-foreground/60">{report}</span>
              <button
                onClick={() => handleGenerateSpecialReport(report)}
                disabled={generatingReport === report}
                className="text-xs text-orange-500 hover:text-orange-600 font-medium disabled:opacity-40 transition-colors"
              >
                {generatingReport === report ? t('adm.r.opening') : t('adm.r.viewPdf')}
              </button>
            </div>
          )) : (
            <p className="text-xs text-muted-foreground py-4 text-center">{t('adm.r.none')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
