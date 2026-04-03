'use client';

import { AcademicCapIcon } from '@heroicons/react/24/outline';

interface CertificateViewerProps {
  categoryName: string;
  memberName: string;
  issuedAt: string;
  credentialId: string;
}

export default function CertificateViewer({
  categoryName,
  memberName,
  issuedAt,
  credentialId,
}: CertificateViewerProps) {
  const date = new Date(issuedAt).toLocaleDateString('sw-TZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="relative bg-white/[0.02] rounded-2xl overflow-hidden">
      {/* Decorative border */}
      <div className="absolute inset-0 rounded-2xl border-2 border-orange-500/30" />
      <div className="absolute inset-1 rounded-xl border border-orange-500/15" />

      {/* Corner accents */}
      <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-orange-500/40 rounded-tl-lg" />
      <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-orange-500/40 rounded-tr-lg" />
      <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-orange-500/40 rounded-bl-lg" />
      <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-orange-500/40 rounded-br-lg" />

      {/* Content */}
      <div className="relative px-8 py-10 text-center space-y-6">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30">
          <AcademicCapIcon className="w-8 h-8 text-orange-400" />
        </div>

        {/* Title */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
            Cheti cha Mafunzo
          </p>
          <h1 className="text-2xl font-bold text-white">{categoryName}</h1>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
        </div>

        {/* Recipient */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
            Imetolewa kwa
          </p>
          <p className="text-xl font-semibold text-white">{memberName}</p>
        </div>

        {/* Date */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
            Tarehe
          </p>
          <p className="text-white/70">{date}</p>
        </div>

        {/* Credential ID */}
        <div className="pt-4 border-t border-white/5">
          <p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">
            Kitambulisho cha Cheti
          </p>
          <p className="text-white/40 text-xs font-mono">{credentialId}</p>
        </div>
      </div>
    </div>
  );
}
