import * as React from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'success'
  | 'link';

type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--ds-radius-md)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-muted text-foreground hover:bg-muted/80',
  outline: 'border border-border bg-background hover:bg-muted/60 hover:text-foreground',
  ghost: 'hover:bg-muted/60 hover:text-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  success: 'bg-success text-success-foreground hover:bg-success/90',
  link: 'text-primary underline-offset-4 hover:underline',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-10 px-4',
  lg: 'h-11 px-6 text-base',
  icon: 'h-10 w-10',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={cn(base, variantClasses[variant], sizeClasses[size], className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
