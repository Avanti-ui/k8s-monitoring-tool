import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'sm',
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary:
      'bg-accent text-base font-medium hover:bg-accent-hover active:bg-accent-hover border border-accent',
    secondary:
      'bg-surface hover:bg-surface-hover text-text-primary border border-border',
    outline:
      'bg-transparent hover:bg-surface-hover text-text-primary border border-border',
    ghost:
      'bg-transparent hover:bg-white/5 text-text-secondary hover:text-text-primary',
    danger:
      'bg-status-critical/10 hover:bg-status-critical/20 text-status-critical border border-status-critical/30',
  };

  const sizeStyles = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
  };

  return (
    <button
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center rounded transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none font-medium',
          variantStyles[variant],
          sizeStyles[size],
          className
        )
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};
