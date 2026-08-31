import React, { useState, useMemo } from 'react';
import { AlertItem } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { TableSkeleton } from '../components/ui/Skeleton';
import { CheckCircle2, RefreshCw, ChevronDown, ChevronRight, Layers, BellRing } from 'lucide-react';
import { clsx } from 'clsx';

interface AlertsPageProps {
  alerts: AlertItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onAcknowledge: (id: string) => Promise<void>;
}

interface GroupedAlert {
  key: string;
  pod: string;
  namespace: string;
  rule: string;
  severity: import('../types').AlertSeverity;
  message: string;

  status: 'active' | 'resolved';
  latestTimestamp: string;
  earliestTimestamp: string;
  items: AlertItem[];
  hasUnacknowledged: boolean;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  alerts,
  isLoading,
  onRefresh,
  onAcknowledge,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'resolved'>('all');
  const [isGrouped, setIsGrouped] = useState<boolean>(true);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());
  const [acknowledgingIds, setAcknowledgingIds] = useState<Set<string>>(new Set());

  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;

  const tabs = [
    { id: 'all', label: 'All Alerts', count: alerts.length },
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'resolved', label: 'Resolved', count: resolvedCount },
  ];

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (activeTab === 'active') return a.status === 'active';
      if (activeTab === 'resolved') return a.status === 'resolved';
      return true;
    });
  }, [alerts, activeTab]);

  // Group alerts by pod + rule + status
  const groupedAlerts = useMemo<GroupedAlert[]>(() => {
    const groupsMap = new Map<string, GroupedAlert>();

    for (const alert of filteredAlerts) {
      const key = `${alert.pod}::${alert.rule}::${alert.status}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          pod: alert.pod,
          namespace: alert.namespace,
          rule: alert.rule,
          severity: alert.severity,
          message: alert.message,
          status: alert.status,
          latestTimestamp: alert.created_at,
          earliestTimestamp: alert.created_at,
          items: [alert],
          hasUnacknowledged: alert.status === 'active' && !alert.acknowledged,
        });
      } else {
        const group = groupsMap.get(key)!;
        group.items.push(alert);
        if (new Date(alert.created_at) > new Date(group.latestTimestamp)) {
          group.latestTimestamp = alert.created_at;
        }
        if (new Date(alert.created_at) < new Date(group.earliestTimestamp)) {
          group.earliestTimestamp = alert.created_at;
        }
        if (alert.status === 'active' && !alert.acknowledged) {
          group.hasUnacknowledged = true;
        }
      }
    }

    return Array.from(groupsMap.values());
  }, [filteredAlerts]);

  const toggleGroupExpand = (key: string) => {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAcknowledge = async (id: string) => {
    setAcknowledgingIds((prev) => new Set(prev).add(id));
    try {
      await onAcknowledge(id);
    } finally {
      setAcknowledgingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleAcknowledgeGroup = async (items: AlertItem[]) => {
    const unacked = items.filter((a) => a.status === 'active' && !a.acknowledged);
    for (const a of unacked) {
      await handleAcknowledge(a.id);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return iso;
    }
  };

  const formatTimeOnly = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls & Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-1">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          className="border-b-0"
        />

        <div className="flex items-center space-x-3">
          {/* Group Repeated Alerts Toggle */}
          <button
            type="button"
            onClick={() => setIsGrouped(!isGrouped)}
            className={clsx(
              'flex items-center space-x-1.5 px-2.5 py-1 text-xxs font-mono rounded border transition-colors',
              isGrouped
                ? 'bg-accent/10 text-accent border-accent/30 font-medium'
                : 'bg-surface text-text-secondary border-border hover:text-text-primary'
            )}
            title="Group repeating alerts from the same pod and rule"
          >
            <Layers className="w-3 h-3" />
            <span>{isGrouped ? 'Grouped (Compact)' : 'Flat List'}</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-1.5 text-text-secondary hover:text-text-primary bg-surface rounded border border-border transition-colors"
            title="Refresh alerts"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* List / Table */}
      {isLoading && alerts.length === 0 ? (
        <TableSkeleton rows={5} cols={5} />
      ) : filteredAlerts.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-border rounded flex flex-col items-center justify-center space-y-2">
          <CheckCircle2 className="w-6 h-6 text-status-healthy" />
          <p className="text-xs text-text-secondary">
            No alerts match the selected &quot;{activeTab}&quot; filter.
          </p>
        </div>
      ) : isGrouped ? (
        /* GROUPED ALERTS TABLE */
        <div className="bg-surface border border-border rounded overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-base/40 text-xxs font-semibold uppercase tracking-wider text-text-secondary">
                <th className="py-2.5 px-3 w-8"></th>
                <th className="py-2.5 px-3">Severity & Status</th>
                <th className="py-2.5 px-3">Pod / Resource</th>
                <th className="py-2.5 px-3">Namespace</th>
                <th className="py-2.5 px-3">Rule & Message</th>
                <th className="py-2.5 px-3">Occurrences</th>
                <th className="py-2.5 px-3">Time Range</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {groupedAlerts.map((group) => {
                const isExpanded = expandedGroupKeys.has(group.key);
                const isActive = group.status === 'active';
                const count = group.items.length;
                const isPending = group.items.some((a) => acknowledgingIds.has(a.id));

                return (
                  <React.Fragment key={group.key}>
                    <tr
                      onClick={() => count > 1 && toggleGroupExpand(group.key)}
                      className={clsx(
                        'transition-colors duration-150',
                        count > 1 && 'cursor-pointer hover:bg-white/[0.035]',
                        isActive ? 'bg-transparent' : 'opacity-65 hover:opacity-100 bg-white/[0.01]'
                      )}
                    >
                      <td className="py-3 px-3 text-text-secondary/70">
                        {count > 1 ? (
                          isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-accent" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )
                        ) : (
                          <span className="w-3.5 h-3.5 inline-block" />
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-2">
                          {isActive ? (
                            <Badge variant={group.severity}>{group.severity}</Badge>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xxs font-mono text-zinc-400 bg-white/[0.05] border border-white/10 uppercase">
                              Resolved
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono font-medium text-xs">
                        <span className={isActive ? 'text-text-primary' : 'text-text-secondary/80'}>
                          {group.pod}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-text-secondary/70 font-mono text-xxs">
                        {group.namespace}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-xxs font-semibold text-text-secondary">
                              {group.rule}
                            </span>
                            {group.items[0]?.source === 'ai' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                AI INSIGHT
                              </span>
                            )}
                          </div>
                          <span className={clsx('text-xs', isActive ? 'text-text-primary' : 'text-text-secondary/70')}>
                            {group.message}
                          </span>
                          {group.items[0]?.recommended_action && (
                            <span className="text-[11px] text-accent/90 font-mono mt-1">
                              💡 Action: {group.items[0].recommended_action}
                            </span>
                          )}
                        </div>
                      </td>


                      <td className="py-3 px-3">
                        {count > 1 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-mono font-medium bg-accent/10 text-accent border border-accent/20">
                            × {count} events
                          </span>
                        ) : (
                          <span className="text-xxs font-mono text-text-secondary/60">
                            1 event
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono text-xxs text-text-secondary/70 whitespace-nowrap">
                        {count > 1 ? (
                          <div className="flex flex-col">
                            <span>Latest: {formatTimeOnly(group.latestTimestamp)}</span>
                            <span className="text-[10px] text-text-secondary/50">First: {formatTimeOnly(group.earliestTimestamp)}</span>
                          </div>
                        ) : (
                          formatTimestamp(group.latestTimestamp)
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        {isActive && group.hasUnacknowledged ? (
                          <Button
                            size="xs"
                            variant="outline"
                            isLoading={isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcknowledgeGroup(group.items);
                            }}
                          >
                            Ack All ({count})
                          </Button>
                        ) : isActive && !group.hasUnacknowledged ? (
                          <span className="text-xxs font-mono text-text-secondary">
                            Acknowledged
                          </span>
                        ) : (
                          <span className="text-xxs font-mono text-text-secondary/50">
                            -
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Grouped Occurrences */}
                    {isExpanded && count > 1 && (
                      <tr className="bg-base/60 border-b border-border/60">
                        <td colSpan={8} className="p-3 pl-10 space-y-2">
                          <div className="text-xxs font-mono uppercase tracking-wider text-text-secondary/80 flex items-center space-x-2">
                            <BellRing className="w-3 h-3 text-accent" />
                            <span>Individual Incident Occurrences ({count})</span>
                          </div>
                          <div className="divide-y divide-border/40 bg-surface rounded border border-border/60 overflow-hidden">
                            {group.items.map((item, idx) => (
                              <div
                                key={item.id}
                                className="px-3 py-2 flex items-center justify-between text-xs font-mono hover:bg-white/[0.02]"
                              >
                                <div className="flex items-center space-x-3">
                                  <span className="text-text-secondary/50 text-xxs w-5">#{idx + 1}</span>
                                  <span className="text-text-secondary text-xxs">{formatTimestamp(item.created_at)}</span>
                                  <span className="text-text-primary/90 text-xs">{item.message}</span>
                                </div>
                                <div>
                                  {item.status === 'active' && !item.acknowledged ? (
                                    <button
                                      onClick={() => handleAcknowledge(item.id)}
                                      className="text-xxs text-accent hover:underline"
                                    >
                                      Ack
                                    </button>
                                  ) : (
                                    <span className="text-xxs text-text-secondary/60">
                                      {item.status === 'resolved' ? 'Resolved' : 'Acked'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
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
      ) : (
        /* FLAT ALERTS TABLE */
        <div className="bg-surface border border-border rounded overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-base/40 text-xxs font-semibold uppercase tracking-wider text-text-secondary">
                <th className="py-2.5 px-4">Severity</th>
                <th className="py-2.5 px-4">Pod / Resource</th>
                <th className="py-2.5 px-4">Namespace</th>
                <th className="py-2.5 px-4">Rule & Message</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredAlerts.map((alert) => {
                const isPending = acknowledgingIds.has(alert.id);
                const isActive = alert.status === 'active';
                return (
                  <tr
                    key={alert.id}
                    className={clsx(
                      'hover:bg-white/[0.035] transition-colors',
                      isActive ? 'bg-transparent' : 'opacity-65 hover:opacity-100 bg-white/[0.01]'
                    )}
                  >
                    <td className="py-3 px-4">
                      {isActive ? (
                        <Badge variant={alert.severity}>{alert.severity}</Badge>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xxs font-mono text-zinc-400 bg-white/[0.05] border border-white/10 uppercase">
                          Resolved
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-xs">
                      <span className={isActive ? 'text-text-primary' : 'text-text-secondary/80'}>
                        {alert.pod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-text-secondary/70 font-mono text-xxs">
                      {alert.namespace}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-xxs font-semibold text-text-secondary">
                            {alert.rule}
                          </span>
                          {alert.source === 'ai' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              AI INSIGHT
                            </span>
                          )}
                        </div>
                        <span className={clsx('text-xs', isActive ? 'text-text-primary' : 'text-text-secondary/70')}>
                          {alert.message}
                        </span>
                        {alert.recommended_action && (
                          <span className="text-[11px] text-accent/90 font-mono mt-1">
                            💡 Action: {alert.recommended_action}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {isActive ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xxs font-mono font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 uppercase">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xxs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 uppercase">
                          Resolved
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xxs text-text-secondary/70 whitespace-nowrap">
                      {formatTimestamp(alert.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isActive && !alert.acknowledged ? (
                        <Button
                          size="xs"
                          variant="outline"
                          isLoading={isPending}
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      ) : alert.acknowledged ? (
                        <span className="text-xxs font-mono text-text-secondary">
                          Acknowledged
                        </span>
                      ) : (
                        <span className="text-xxs font-mono text-text-secondary/50">
                          -
                        </span>
                      )}
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
