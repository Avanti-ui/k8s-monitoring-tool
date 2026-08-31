import React from 'react';
import { PodMetric, NodeMetric, AlertItem, NavigationTab } from '../types';
import { StatCard } from '../components/dashboard/StatCard';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Boxes, Server, BellRing, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface OverviewPageProps {
  pods: PodMetric[];
  nodes: NodeMetric[];
  alerts: AlertItem[];
  onNavigate: (tab: NavigationTab) => void;
  onAcknowledgeAlert?: (id: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  pods,
  nodes,
  alerts,
  onNavigate,
  onAcknowledgeAlert,
}) => {
  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const hasCriticalAlerts = activeAlerts.some((a) => a.severity === 'critical');
  const hasWarningAlerts = activeAlerts.some((a) => a.severity === 'warning');

  // Derive cluster health
  const clusterHealthStatus = hasCriticalAlerts
    ? 'critical'
    : hasWarningAlerts
    ? 'warning'
    : 'healthy';

  const clusterHealthLabel = hasCriticalAlerts
    ? 'Critical Issues'
    : hasWarningAlerts
    ? 'Degraded'
    : 'Healthy';

  const activeAlertsColor = hasCriticalAlerts
    ? 'critical'
    : hasWarningAlerts
    ? 'warning'
    : 'default';

  // Last 5 alerts
  const recentAlerts = alerts.slice(0, 5);

  const getRelativeTime = (isoString: string) => {
    try {
      const ms = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(ms / 60000);
      if (mins < 1) return '<1m ago';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 Compact Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Total Pods"
          value={pods.length}
          subValue={`${pods.filter((p) => p.restart_count > 0).length} restarting`}
          icon={<Boxes className="w-4 h-4" />}
        />
        <StatCard
          label="Total Nodes"
          value={nodes.length}
          subValue={`${nodes.filter((n) => n.status === 'Ready').length} Ready`}
          icon={<Server className="w-4 h-4" />}
        />
        <StatCard
          label="Active Alerts"
          value={activeAlerts.length}
          valueColor={activeAlertsColor}
          subValue={hasCriticalAlerts ? 'Requires immediate action' : 'Nominal'}
          icon={<BellRing className="w-4 h-4" />}
        />
        <StatCard
          label="Cluster Health"
          value={clusterHealthLabel}
          statusDot={clusterHealthStatus}
          valueColor={clusterHealthStatus}
          icon={<ShieldCheck className="w-4 h-4" />}
        />
      </div>

      {/* Condensed Alerts Feed */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Recent Alerts Feed
            </span>
            <span className="px-1.5 py-0.2 font-mono text-xxs bg-white/5 text-text-secondary rounded">
              {alerts.length} total
            </span>
          </div>
          <button
            onClick={() => onNavigate('alerts')}
            className="text-xs text-accent hover:underline flex items-center space-x-1 font-medium"
          >
            <span>View all</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentAlerts.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-2">
            <CheckCircle2 className="w-6 h-6 text-status-healthy/80" />
            <p className="text-xs text-text-secondary">
              No alerts currently recorded for this cluster.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Badge variant={alert.severity}>{alert.severity}</Badge>
                  <span className="font-mono text-xs font-medium text-text-primary truncate">
                    {alert.pod}
                  </span>
                  <span className="text-xs text-text-secondary truncate">
                    {alert.message}
                  </span>
                </div>

                <div className="flex items-center space-x-3 flex-shrink-0">
                  <span className="font-mono text-xxs text-text-secondary">
                    {getRelativeTime(alert.created_at)}
                  </span>
                  {alert.status === 'active' && !alert.acknowledged && onAcknowledgeAlert && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => onAcknowledgeAlert(alert.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {alert.acknowledged && (
                    <span className="font-mono text-xxs text-text-secondary/70">
                      Acknowledged
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
