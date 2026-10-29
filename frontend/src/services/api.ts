import { PodMetric, MetricHistoryPoint, LogEntry, NodeMetric, AlertItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function fetchWithAuth<T>(
  endpoint: string,
  token: string | null,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('unauthorized');
    }
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: async (email: string, password: string): Promise<{ token: string }> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'invalid credentials');
    }
    return res.json();
  },

  signup: async (email: string, password: string): Promise<{ token: string }> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'registration failed');
    }
    return res.json();
  },

  // Health
  checkHealth: async (): Promise<{ status: string }> => {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.json();
  },

  // Metrics
  getMetricsSummary: async (token: string): Promise<PodMetric[]> => {
    return fetchWithAuth<PodMetric[]>('/api/metrics/summary', token);
  },

  getMetricHistory: async (
    token: string,
    metric: 'cpu' | 'memory',
    pod: string,
    minutes: number = 15
  ): Promise<MetricHistoryPoint[]> => {
    return fetchWithAuth<MetricHistoryPoint[]>(
      `/api/metrics/history?metric=${metric}&pod=${encodeURIComponent(pod)}&minutes=${minutes}`,
      token
    );
  },

  // Nodes
  getNodes: async (token: string): Promise<NodeMetric[]> => {
    return fetchWithAuth<NodeMetric[]>('/api/nodes', token);
  },

  // Logs
  getLogs: async (token: string, pod: string, limit: number = 100): Promise<LogEntry[]> => {
    return fetchWithAuth<LogEntry[]>(
      `/api/logs?pod=${encodeURIComponent(pod)}&limit=${limit}`,
      token
    );
  },

  // Alerts
  getAlerts: async (
    token: string,
    status?: 'active' | 'resolved',
    limit: number = 50
  ): Promise<AlertItem[]> => {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    query.set('limit', limit.toString());
    return fetchWithAuth<AlertItem[]>(`/api/alerts?${query.toString()}`, token);
  },

  acknowledgeAlert: async (token: string, alertId: string): Promise<AlertItem> => {
    return fetchWithAuth<AlertItem>(`/api/alerts/${alertId}/acknowledge`, token, {
      method: 'POST',
    });
  },

  // Multi-Cluster Auto-Discovery
  getClusters: async (token: string): Promise<import('../types').DiscoveredCluster[]> => {
    return fetchWithAuth<import('../types').DiscoveredCluster[]>('/api/clusters', token);
  },

  rescanClusters: async (
    token: string
  ): Promise<{ message: string; count: number; clusters: import('../types').DiscoveredCluster[] }> => {
    return fetchWithAuth<{
      message: string;
      count: number;
      clusters: import('../types').DiscoveredCluster[];
    }>('/api/clusters/rescan', token, {
      method: 'POST',
    });
  },
};
