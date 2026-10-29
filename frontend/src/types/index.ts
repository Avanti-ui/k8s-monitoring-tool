export interface PodMetric {
  pod: string;
  namespace: string;
  cpu_percent: number;
  memory_percent: number;
  restart_count: number;
}

export interface MetricHistoryPoint {
  timestamp: number;
  value: number;
}

export interface LogEntry {
  timestamp: number;
  line: string;
}

export interface NodeMetric {
  node: string;
  status: 'Ready' | 'NotReady';
  cpu_percent: number;
  memory_percent: number;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'resolved';
export type AlertSource = 'rule' | 'ai';

export interface AlertItem {
  id: string;
  pod: string;
  namespace: string;
  rule: string;
  severity: AlertSeverity;
  message: string;
  status: AlertStatus;
  created_at: string;
  acknowledged: boolean;
  source?: AlertSource;
  likely_root_cause?: string;
  recommended_action?: string;
}


export type ClusterProvider = 'eks' | 'aks' | 'gke' | 'minikube' | 'kind' | 'k3s' | 'unknown';

export interface DiscoveredCluster {
  id: string;
  name: string;
  displayName: string;
  provider: ClusterProvider;
  server: string;
  contextName: string;
  sourceFile: string;
  isReachable: boolean;
  statusMessage?: string;
  latencyMs?: number;
  defaultNamespace?: string;
  isManualOverride?: boolean;
}

export type NavigationTab = 'home' | 'overview' | 'pods' | 'nodes' | 'alerts' | 'logs';
