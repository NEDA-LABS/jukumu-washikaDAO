'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CertificateCard from '@/components/education/certificate/CertificateCard';
import CertificateViewer from '@/components/education/certificate/CertificateViewer';
import type { EduCertificate } from '@/lib/education/types';
import {
  ArrowLeftIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

export default function CertificatesPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  // Store the i18n KEY, not a resolved string: the language context hydrates
  // from localStorage after first paint, so a message resolved at throw-time
  // would stay frozen in whatever language was active before hydration.
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<EduCertificate[]>([]);
  const [selectedCert, setSelectedCert] = useState<EduCertificate | null>(null);
  const error = errorKey ? t(errorKey) : null;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/education/certificates');
        if (!res.ok) {
          setErrorKey(res.status === 401 ? 'edu.err.signIn' : 'edu.err.loadCerts');
          return;
        }
        const data = await res.json();
        setCertificates(Array.isArray(data) ? data : data.certificates ?? []);
      } catch {
        setErrorKey('edu.err.generic');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-background min-h-screen text-foreground flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <button onClick={() => router.push('/jifunze')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-foreground">{t('edu.myCerts')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {certificates.length === 0 ? (
          <div className="rounded-xl bg-card border border-border p-16 text-center">
            <AcademicCapIcon className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-muted-foreground mb-2">{t('edu.certs.none')}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t('edu.certs.noneDesc')}</p>
            <button
              onClick={() => router.push('/jifunze')}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors"
            >{t('edu.startLearning')}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((cert) => (
              <CertificateCard
                key={cert.id}
                categoryName={cert.category_name}
                memberName={cert.member_name}
                issuedAt={cert.issued_at}
                credentialId={cert.credential_id}
                onClick={() => setSelectedCert(cert)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Certificate viewer modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full">
            <button
              onClick={() => setSelectedCert(null)}
              className="absolute -top-10 right-0 text-muted-foreground hover:text-foreground text-sm"
            >{t('edu.close')}</button>
            <CertificateViewer
              categoryName={selectedCert.category_name}
              memberName={selectedCert.member_name}
              issuedAt={selectedCert.issued_at}
              credentialId={selectedCert.credential_id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
