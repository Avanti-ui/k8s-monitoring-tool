import React from 'react';
import { clsx } from 'clsx';

interface MetricBarProps {
  value: number; // percentage 0-100
  criticalThreshold?: number; // default 60
  warningThreshold?: number; // default 30
  showBar?: boolean;
  barWidth?: string; // default ~44px
  barHeight?: string; // default 5px
}

export const MetricBar: React.FC<MetricBarProps> = ({
  value,
  criticalThreshold = 60,
  warningThreshold = 30,
  showBar = true,
  barWidth = 'w-[44px]',
  barHeight = 'h-[5px]',
}) => {
  const isZero = value <= 0;
  const isCritical = value >= criticalThreshold;
  const isWarning = !isCritical && value >= warningThreshold;

  // Text color
  const textColorClass = isZero
    ? 'text-text-secondary/40 font-normal'
    : isCritical
    ? 'text-rose-400 font-semibold'
    : isWarning
    ? 'text-amber-400 font-medium'
    : 'text-sky-400 font-medium';

  // Sparkline bar color: blue <30%, amber 30-60%, red >60%
  const barFillClass = isCritical
    ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
    : isWarning
    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
    : 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.3)]';

  const clampedVal = Math.min(Math.max(0, value), 100);

  return (
    <div className="flex items-center space-x-2.5">
      <span className={clsx('font-mono text-xs w-11 text-right tabular-nums', textColorClass)}>
        {value.toFixed(1)}%
      </span>
      {showBar && (
        <div
          className={clsx(
            'flex-shrink-0 bg-white/[0.06] rounded-full overflow-hidden relative',
            barWidth,
            barHeight
          )}
        >
          {clampedVal > 0 && (
            <div
              className={clsx('h-full rounded-full transition-all duration-300', barFillClass)}
              style={{ width: `${Math.max(clampedVal, 4)}%` }}
            />
          )}
        </div>
      )}
    </div>
  );
};

