import React, { useState, useEffect } from 'react';
import { PodMetric, LogEntry } from '../types';
import { TerminalLogs } from '../components/dashboard/TerminalLogs';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Terminal, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface LogsPageProps {
  pods: PodMetric[];
}

export const LogsPage: React.FC<LogsPageProps> = ({ pods }) => {
  const { token } = useAuth();
  const [selectedPod, setSelectedPod] = useState<string>('');
  const [limit, setLimit] = useState<number>(100);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (pods.length > 0 && !selectedPod) {
      setSelectedPod(pods[0].pod);
    }
  }, [pods, selectedPod]);

  const fetchLogs = async () => {
    if (!token || !selectedPod) return;
    setIsLoading(true);
    try {
      const result = await api.getLogs(token, selectedPod, limit);
      setLogs(result);
    } catch (err) {
      console.warn('Error fetching logs:', err);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPod) {
      fetchLogs();
    }
  }, [selectedPod, limit]);

  const filteredLogs = logs.filter((l) =>
    l.line.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Selector & Controls */}
      <div className="p-4 bg-surface border border-border rounded flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
          <div className="w-64">
            <label className="block text-xxs font-semibold uppercase tracking-wider text-text-secondary mb-1">
              Select Pod
            </label>
            <select
              value={selectedPod}
              onChange={(e) => setSelectedPod(e.target.value)}
              className="w-full bg-base border border-border rounded px-2.5 py-1.5 text-xs font-mono text-text-primary focus:border-accent focus:outline-none"
            >
              {pods.length === 0 ? (
                <option value="">No pods available</option>
              ) : (
                pods.map((p) => (
                  <option key={p.pod} value={p.pod}>
                    {p.namespace} / {p.pod}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="w-28">
            <label className="block text-xxs font-semibold uppercase tracking-wider text-text-secondary mb-1">
              Limit
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full bg-base border border-border rounded px-2.5 py-1.5 text-xs font-mono text-text-primary focus:border-accent focus:outline-none"
            >
              <option value={50}>50 lines</option>
              <option value={100}>100 lines</option>
              <option value={200}>200 lines</option>
              <option value={500}>500 lines</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative w-48">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search output..."
              className="w-full bg-base border border-border rounded pl-2.5 pr-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-secondary/40 focus:border-accent focus:outline-none"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            isLoading={isLoading}
            onClick={fetchLogs}
            className="flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Fetch</span>
          </Button>
        </div>
      </div>

      {/* Terminal View */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-text-secondary" />
            <span className="text-xxs font-mono uppercase tracking-wider text-text-secondary">
              Loki Stream : {selectedPod || 'None'}
            </span>
          </div>
          <span className="text-xxs font-mono text-text-secondary">
            {filteredLogs.length} lines shown
          </span>
        </div>

        {isLoading ? (
          <div className="bg-[#050608] border border-border/60 rounded p-8 text-center text-text-secondary text-xs font-mono">
            Fetching logs from Loki...
          </div>
        ) : (
          <TerminalLogs
            logs={filteredLogs}
            maxHeight="600px"
            emptyMessage={
              selectedPod
                ? `No log lines found in Loki for pod "${selectedPod}".`
                : 'Select a pod to view logs.'
            }
          />
        )}
      </div>
    </div>
  );
};
