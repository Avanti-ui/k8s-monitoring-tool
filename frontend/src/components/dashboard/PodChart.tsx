import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { MetricHistoryPoint } from '../../types';

interface PodChartProps {
  data: MetricHistoryPoint[];
  metricLabel?: string;
  unit?: string;
  height?: number;
}

export const PodChart: React.FC<PodChartProps> = ({
  data,
  metricLabel = 'CPU Usage',
  unit = '%',
  height = 140,
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-secondary text-xs font-mono bg-base/50 rounded border border-border/50"
        style={{ height }}
      >
        No historical data points available
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    ...d,
    timeStr: new Date(d.timestamp * 1000).toLocaleTimeString('en-US', {
      hour12: false,
      minute: '2-digit',
      second: '2-digit',
    }),
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="timeStr"
            stroke="rgba(255,255,255,0.2)"
            tick={{ fill: '#8B8D93', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="rgba(255,255,255,0.2)"
            tick={{ fill: '#8B8D93', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            domain={[0, 'auto']}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-surface border border-border px-2.5 py-1.5 rounded shadow-none text-xs">
                    <span className="text-text-secondary text-xxs font-mono block">
                      {item.timeStr}
                    </span>
                    <span className="text-accent font-mono font-medium">
                      {metricLabel}: {item.value}
                      {unit}
                    </span>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#00E599"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
