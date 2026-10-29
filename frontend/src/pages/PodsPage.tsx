import React, { useState } from 'react';
import { PodMetric, MetricHistoryPoint, LogEntry } from '../types';
import { MetricBar } from '../components/dashboard/MetricBar';
import { PodChart } from '../components/dashboard/PodChart';
import { TerminalLogs } from '../components/dashboard/TerminalLogs';
import { TableSkeleton } from '../components/ui/Skeleton';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ChevronRight, ChevronDown, RefreshCw, Boxes, Search } from 'lucide-react';
import { clsx } from 'clsx';

interface PodsPageProps {
  pods: PodMetric[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const PodsPage: React.FC<PodsPageProps> = ({
  pods,
  isLoading,
  onRefresh,
}) => {
  const { token } = useAuth();
  const [expandedPod, setExpandedPod] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [historyData, setHistoryData] = useState<Record<string, MetricHistoryPoint[]>>({});
  const [podLogs, setPodLogs] = useState<Record<string, LogEntry[]>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  const toggleExpand = async (podName: string) => {
    if (expandedPod === podName) {
      setExpandedPod(null);
      return;
    }

    setExpandedPod(podName);

    if (!token) return;

    // Fetch metrics history and logs for the pod if not cached
    if (!historyData[podName] || !podLogs[podName]) {
      setLoadingDetails(true);
      try {
        const [history, logs] = await Promise.all([
          api.getMetricHistory(token, 'cpu', podName, 15).catch(() => []),
          api.getLogs(token, podName, 20).catch(() => []),
        ]);

        setHistoryData((prev) => ({ ...prev, [podName]: history }));
        setPodLogs((prev) => ({ ...prev, [podName]: logs }));
      } catch (err) {
        console.warn('Failed to fetch pod details:', err);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const filteredPods = pods.filter(
    (p) =>
      p.pod.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.namespace.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-text-secondary/60 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter pods or namespace..."
            className="w-full bg-surface border border-border rounded pl-9 pr-3 py-1.5 text-xs text-text-primary font-mono placeholder:text-text-secondary/40 focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xxs font-mono text-text-secondary">
            {filteredPods.length} of {pods.length} pods
          </span>
          <button
            onClick={onRefresh}
            className="p-1.5 text-text-secondary hover:text-text-primary bg-surface rounded border border-border transition-colors"
            title="Refresh pods"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading && pods.length === 0 ? (
        <TableSkeleton rows={6} cols={5} />
      ) : filteredPods.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border rounded flex flex-col items-center justify-center space-y-2">
          <Boxes className="w-6 h-6 text-text-secondary" />
          <p className="text-xs text-text-secondary">
            No active Kubernetes pods matching the current filter.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-base/40 text-xxs font-semibold uppercase tracking-wider text-text-secondary">
                  <th className="py-2.5 px-3 w-8"></th>
                  <th className="py-2.5 px-3">Pod</th>
                  <th className="py-2.5 px-3">Namespace</th>
                  <th className="py-2.5 px-3">CPU Usage</th>
                  <th className="py-2.5 px-3">Memory Usage</th>
                  <th className="py-2.5 px-3">Restarts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredPods.map((pod) => {
                  const isExpanded = expandedPod === pod.pod;
                  return (
                    <React.Fragment key={`${pod.namespace}/${pod.pod}`}>
                      <tr
                        onClick={() => toggleExpand(pod.pod)}
                        className={clsx(
                          'cursor-pointer transition-colors duration-150 hover:bg-white/[0.035]',
                          isExpanded ? 'bg-white/[0.025]' : 'bg-transparent'
                        )}
                      >
                        <td className="py-2.5 px-3 text-text-secondary/70">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-accent" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-text-primary text-xs">
                          {pod.pod}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xxs text-text-secondary/70">
                          {pod.namespace}
                        </td>
                        <td className="py-2.5 px-3">
                          <MetricBar
                            value={pod.cpu_percent}
                            criticalThreshold={60}
                            warningThreshold={30}
                            barWidth="w-[44px]"
                            barHeight="h-[5px]"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <MetricBar
                            value={pod.memory_percent}
                            criticalThreshold={60}
                            warningThreshold={30}
                            barWidth="w-[44px]"
                            barHeight="h-[5px]"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          {pod.restart_count >= 8 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-mono font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              {pod.restart_count}
                            </span>
                          ) : pod.restart_count >= 3 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
                              {pod.restart_count}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-mono text-text-secondary/70 bg-white/[0.04] border border-white/[0.06]">
                              {pod.restart_count}
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Drill-down */}
                      {isExpanded && (
                        <tr className="bg-base/60 border-b border-border/60">
                          <td colSpan={6} className="p-4 space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* CPU History Chart */}
                              <div className="space-y-1.5">
                                <span className="text-xxs font-semibold uppercase tracking-wider text-text-secondary">
                                  CPU Utilization History (Last 15m)
                                </span>
                                <div className="bg-surface border border-border rounded p-3">
                                  {loadingDetails && !historyData[pod.pod] ? (
                                    <div className="h-32 flex items-center justify-center text-text-secondary text-xs font-mono">
                                      Loading metrics history...
                                    </div>
                                  ) : (
                                    <PodChart
                                      data={historyData[pod.pod] || []}
                                      metricLabel="CPU"
                                      unit="%"
                                      height={130}
                                    />
                                  )}
                                </div>
                              </div>

                              {/* Pod Logs Terminal */}
                              <div className="space-y-1.5">
                                <span className="text-xxs font-semibold uppercase tracking-wider text-text-secondary">
                                  Recent Logs (Last 20 lines)
                                </span>
                                {loadingDetails && !podLogs[pod.pod] ? (
                                  <div className="h-32 flex items-center justify-center bg-[#050608] border border-border/60 rounded text-text-secondary text-xs font-mono">
                                    Loading logs...
                                  </div>
                                ) : (
                                  <TerminalLogs
                                    logs={podLogs[pod.pod] || []}
                                    maxHeight="165px"
                                  />
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
