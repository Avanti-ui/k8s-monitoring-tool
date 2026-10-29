import React from 'react';
import { NodeMetric } from '../types';
import { MetricBar } from '../components/dashboard/MetricBar';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Server, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

interface NodesPageProps {
  nodes: NodeMetric[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const NodesPage: React.FC<NodesPageProps> = ({
  nodes,
  isLoading,
  onRefresh,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xxs font-mono text-text-secondary">
          {nodes.length} cluster nodes registered
        </span>
        <button
          onClick={onRefresh}
          className="p-1.5 text-text-secondary hover:text-text-primary bg-surface rounded border border-border transition-colors"
          title="Refresh nodes"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading && nodes.length === 0 ? (
        <TableSkeleton rows={4} cols={4} />
      ) : nodes.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border rounded flex flex-col items-center justify-center space-y-2">
          <Server className="w-6 h-6 text-text-secondary" />
          <p className="text-xs text-text-secondary">
            No Kubernetes nodes detected or metrics exporter unreachable.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-base/40 text-xxs font-semibold uppercase tracking-wider text-text-secondary">
                <th className="py-2.5 px-4">Node</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">CPU Utilization</th>
                <th className="py-2.5 px-4">Memory Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {nodes.map((node) => {
                const isReady = node.status === 'Ready';
                return (
                  <tr
                    key={node.node}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-text-primary">
                      {node.node}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span
                          className={clsx(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            isReady ? 'bg-status-healthy' : 'bg-status-critical'
                          )}
                        />
                        <span
                          className={clsx(
                            'font-mono text-xs font-medium',
                            isReady ? 'text-status-healthy' : 'text-status-critical'
                          )}
                        >
                          {node.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <MetricBar
                        value={node.cpu_percent}
                        criticalThreshold={85}
                        warningThreshold={70}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <MetricBar
                        value={node.memory_percent}
                        criticalThreshold={85}
                        warningThreshold={70}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
