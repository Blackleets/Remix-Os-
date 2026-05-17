import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }
>(({ className, variant = 'primary', ...props }, ref) => {
  const variants = {
    primary: [
      'text-white border border-blue-400/30',
      'bg-[linear-gradient(180deg,rgba(91,136,255,0.95),rgba(50,95,219,0.95))]',
      'shadow-[0_14px_34px_rgba(61,103,255,0.32)] hover:shadow-[0_18px_42px_rgba(61,103,255,0.38)]',
      'hover:brightness-105',
    ].join(' '),
    secondary: [
      'text-neutral-100 border border-white/10',
      'bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/16',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    ].join(' '),
    ghost: 'bg-transparent text-neutral-400 hover:text-white hover:bg-white/[0.05]',
    danger: 'bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/16',
  };

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200',
        'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-blue-400/30',
        variants[variant],
        className
      )}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export const Card = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('dashboard-card', className)} {...props}>
    {children}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-neutral-600',
        'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400/24 focus:border-blue-400/40',
        className
      )}
      {...props}
    />
  )
);

Input.displayName = 'Input';

export const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <label className={cn('mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500', className)}>
    {children}
  </label>
);

export const OSGlyph = ({
  children,
  className,
  tone = 'neutral',
  size = 'md',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'neutral' | 'blue' | 'emerald' | 'amber' | 'violet' | 'red';
  size?: 'sm' | 'md' | 'lg';
}) => {
  const toneStyles = {
    neutral: 'border-white/10 bg-white/[0.03] text-neutral-300',
    blue: 'border-blue-400/16 bg-blue-500/10 text-blue-200',
    emerald: 'border-emerald-400/16 bg-emerald-500/10 text-emerald-200',
    amber: 'border-amber-400/16 bg-amber-500/10 text-amber-200',
    violet: 'border-violet-400/16 bg-violet-500/10 text-violet-200',
    red: 'border-red-400/16 bg-red-500/10 text-red-200',
  };

  const sizeStyles = {
    sm: 'h-9 w-9 rounded-[16px]',
    md: 'h-11 w-11 rounded-[18px]',
    lg: 'h-12 w-12 rounded-[20px]',
  };

  return (
    <div
      className={cn(
        'os-glyph relative flex shrink-0 items-center justify-center overflow-hidden border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        sizeStyles[size],
        toneStyles[tone],
        className
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_58%)] opacity-90" />
      <div className="relative flex items-center justify-center">{children}</div>
    </div>
  );
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null, auth: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
