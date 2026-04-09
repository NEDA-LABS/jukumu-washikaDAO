'use client';

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<EduCertificate[]>([]);
  const [selectedCert, setSelectedCert] = useState<EduCertificate | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/education/certificates');
        if (!res.ok) throw new Error('Imeshindikana kupakia vyeti');
        const data = await res.json();
        setCertificates(Array.isArray(data) ? data : data.certificates ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hitilafu imetokea');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <button onClick={() => router.push('/jifunze')} className="text-white/60 hover:text-white transition-colors">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-white">Vyeti Vyangu</h1>
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
          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-16 text-center">
            <AcademicCapIcon className="h-16 w-16 text-white/15 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white/40 mb-2">Bado Huna Vyeti</h2>
            <p className="text-sm text-white/25 mb-6">
              Kamilisha kozi na ufaulu mtihani wa mwisho ili kupata cheti chako cha kwanza.
            </p>
            <button
              onClick={() => router.push('/jifunze')}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
            >
              Anza Kujifunza
            </button>
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
              className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm"
            >
              Funga
            </button>
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
