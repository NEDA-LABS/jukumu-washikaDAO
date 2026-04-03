'use client';

import { AcademicCapIcon } from '@heroicons/react/24/outline';

interface CertificateCardProps {
  categoryName: string;
  memberName: string;
  issuedAt: string;
  credentialId: string;
  onClick?: () => void;
}

export default function CertificateCard({
  categoryName,
  memberName,
  issuedAt,
  credentialId,
  onClick,
}: CertificateCardProps) {
  const date = new Date(issuedAt).toLocaleDateString('sw-TZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white/[0.02] border border-white/10 rounded-xl p-4 hover:bg-white/5 hover:border-orange-500/30 transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <AcademicCapIcon className="w-6 h-6 text-orange-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-semibold text-sm group-hover:text-orange-400 transition-colors truncate">
            {categoryName}
          </h3>
          <p className="text-white/60 text-xs mt-0.5">{memberName}</p>
          <p className="text-white/40 text-xs mt-1">{date}</p>
          <p className="text-white/30 text-[10px] font-mono mt-1.5 truncate">
            {credentialId}
          </p>
        </div>
      </div>
    </button>
  );
}
