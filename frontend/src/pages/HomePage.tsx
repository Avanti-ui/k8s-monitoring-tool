import React, { useState } from 'react';
import {
  Boxes,
  Server,
  BellRing,
  Terminal,
  Sparkles,
  ArrowRight,
  Globe,
  Share2,
} from 'lucide-react';
import { NavigationTab, PodMetric, NodeMetric, AlertItem, DiscoveredCluster } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MetricBar } from '../components/dashboard/MetricBar';

interface HomePageProps {
  pods: PodMetric[];
  nodes: NodeMetric[];
  alerts: AlertItem[];
  clusters?: DiscoveredCluster[];
  onNavigate: (tab: NavigationTab) => void;
  onRescanClusters?: () => Promise<void>;
  isRescanning?: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({
  pods,
  nodes,
  alerts,
  clusters = [],
  onNavigate,
  onRescanClusters,
  isRescanning = false,
}) => {
  const [activeFeatureTab, setActiveFeatureTab] = useState<'telemetry' | 'loki' | 'multicluster' | 'ai' | 'alerts'>('telemetry');

  const activeAlertsCount = alerts.filter((a) => a.status === 'active').length;
  const reachableClustersCount = clusters.filter((c) => c.isReachable).length;

  return (
    <div className="space-y-8 pb-10 select-none">
      {/* HERO BANNER */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface via-surface-card to-base border border-border p-6 md:p-8">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-72 h-72 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xxs font-mono uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>K8s Observability & Multi-Cluster Control Plane</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary">
            Next-Gen Kubernetes Monitoring, Telemetry & Incident Intelligence
          </h1>

          <p className="text-xs md:text-sm text-text-secondary leading-relaxed">
            A unified, high-density observability dashboard delivering sub-second Prometheus telemetry scraping,
            multi-namespace Loki pod log streaming, multi-cluster auto-discovery (EKS, AKS, GKE, Minikube),
            automated alert rule evaluation, and multi-provider AI root cause analysis.
          </p>

          {/* Quick Stats Strip */}
          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-mono">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-base/80 border border-border">
              <Boxes className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-text-secondary">Pods Monitored:</span>
              <span className="font-semibold text-text-primary">{pods.length || '23'}</span>
            </div>

            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-base/80 border border-border">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-text-secondary">Cluster Nodes:</span>
              <span className="font-semibold text-text-primary">{nodes.length || '1'}</span>
            </div>

            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-base/80 border border-border">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-text-secondary">Discovered Clusters:</span>
              <span className="font-semibold text-text-primary">{clusters.length || '1'}</span>
            </div>

            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-base/80 border border-border">
              <BellRing className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-text-secondary">Active Alerts:</span>
              <span className="font-semibold text-text-primary">{activeAlertsCount}</span>
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="pt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('overview')}
              className="font-medium"
            >
              <span>Explore Live Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('pods')}
            >
              <span>Inspect Pod Telemetry</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('logs')}
            >
              <span>Stream Loki Logs</span>
            </Button>
          </div>
        </div>
      </div>

      {/* CORE CAPABILITIES SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Core Platform Capabilities
            </h2>
            <p className="text-xs text-text-secondary">
              Everything this Kubernetes monitoring tool provides out of the box
            </p>
          </div>
          <span className="text-xxs font-mono text-text-secondary bg-surface px-2.5 py-1 rounded border border-border">
            v1.0.0 Enterprise Spec
          </span>
        </div>

        {/* 6 Capabilities Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Pod Telemetry */}
          <Card className="p-5 space-y-3 bg-surface hover:border-white/20 transition-all">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Real-Time Pod Telemetry & Sparklines
              </h3>
              <p className="text-xxs text-text-secondary mt-1 leading-relaxed">
                10-second continuous Prometheus scrape interval. Tracks CPU % and RAM % utilization with dynamic sparkline gauges, tiered restart counters, and 15-minute drill-down charts.
              </p>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xxs font-mono">
              <span className="text-text-secondary">CrashLoop Detection</span>
              <button
                onClick={() => onNavigate('pods')}
                className="text-accent hover:underline flex items-center space-x-1"
              >
                <span>View Pods</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </Card>

          {/* Card 2: Loki Log Streaming */}
          <Card className="p-5 space-y-3 bg-surface hover:border-white/20 transition-all">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Loki Pod Log Aggregation & Search
              </h3>
              <p className="text-xxs text-text-secondary mt-1 leading-relaxed">
                Direct integration with Grafana Loki and Promtail daemonset. Structured JSON container log parsing, color-coded level badges (INFO/WARN/ERROR), deduped timestamps, and regex filtering.
              </p>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xxs font-mono">
              <span className="text-text-secondary">Multi-Namespace Tail</span>
              <button
                onClick={() => onNavigate('logs')}
                className="text-accent hover:underline flex items-center space-x-1"
              >
                <span>Stream Logs</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </Card>

          {/* Card 3: Multi-Cluster Discovery */}
          <Card className="p-5 space-y-3 bg-surface hover:border-white/20 transition-all">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Multi-Cluster Kubeconfig Auto-Discovery
              </h3>
              <p className="text-xxs text-text-secondary mt-1 leading-relaxed">
                Automatically parses all contexts from $KUBECONFIG, ~/.kube/config, and ~/.kube/*.yaml. Detects AWS EKS, Azure AKS, GCP GKE, and Minikube with non-blocking health checks and live rescan.
              </p>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xxs font-mono">
              <span className="text-text-secondary">{clusters.length} Contexts Loaded</span>
              {onRescanClusters ? (
                <button
                  onClick={onRescanClusters}
                  disabled={isRescanning}
                  className="text-accent hover:underline flex items-center space-x-1"
                >
                  <span>{isRescanning ? 'Scanning...' : 'Rescan Now'}</span>
                </button>
              ) : (
                <span className="text-accent">Auto-Merged</span>
              )}
            </div>
          </Card>

          {/* Card 4: Proactive Alert Rule Engine */}
          <Card className="p-5 space-y-3 bg-surface hover:border-white/20 transition-all">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Proactive Alert Engine & Incident Grouping
              </h3>
              <p className="text-xxs text-text-secondary mt-1 leading-relaxed">
                Evaluates cluster thresholds every 30s. Automatically collapses repeated pod alerts into expandable incident summaries with 1-click acknowledgment and MongoDB audit trail.
              </p>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xxs font-mono">
              <span className="text-text-secondary">Active vs Resolved Tiers</span>
              <button
                onClick={() => onNavigate('alerts')}
                className="text-accent hover:underline flex items-center space-x-1"
              >
                <span>View Alerts</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </Card>

