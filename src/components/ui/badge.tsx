import * as React from 'react';
import { cn } from '@/lib/cn';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning';

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-muted text-muted-foreground',
  outline: 'border border-border text-foreground bg-transparent',
  destructive: 'bg-destructive/10 text-destructive',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Badge.displayName = 'Badge';
