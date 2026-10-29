import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'critical' | 'warning' | 'info' | 'healthy' | 'neutral' | 'accent';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className,
  ...props
}) => {
  const variantStyles = {
    critical: 'bg-status-critical/10 text-status-critical border-status-critical/30',
    warning: 'bg-status-warning/10 text-status-warning border-status-warning/30',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    healthy: 'bg-status-healthy/10 text-status-healthy border-status-healthy/30',
    neutral: 'bg-white/5 text-text-secondary border-white/10',
    accent: 'bg-accent/10 text-accent border-accent/30',
  };


  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-xxs font-mono font-medium',
    md: 'px-2 py-0.5 text-xs font-mono font-medium',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center rounded border uppercase tracking-wider',
          variantStyles[variant],
          sizeStyles[size],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  );
};