          {/* Card 5: AI Anomaly Analysis */}
          <Card className="p-5 space-y-3 bg-surface hover:border-white/20 transition-all">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Multi-Provider AI Root Cause Analysis
              </h3>
              <p className="text-xxs text-text-secondary mt-1 leading-relaxed">
                Pluggable LLM diagnostic engine supporting Anthropic Claude, OpenAI GPT-4o, Groq Llama-3, and Azure OpenAI. Synthesizes metrics and error logs into actionable remediation recommendations.
              </p>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xxs font-mono">
              <span className="text-text-secondary">Claude • GPT-4o • Groq</span>
              <span className="text-purple-400 font-medium">LLM Integrated</span>
            </div>
          </Card>

          {/* Card 6: Slack Incident Escalation */}
          <Card className="p-5 space-y-3 bg-surface hover:border-white/20 transition-all">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Slack Alerting & Webhook Escalation
              </h3>
              <p className="text-xxs text-text-secondary mt-1 leading-relaxed">
                Instant webhook dispatch to dedicated channels (#k8s-alerts and #k8s-ai-insights). Structured markdown alerts with pod namespace, CPU/RAM stats, and severity markers.
              </p>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xxs font-mono">
              <span className="text-text-secondary">Dual Webhook Pipelines</span>
              <span className="text-amber-400 font-medium">Auto-Notify</span>
            </div>
          </Card>
        </div>
      </div>

      {/* INTERACTIVE CAPABILITY DEMO TABS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Live Feature Simulator & Deep Dive
            </h2>
            <p className="text-xs text-text-secondary">
              Test-drive how the platform processes telemetry, logs, and incidents
            </p>
          </div>

          {/* Feature Selector Tabs */}
          <div className="flex space-x-1 p-1 bg-surface border border-border rounded-lg text-xxs font-mono">
            <button
              onClick={() => setActiveFeatureTab('telemetry')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeFeatureTab === 'telemetry' ? 'bg-accent/15 text-accent font-semibold' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Pod Telemetry
            </button>
            <button
              onClick={() => setActiveFeatureTab('loki')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeFeatureTab === 'loki' ? 'bg-accent/15 text-accent font-semibold' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Loki Terminal
            </button>
            <button
              onClick={() => setActiveFeatureTab('multicluster')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeFeatureTab === 'multicluster' ? 'bg-accent/15 text-accent font-semibold' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Multi-Cluster
            </button>
            <button
              onClick={() => setActiveFeatureTab('ai')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeFeatureTab === 'ai' ? 'bg-accent/15 text-accent font-semibold' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              AI Insights
            </button>
          </div>
        </div>

        {/* Tab Content Display */}
        <div className="bg-surface border border-border rounded-xl p-5">
          {activeFeatureTab === 'telemetry' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-text-secondary font-semibold uppercase">
                  Telemetry Engine Sample: Sub-Second Scrape & Sparkline Gauges
                </span>
                <span className="text-xxs font-mono text-status-healthy">● Scrape Active (10s interval)</span>
              </div>

              <div className="bg-base rounded-lg border border-border/80 overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-white/[0.02] text-xxs font-semibold uppercase text-text-secondary">
                      <th className="py-2 px-3">Sample Pod</th>
                      <th className="py-2 px-3">Namespace</th>
                      <th className="py-2 px-3">CPU Usage (Sparkline)</th>
                      <th className="py-2 px-3">RAM Usage (Sparkline)</th>
                      <th className="py-2 px-3">Restarts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-text-primary">dog-cat-voting-backend-678cc</td>
                      <td className="py-2.5 px-3 text-text-secondary/70 text-xxs">dog-cat-voting</td>
                      <td className="py-2.5 px-3"><MetricBar value={14.2} /></td>
                      <td className="py-2.5 px-3"><MetricBar value={42.8} /></td>
                      <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded-full text-xxs bg-white/[0.04] text-text-secondary">0</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-text-primary">crash-test-pod-busybox</td>
                      <td className="py-2.5 px-3 text-text-secondary/70 text-xxs">default</td>
                      <td className="py-2.5 px-3"><MetricBar value={78.5} /></td>
                      <td className="py-2.5 px-3"><MetricBar value={63.1} /></td>
                      <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded-full text-xxs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">12</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeFeatureTab === 'loki' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-text-secondary font-semibold uppercase">
                  Formatted Loki Stream (JSON Parsing + Color-Coded Levels)
                </span>
                <span className="text-xxs text-accent">Deduplicated & Cleaned</span>
              </div>
              <div className="bg-[#050608] border border-border/80 rounded-lg p-3 font-mono text-xs space-y-2">
                <div className="flex items-start space-x-2.5 text-xs">
                  <span className="text-text-secondary/60 text-xxs">19:54:30.413</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold uppercase">INFO</span>
                  <span className="text-text-primary/90">10.244.0.1:42250 - "GET /health HTTP/1.1" 200 OK</span>
                </div>
                <div className="flex items-start space-x-2.5 text-xs">
                  <span className="text-text-secondary/60 text-xxs">19:54:31.002</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/25 font-semibold uppercase">WARN</span>
                  <span className="text-amber-200/90">Memory consumption approaching 65% threshold on worker thread</span>
                </div>
                <div className="flex items-start space-x-2.5 text-xs">
                  <span className="text-text-secondary/60 text-xxs">19:54:32.180</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold uppercase">ERROR</span>
                  <span className="text-rose-200/90">CrashLoopBackOff: Container failed with exit status 1</span>
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'multicluster' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-text-secondary font-semibold uppercase">
                  Multi-Cluster Context Registry ($KUBECONFIG + ~/.kube/*.yaml)
                </span>
                <span className="text-xxs text-emerald-400">{reachableClustersCount} Reachable Clusters</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-base rounded border border-border flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-2 h-2 rounded-full bg-status-healthy" />
                    <div>
                      <div className="text-text-primary font-medium">production-k8s-cluster (Local)</div>
                      <div className="text-xxs text-text-secondary">Minikube • API: 127.0.0.1:8001</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 uppercase font-semibold">MINIKUBE</span>
                </div>
                <div className="p-3 bg-base rounded border border-border flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-2 h-2 rounded-full bg-status-healthy" />
                    <div>
                      <div className="text-text-primary font-medium">eks-us-east-1-prod (EKS)</div>
                      <div className="text-xxs text-text-secondary">AWS EKS • arn:aws:eks:us-east-1:123456...</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase font-semibold">AWS EKS</span>
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'ai' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-text-secondary font-semibold uppercase">
                  AI Root Cause Pipeline (Multi-LLM Provider Engine)
                </span>
                <span className="text-xxs text-purple-400">Claude Sonnet & GPT-4o Ready</span>
              </div>
              <div className="p-4 bg-base rounded border border-purple-500/20 space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-text-primary">Synthesized Root Cause Analysis</span>
                </div>
                <p className="text-text-secondary text-xxs leading-relaxed font-sans">
                  "Pod <code className="text-purple-300">crash-test-pod</code> in namespace <code className="text-purple-300">default</code> is terminating with exit code 1. Correlated with 12 consecutive restart events within 5 minutes. Recommended remediation: verify entrypoint arguments in deployment YAML or inspect mount volume permissions."
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* END-TO-END ARCHITECTURE PIPELINE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Observability Architecture Pipeline
            </h2>
            <p className="text-xs text-text-secondary">
              How metrics, logs, and alerts flow from Kubernetes to your screen
            </p>
          </div>
        </div>

        <div className="p-6 bg-surface border border-border rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            {/* Step 1 */}
            <div className="p-4 bg-base/80 border border-border rounded-lg space-y-2">
              <div className="w-7 h-7 rounded-full bg-sky-500/10 text-sky-400 mx-auto flex items-center justify-center font-mono text-xs font-bold">
                1
              </div>
              <div className="text-xs font-semibold text-text-primary">Kubernetes Nodes & Pods</div>
              <p className="text-[11px] text-text-secondary">
                Applications running across namespaces (default, kube-system, monitoring, microservices).
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 bg-base/80 border border-border rounded-lg space-y-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center font-mono text-xs font-bold">
                2
              </div>
              <div className="text-xs font-semibold text-text-primary">Prometheus & Loki Promtail</div>
              <p className="text-[11px] text-text-secondary">
                Scrapes CPU/RAM telemetry every 10s and aggregates container logs via in-cluster daemonsets.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 bg-base/80 border border-border rounded-lg space-y-2">
              <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-400 mx-auto flex items-center justify-center font-mono text-xs font-bold">
                3
              </div>
              <div className="text-xs font-semibold text-text-primary">Node.js Engine & AI Agent</div>
              <p className="text-[11px] text-text-secondary">
                Evaluates threshold rules, detects CrashLoops, correlates anomalies, and posts Slack alerts.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-4 bg-base/80 border border-border rounded-lg space-y-2">
              <div className="w-7 h-7 rounded-full bg-accent/10 text-accent mx-auto flex items-center justify-center font-mono text-xs font-bold">
                4
              </div>
              <div className="text-xs font-semibold text-text-primary">React Operator Dashboard</div>
              <p className="text-[11px] text-text-secondary">
                Real-time UI with sparklines, grouped alerts, multi-cluster context selector, and terminal streaming.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
