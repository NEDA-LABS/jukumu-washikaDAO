import * as React from 'react';
import { cn } from '@/lib/cn';

export type StatCardProps = React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  sublabel?: string;
};

export function StatCard({ label, value, icon, trend, sublabel, className, ...props }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--ds-radius-lg)] border border-border bg-card p-4 shadow-sm',
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="mt-1 text-2xl font-bold text-card-foreground">{value}</p>
      {sublabel && (
        <p className={cn(
          'mt-1 text-xs',
          trend === 'up' && 'text-success',
          trend === 'down' && 'text-destructive',
          (!trend || trend === 'neutral') && 'text-muted-foreground',
        )}>
          {sublabel}
        </p>
      )}
    </div>
  );
}
