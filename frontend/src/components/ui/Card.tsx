import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  compact = false,
  className,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-surface border border-border rounded shadow-none',
          compact ? 'p-3.5' : 'p-5',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
