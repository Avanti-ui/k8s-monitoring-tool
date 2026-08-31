import React from 'react';
import { clsx } from 'clsx';
import { Card } from '../ui/Card';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  statusDot?: 'healthy' | 'warning' | 'critical' | 'neutral';
  valueColor?: 'default' | 'critical' | 'warning' | 'healthy' | 'accent';
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subValue,
  statusDot,
  valueColor = 'default',
  icon,
}) => {
  const valueColorClasses = {
    default: 'text-text-primary',
    critical: 'text-status-critical',
    warning: 'text-status-warning',
    healthy: 'text-status-healthy',
    accent: 'text-accent',
  };

  const statusDotClasses = {
    healthy: 'bg-status-healthy',
    warning: 'bg-status-warning',
    critical: 'bg-status-critical',
    neutral: 'bg-status-neutral',
  };

  return (
    <Card compact className="flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xxs font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </span>
        {icon && <span className="text-text-secondary/60">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <div className="flex items-center space-x-2">
          {statusDot && (
            <span
              className={clsx(
                'w-2 h-2 rounded-full flex-shrink-0',
                statusDotClasses[statusDot]
              )}
            />
          )}
          <span
            className={clsx(
              'font-mono text-xl font-bold tracking-tight',
              valueColorClasses[valueColor]
            )}
          >
            {value}
          </span>
        </div>
        {subValue && (
          <span className="text-xxs font-mono text-text-secondary">{subValue}</span>
        )}
      </div>
    </Card>
  );
};
