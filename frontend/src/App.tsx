import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { OverviewPage } from './pages/OverviewPage';
import { PodsPage } from './pages/PodsPage';
import { NodesPage } from './pages/NodesPage';
import { AlertsPage } from './pages/AlertsPage';
import { LogsPage } from './pages/LogsPage';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { useToast } from './components/ui/Toast';
import { api } from './services/api';
import { NavigationTab, PodMetric, NodeMetric, AlertItem, DiscoveredCluster } from './types';

export const App: React.FC = () => {
  const { isAuthenticated, token, logout } = useAuth();
  const { showToast } = useToast();

  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [pods, setPods] = useState<PodMetric[]>([]);
  const [nodes, setNodes] = useState<NodeMetric[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [clusters, setClusters] = useState<DiscoveredCluster[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRescanning, setIsRescanning] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState<boolean>(true);

  const isMountedRef = useRef(true);

  const fetchClusters = useCallback(async () => {
    if (!token) return;
    try {
      const discovered = await api.getClusters(token).catch(() => []);
      if (isMountedRef.current) {
        setClusters(discovered);
        if (discovered.length > 0 && !selectedClusterId) {
          setSelectedClusterId(discovered[0].id);
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Error fetching clusters:', err);
    }
  }, [token, selectedClusterId]);

  const handleRescanClusters = async () => {
    if (!token) return;
    setIsRescanning(true);
    try {
      const res = await api.rescanClusters(token);
      setClusters(res.clusters || []);
      showToast('success', `Kubeconfig rescanned: ${res.count || 0} cluster contexts found.`);
    } catch (err: any) {
      showToast('error', `Failed to rescan clusters: ${err.message || err}`);
    } finally {
      setIsRescanning(false);
    }
  };

  const fetchAllData = useCallback(
    async (showLoadingIndicator = false) => {
      if (!token) return;
      if (showLoadingIndicator) setIsRefreshing(true);

      try {
        const [podsData, nodesData, alertsData] = await Promise.all([
          api.getMetricsSummary(token).catch(() => []),
          api.getNodes(token).catch(() => []),
          api.getAlerts(token).catch(() => []),
        ]);

        if (isMountedRef.current) {
          setPods(podsData);
          setNodes(nodesData);
          setAlerts(alertsData);
          setLastUpdated(new Date());
          setIsLive(true);
        }
      } catch (err: any) {
        if (err.message === 'unauthorized') {
          showToast('error', 'Session expired. Please sign in again.');
          logout();
        } else {
          setIsLive(false);
          console.warn('[Dashboard] Error polling data:', err);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [token, logout, showToast]
  );

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    if (isAuthenticated && token) {
      setIsLoading(true);
      fetchAllData();
      fetchClusters();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [isAuthenticated, token, fetchAllData, fetchClusters]);

  // Polling interval (10 seconds)
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const interval = setInterval(() => {
      fetchAllData(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [isAuthenticated, token, fetchAllData]);

  // Alert acknowledgment handler
  const handleAcknowledgeAlert = async (id: string) => {
    if (!token) return;

    // Optimistic UI update
    const previousAlerts = [...alerts];
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );

    try {
      await api.acknowledgeAlert(token, id);
      showToast('success', `Alert acknowledged successfully.`);
    } catch (err) {
      // Revert optimistic update
      setAlerts(previousAlerts);
      showToast('error', `Failed to acknowledge alert: ${(err as Error).message}`);
    }
  };

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const activeAlertsCount = alerts.filter((a) => a.status === 'active' && !a.acknowledged).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-base text-text-primary">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        activeAlertsCount={activeAlertsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* TopBar */}
        <TopBar
          clusters={clusters}
          selectedClusterId={selectedClusterId}
          onSelectCluster={setSelectedClusterId}
          onRescanClusters={handleRescanClusters}
          isRescanning={isRescanning}
          clusterName="production-k8s-cluster"
          isLive={isLive}
          lastUpdated={lastUpdated}
          onManualRefresh={() => fetchAllData(true)}
          isRefreshing={isRefreshing}
        />

        {/* Section Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {currentTab === 'home' && (
              <HomePage
                pods={pods}
                nodes={nodes}
                alerts={alerts}
                clusters={clusters}
                onNavigate={setCurrentTab}
                onRescanClusters={handleRescanClusters}
                isRescanning={isRescanning}
              />
            )}

            {currentTab === 'overview' && (
              <OverviewPage
                pods={pods}
                nodes={nodes}
                alerts={alerts}
                onNavigate={setCurrentTab}
                onAcknowledgeAlert={handleAcknowledgeAlert}
              />
            )}

            {currentTab === 'pods' && (
              <PodsPage
                pods={pods}
                isLoading={isLoading}
                onRefresh={() => fetchAllData(true)}
              />
            )}

            {currentTab === 'nodes' && (
              <NodesPage
                nodes={nodes}
                isLoading={isLoading}
                onRefresh={() => fetchAllData(true)}
              />
            )}

            {currentTab === 'alerts' && (
              <AlertsPage
                alerts={alerts}
                isLoading={isLoading}
                onRefresh={() => fetchAllData(true)}
                onAcknowledge={handleAcknowledgeAlert}
              />
            )}

            {currentTab === 'logs' && <LogsPage pods={pods} />}
          </div>
        </main>
      </div>
    </div>
  );
};
