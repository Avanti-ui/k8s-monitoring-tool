import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={twMerge(
        clsx('animate-pulse bg-white/5 rounded', className)
      )}
      {...props}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => {
  return (
    <div className="w-full space-y-2 py-2">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={rIdx}
          className="flex items-center space-x-4 px-4 py-3 bg-surface/50 border border-border/50 rounded"
        >
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton
              key={cIdx}
              className={clsx(
                'h-4',
                cIdx === 0 ? 'w-1/4' : cIdx === 1 ? 'w-1/6' : 'w-1/8 flex-1'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
