import React, { useState } from 'react';
import { Activity, RefreshCw, Server, ChevronDown } from 'lucide-react';
import { DiscoveredCluster } from '../../types';

interface TopBarProps {
  clusters?: DiscoveredCluster[];
  selectedClusterId?: string;
  onSelectCluster?: (clusterId: string) => void;
  onRescanClusters?: () => Promise<void>;
  isRescanning?: boolean;
  clusterName?: string;
  isLive?: boolean;
  lastUpdated?: Date;
  onManualRefresh?: () => void;
  isRefreshing?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  clusters = [],
  selectedClusterId,
  onSelectCluster,
  onRescanClusters,
  isRescanning = false,
  clusterName = 'production-k8s-cluster',
  isLive = true,
  lastUpdated = new Date(),
  onManualRefresh,
  isRefreshing = false,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentCluster = clusters.find((c) => c.id === selectedClusterId || c.name === clusterName) || {
    id: 'default',
    name: clusterName,
    displayName: clusterName,
    provider: 'minikube',
    isReachable: isLive,
  };

  const getProviderBadge = (provider: string) => {
    switch (provider) {
      case 'eks':
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-semibold">AWS EKS</span>;
      case 'aks':
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30 uppercase font-semibold">AZURE AKS</span>;
      case 'gke':
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase font-semibold">GCP GKE</span>;
      case 'minikube':
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase font-semibold">MINIKUBE</span>;
      default:
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-white/10 text-zinc-300 border border-white/15 uppercase font-semibold">K8S</span>;
    }
  };

  return (
    <header className="h-14 px-6 border-b border-border bg-base flex items-center justify-between select-none relative z-30">
      {/* Cluster Selector & Status */}
      <div className="flex items-center space-x-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 px-2.5 py-1 rounded bg-surface border border-border hover:border-white/20 transition-colors"
          >
            <Activity className="w-4 h-4 text-accent" />
            <span className="text-xs font-mono font-medium text-text-primary max-w-[200px] truncate">
              {currentCluster.displayName || currentCluster.name}
            </span>
            {getProviderBadge(currentCluster.provider)}
            <ChevronDown className={`w-3.5 h-3.5 text-text-secondary transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-80 bg-surface border border-border rounded-lg shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-border mb-1">
                <span className="text-xxs font-mono uppercase tracking-wider text-text-secondary">
                  Auto-Discovered Clusters ({clusters.length})
                </span>
                {onRescanClusters && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await onRescanClusters();
                    }}
                    disabled={isRescanning}
                    className="flex items-center space-x-1 text-xxs font-mono text-accent hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRescanning ? 'animate-spin' : ''}`} />
                    <span>{isRescanning ? 'Scanning...' : 'Rescan'}</span>
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 py-1">
                {clusters.length === 0 ? (
                  <div className="px-3 py-2 text-xxs font-mono text-text-secondary">
                    No clusters found in kubeconfig.
                  </div>
                ) : (
                  clusters.map((cluster) => {
                    const isSelected = (cluster.id === selectedClusterId) || (cluster.name === clusterName);
                    return (
                      <button
                        key={cluster.id}
                        type="button"
                        onClick={() => {
                          if (onSelectCluster) onSelectCluster(cluster.id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-accent/10 text-accent font-medium border border-accent/20'
                            : 'hover:bg-white/[0.04] text-text-primary'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              cluster.isReachable ? 'bg-status-healthy' : 'bg-status-critical'
                            }`}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono text-xs truncate">
                              {cluster.displayName}
                            </span>
                            <span className="text-xxs font-mono text-text-secondary/70 truncate">
                              {cluster.server || cluster.sourceFile}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                          {getProviderBadge(cluster.provider)}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <span className="text-white/10">/</span>

        {/* Live Scrape Pill */}
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-status-healthy/10 text-status-healthy">
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-status-healthy animate-pulse' : 'bg-status-critical'}`} />
          <span className="text-xxs font-mono uppercase tracking-wider font-semibold">
            {isLive ? 'Live Scrape' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Scrape Info & Refresh Action */}
      <div className="flex items-center space-x-4">
        {onRescanClusters && (
          <button
            onClick={onRescanClusters}
            disabled={isRescanning}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xxs font-mono bg-surface hover:bg-white/5 border border-border rounded text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            title="Rescan kubeconfig for newly added clusters (EKS/AKS/GKE)"
          >
            <Server className={`w-3 h-3 text-accent ${isRescanning ? 'animate-spin' : ''}`} />
            <span>{isRescanning ? 'Scanning...' : 'Rescan Clusters'}</span>
          </button>
        )}

        <div className="text-xxs font-mono text-text-secondary">
          Last sync:{' '}
          <span className="text-text-primary font-medium">
            {lastUpdated.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>

        {onManualRefresh && (
          <button
            onClick={onManualRefresh}
            disabled={isRefreshing}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface rounded border border-border transition-colors disabled:opacity-50"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
};
