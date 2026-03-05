import * as React from 'react';
import { cn } from '@/lib/cn';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ open, onClose, children, className }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-50 w-full max-w-md rounded-[var(--ds-radius-xl)] border border-border bg-card p-6 shadow-lg',
          'animate-in fade-in-0 zoom-in-95',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4', className)} {...props} />;
}

export function ModalTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-card-foreground', className)} {...props} />;
}

export function ModalDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />;
}

export function ModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6 flex justify-end gap-3', className)} {...props} />;
}
