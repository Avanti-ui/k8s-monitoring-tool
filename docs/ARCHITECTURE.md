# 🏛️ Architecture & Workflow Specification

This document provides a comprehensive, production-grade architectural specification of the **Kubernetes Monitoring & Autonomous AI Observability Platform**. It details the end-to-end telemetry pipeline, the autonomous AI evaluation engine, and the multi-channel notification architecture across **Slack ChatOps** and **SMTP Email**.

---

## 📑 Table of Contents

1. [Executive Summary & System Vision](#1-executive-summary--system-vision)
2. [Global System Architecture Diagram](#2-global-system-architecture-diagram)
3. [Component Breakdown by Layer](#3-component-breakdown-by-layer)
4. [End-to-End Project Workflows](#4-end-to-end-project-workflows)
   - [Workflow A: Telemetry & Log Ingestion Pipeline](#workflow-a-telemetry--log-ingestion-pipeline)
   - [Workflow B: Deterministic Threshold Rule Engine](#workflow-b-deterministic-threshold-rule-engine)
   - [Workflow C: Autonomous AI Anomaly & Root-Cause Engine](#workflow-c-autonomous-ai-anomaly--root-cause-engine)
   - [Workflow D: Incident Alert Lifecycle & Auto-Healing](#workflow-d-incident-alert-lifecycle--auto-healing)
5. [Deep Dive: Slack ChatOps Integration](#5-deep-dive-slack-chatops-integration)
   - [Dual-Webhook Architecture](#dual-webhook-architecture)
   - [Slack Block Kit Construction](#slack-block-kit-construction)
   - [Rate-Limiting & Async HTTP Dispatch](#rate-limiting--async-http-dispatch)
6. [Deep Dive: SMTP Email Notification System](#6-deep-dive-smtp-email-notification-system)
   - [Dual-Channel Notification Strategy](#dual-channel-notification-strategy)
   - [Dynamic Recipient Discovery Engine](#dynamic-recipient-discovery-engine)
   - [Non-Blocking Async Thread Offloading](#non-blocking-async-thread-offloading)
   - [Individual Envelope Privacy Delivery](#individual-envelope-privacy-delivery)
   - [Cryptographic Security (SSL vs STARTTLS)](#cryptographic-security-ssl-vs-starttls)
   - [Responsive HTML & Plain-Text Multipart Templates](#responsive-html--plain-text-multipart-templates)
7. [System Sequence Diagrams](#7-system-sequence-diagrams)
   - [Sequence 1: Threshold Metric Breach to Multi-Channel Dispatch](#sequence-1-threshold-metric-breach-to-multi-channel-dispatch)
   - [Sequence 2: Log-Correlated AI Root-Cause Diagnostic Pipeline](#sequence-2-log-correlated-ai-root-cause-diagnostic-pipeline)
   - [Sequence 3: User Signup & Dynamic Alert Recipient Synchronization](#sequence-3-user-signup--dynamic-alert-recipient-synchronization)
8. [Data Models & State Transitions](#8-data-models--state-transitions)
9. [Resilience, Fault Tolerance & Security Considerations](#9-resilience-fault-tolerance--security-considerations)

---

## 1. Executive Summary & System Vision

Traditional monitoring platforms (e.g., standard Prometheus/Alertmanager setups) notify SREs and developers that an operational threshold has failed (e.g., `CPU > 85%` or `CrashLoopBackOff`), leaving on-call engineers to manually correlate metrics, tail logs across multiple pods, identify the root cause, and formulate remediation commands under high stress.

This platform bridges that gap by implementing a **dual-engine architecture**:
1. **Deterministic Rule Engine**: Instantly catches hard metric violations (CPU, Memory, CrashLoop restarts, Node readiness) every 30 seconds and notifies operators via low-latency channels.
2. **Autonomous AI Diagnostic Engine**: Periodically aggregates container telemetry alongside live error log excerpts from Grafana Loki, passes them through high-throughput LLMs (Groq, OpenAI, Anthropic, or Azure OpenAI), determines the root cause, and provides exact, copy-pasteable `kubectl` commands.
3. **Multi-Channel Alerting Hub**: Dispatches decoupled alerts and diagnostic cards across **Slack** (via dual Block Kit webhooks) and **Email** (via asynchronous SMTP with dynamic registered user discovery).

---

## 2. Global System Architecture Diagram

```mermaid
flowchart TD
    subgraph ClusterLayer["Kubernetes Workload & Infrastructure Layer"]
        K8sPods["Pod Containers\n(cAdvisor & Application Logs)"]
        K8sNodes["Kubernetes Nodes\n(Kubelet & Node Exporter)"]
    end

    subgraph IngestionLayer["Telemetry & Logging Ingestion Layer"]
        Prom["Prometheus Operator\n(:9090 / Metrics TSDB)"]
        Promtail["Promtail DaemonSet\n(Log Collector)"]
        Loki["Grafana Loki\n(:3100 / LogQL Stream)"]
    end

    subgraph CoreBackend["Core Backend Service (FastAPI / Port 4000)"]
        Discovery["Cluster Discovery Service\n(Kubeconfig Multi-Cluster Scanner)"]
        
        subgraph EnginePipelines["Background Evaluation Loops"]
            RuleEngine["Deterministic Rule Engine\n(30s Loop / Thresholds & Auto-Resolve)"]
            AIEngine["Autonomous AI Anomaly Engine\n(30-60s Loop / Log Correlator)"]
        end

        subgraph Dispatchers["Notification Hub"]
            SlackDispatcher["Slack Webhook Dispatcher\n(Block Kit / Async HTTP)"]
            EmailDispatcher["SMTP Email Dispatcher\n(Thread-Offloaded / Dynamic Recipient Pool)"]
        end

        APIRoutes["FastAPI REST Endpoints\n(/api/alerts, /api/metrics, /api/logs)"]
    end

    subgraph StateStore["Persistence & State Store"]
        MongoDB[("MongoDB :27017\n(alerts, users, audit)")]
    end

    subgraph CognitiveLayer["Cognitive AI Providers"]
        LLM["Groq API (Llama 3.1 / GPT-OSS-120B)\nOpenAI (GPT-4o) / Claude 3.5"]
    end

    subgraph DeliveryChannels["External Alert Channels"]
        SlackAlerts["#k8s-alerts Channel\n(SLACK_WEBHOOK_URL_ALERTS)"]
        SlackAI["#k8s-ai-insights Channel\n(SLACK_WEBHOOK_URL_AI_ANALYSIS)"]
        MailServer["SMTP Mail Server\n(Gmail / SendGrid / Corporate SMTP)"]
    end

    subgraph UserLayer["Presentation & Operator Layer"]
        ReactDashboard["React + TypeScript Dashboard\n(Vite / Tailwind / Port 3000)"]
        SREOperators["SRE & On-Call Engineers\n(Inboxes & Slack Desktops)"]
    end

    %% Connections
    K8sPods -->|Scrape metrics| Prom
    K8sNodes -->|Scrape node stats| Prom
    K8sPods -->|Stream stdout/stderr| Promtail
    Promtail -->|Push chunks| Loki

    Discovery -.->|Scan ~/.kube| K8sNodes
    Prom -->|Query CPU, RAM, Restarts| RuleEngine
    Prom -->|Query Metric Summaries| AIEngine
    Loki -->|Fetch Error Logs| AIEngine

    RuleEngine -->|Persist Fired/Resolved Alerts| MongoDB
    RuleEngine -->|Trigger Immediate Alert| SlackDispatcher
    RuleEngine -->|Trigger Immediate Alert| EmailDispatcher

    AIEngine -->|Metrics + Error Samples| LLM
    LLM -->|Structured Root Cause + Fix| AIEngine
    AIEngine -->|Persist Diagnostic Finding| MongoDB
    AIEngine -->|Send Rich Block Kit Card| SlackDispatcher
    AIEngine -->|Send HTML Diagnostic Report| EmailDispatcher

    SlackDispatcher -->|HTTP POST| SlackAlerts
    SlackDispatcher -->|HTTP POST| SlackAI
    EmailDispatcher -->|STARTTLS / SSL :587| MailServer
    MailServer -->|Deliver HTML Emails| SREOperators
    SlackAlerts -->|Notify| SREOperators
    SlackAI -->|Notify| SREOperators

    MongoDB <--> APIRoutes
    APIRoutes <--> ReactDashboard
```

---

## 3. Component Breakdown by Layer

| Layer | Component | Source Location | Responsibility |
|---|---|---|---|
| **Cluster & Telemetry** | Prometheus Operator | Port `9090` | Collects 15s pod and node metrics (`container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`, `kube_pod_container_status_restarts_total`). |
| **Cluster & Telemetry** | Grafana Loki & Promtail | Port `3100` | Aggregates stdout/stderr logs from all pods. Exposes LogQL query API for real-time streaming and targeted log searches. |
| **Ingestion & Discovery** | Cluster Discovery | [`cluster_discovery.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/cluster_discovery.py) | Parses `$KUBECONFIG`, `~/.kube/config`, and `~/.kube/*.yaml` to auto-detect AWS EKS, Azure AKS, GCP GKE, and local Minikube clusters. |
| **Telemetry Clients** | Prometheus & Loki Clients | [`prometheus.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/prometheus.py)<br/>[`loki.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/loki.py) | High-performance asynchronous HTTP clients using `httpx` for querying metrics and retrieving pod log lines. |
| **Core Engine** | Threshold Rule Engine | [`rule_engine.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/rule_engine.py) | Background worker executing every 30 seconds. Evaluates CPU/RAM thresholds, restart rate deltas, and node conditions. Manages active/resolved alert transitions. |
| **Cognitive Engine** | AI Anomaly Engine | [`ai_engine.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/ai_engine.py)<br/>[`services/ai/`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/ai/) | Background worker executing every 30-60 seconds. Aggregates pod telemetry, extracts recent error logs, invokes LLMs, and synthesizes root-cause analyses with actionable remediation scripts. |
| **ChatOps** | Slack Webhook Service | [`slack.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/slack.py) | Formats and dispatches structured Block Kit JSON payloads across separate alert and AI analysis webhooks. |
| **Email Service** | SMTP Alert Service | [`email_service.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/email_service.py) | Dynamic recipient resolution engine, thread-offloaded SMTP delivery, MIME multipart HTML/Text generation, and test verification endpoint. |
| **State & Storage** | MongoDB Database | Port `27017` / Motor Async | Stores active/resolved alerts, registered user accounts, and historical incident records. |
| **API Gateway** | FastAPI REST Server | [`main.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/main.py)<br/>[`api/`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/api/) | Exposes secured REST endpoints (`/api/alerts`, `/api/metrics`, `/api/logs`, `/api/clusters`, `/api/config`) with JWT auth. |
| **Frontend** | React Dashboard | [`frontend/src/`](file:///home/f33/Documents/k8s-monitoring-tool/frontend/src/) | Modern dark-themed cyber dashboard with real-time health sparklines, grouped alerts, log viewer, and manual remediation triggers. |

---

## 4. End-to-End Project Workflows

### Workflow A: Telemetry & Log Ingestion Pipeline

```mermaid
flowchart LR
    A["Kubernetes Workloads"] -->|cAdvisor / Kubelet| B["Prometheus (:9090)"]
    A -->|stdout / stderr| C["Promtail DaemonSet"]
    C -->|Push Chunks| D["Grafana Loki (:3100)"]
    B -->|Async HTTP GET\n/api/v1/query| E["backend/app/services/prometheus.py"]
    D -->|Async HTTP GET\n/loki/api/v1/query_range| F["backend/app/services/loki.py"]
```

1. **Metrics Scraping**: Prometheus scrapes pod and node metrics every 15 seconds. Pod CPU usage is computed from `rate(container_cpu_usage_seconds_total[1m])` and compared against limits or cores. Pod RAM is queried via `container_memory_working_set_bytes`.
2. **Log Streaming**: Promtail tails pod logs on each node and pushes compressed chunks to Grafana Loki.
3. **Async Fetching**: The backend uses asynchronous HTTP clients (`httpx.AsyncClient`) with connection pooling and 5-second timeouts to pull metrics and logs without blocking other threads.
4. **Namespace Filtering**: Internal Kubernetes namespaces (`kube-system`, `kube-public`, `kube-node-lease`, `monitoring`) can be excluded from user notifications via `EXCLUDE_SYSTEM_NAMESPACES=true`.

---

### Workflow B: Deterministic Threshold Rule Engine

The Threshold Rule Engine ([`rule_engine.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/rule_engine.py)) operates in a continuous background loop initiated upon FastAPI application startup.

```mermaid
flowchart TD
    Start["Tick Every 30s"] --> FetchMetrics["Fetch Pod & Node Metrics from Prometheus"]
    FetchMetrics --> FilterNS{"Is Pod in System Namespace & Exclude Enabled?"}
    FilterNS -- Yes --> Skip["Skip Internal Pod"]
    FilterNS -- No --> EvalCond["Evaluate Threshold Rules"]

    EvalCond --> CheckCPU{"CPU > 95% (Crit)\nor CPU > 80% (Warn)"}
    EvalCond --> CheckMem{"RAM > 95% (Crit)\nor RAM > 85% (Warn)"}
    EvalCond --> CheckRestart{"Restart Count > Last Recorded?"}
    EvalCond --> CheckNode{"Node Status != Ready?"}

    CheckCPU -- Triggered --> BuildCondition["Build Fired Condition"]
    CheckMem -- Triggered --> BuildCondition
    CheckRestart -- Triggered --> BuildCondition
    CheckNode -- Triggered --> BuildCondition

    BuildCondition --> QueryDB["Query Active Alerts from MongoDB"]
    QueryDB --> CheckExisting{"Alert Key (pod::rule)\nAlready Active?"}

    CheckExisting -- "No (New Breach)" --> InsertDB["Insert New Alert Document (status='active')"]
    InsertDB --> SlackAlert["Dispatch to SLACK_WEBHOOK_URL_ALERTS"]
    SlackAlert --> EmailAlert["Dispatch to Recipient Email Inboxes"]

    CheckExisting -- "Yes (Already Active)" --> Maintain["Maintain Active State (Deduplication)"]

    QueryDB --> CheckResolved{"Active Alerts in DB\nNot in Current Fired Keys?"}
    CheckResolved -- Yes --> AutoResolve["Auto-Resolve Alert in DB (status='resolved')"]
```

- **Threshold Matrix**:
  - **Critical CPU**: `cpu_percent > 95%`
  - **Warning CPU**: `cpu_percent > 80%`
  - **Critical Memory**: `memory_percent > 95%`
  - **Warning Memory**: `memory_percent > 85%`
  - **CrashLoopBackOff**: `pod.restart_count > last_recorded_restart_count`
  - **Node Offline**: `node.status != "Ready"`
- **Deduplication Key**: Composite key `f"{pod}::{rule}"`. If an alert is already `active` in MongoDB, duplicate notification dispatches are prevented.
- **Auto-Resolution**: If a previously active alert key is no longer detected in the current metric evaluation cycle, the document status is automatically transitioned to `resolved` with a `resolved_at` UTC timestamp.

---

### Workflow C: Autonomous AI Anomaly & Root-Cause Engine

The Autonomous AI Engine ([`ai_engine.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/ai_engine.py)) runs concurrently in the background every 30 to 60 seconds.

```mermaid
flowchart TD
    AITick["Tick Every 30s-60s"] --> CheckEnabled{"AI_ENABLED == True?"}
    CheckEnabled -- No --> SleepCycle["Sleep for Next Interval"]
    CheckEnabled -- Yes --> PullMetrics["Fetch Current Pod Metrics Summary"]

    PullMetrics --> LoopPods["Iterate Pods (Ignore System Namespaces)"]
    LoopPods --> QueryLoki["Sample Pod Logs from Loki (limit=25)"]
    QueryLoki --> FilterLogs["Regex Filter: 'error', 'exception', 'fatal', 'oom', 'deadlock', 'panic', 'timeout', '500'"]
    FilterLogs --> CapLogs["Cap to Top 3 Sample Error Lines (Token-Guard)"]

    CapLogs --> BuildPayload["Construct AnalysisInput Payload (Pods + Error Samples)"]
    BuildPayload --> InvokeLLM["Invoke Provider (Groq / OpenAI / Claude)"]
    InvokeLLM --> ParseJSON["Validate Structured JSON Response against Finding Schema"]

    ParseJSON --> HasAnomalies{"Anomalies Detected?"}
    HasAnomalies -- No --> LogClean["Log 'No anomalies detected'"]
    HasAnomalies -- Yes --> LoopFindings["Iterate Findings"]

    LoopFindings --> CheckDup{"Finding Key (pod::summary)\nAlready in Active AI Alerts?"}
    CheckDup -- Yes --> SkipFinding["Skip Duplicate Finding"]
    CheckDup -- No --> SaveDB["Persist to MongoDB alerts (source='ai')"]

    SaveDB --> SlackCard["Dispatch Block Kit Card to SLACK_WEBHOOK_URL_AI_ANALYSIS"]
    SlackCard --> Throttle["asyncio.sleep(0.6) (Slack Rate Limit Protection)"]
    Throttle --> EmailFinding["Dispatch Styled HTML Diagnostic Report via SMTP"]
```

#### Token Optimization & Safety:
To ensure high inference speed and minimize token costs:
1. Logs are filtered using high-precision error signatures (`error`, `exception`, `fatal`, `warn`, `panic`, `timeout`, `oom`, `deadlock`, `refused`, `504`, `500`).
2. Log samples are capped strictly to **3 lines per pod**.
3. Prompts enforce strict single-block JSON generation without conversational preamble, parsed directly into Pydantic models.

---

### Workflow D: Incident Alert Lifecycle & Auto-Healing

```mermaid
stateDiagram-v2
    [*] --> MetricOrLogAnomaly: Pod exceeds threshold / errors in logs
    
    MetricOrLogAnomaly --> Active: RuleEngine or AIEngine fires
    note right of Active
      - Alert stored in MongoDB with status='active'
      - Dispatched to Slack (Alerts or AI channel)
      - Dispatched to Email inboxes
    end note

    Active --> Acknowledged: Operator clicks 'Acknowledge' in Dashboard
    note right of Acknowledged
      - Operator investigating or executing remediation
      - acknowledged=True in MongoDB
    end note

    Active --> Resolved: Workload auto-recovers or scales
    Acknowledged --> Resolved: Remediation command executed (e.g., rollout restart)
    note right of Resolved
      - Condition clears in next 30s evaluation cycle
      - status='resolved', resolved_at timestamp set
    end note

    Resolved --> [*]
```

---

## 5. Deep Dive: Slack ChatOps Integration

The Slack integration ([`slack.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/slack.py)) implements a dual-stream architecture separating noise from deep intelligence.

### Dual-Webhook Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │               Backend Engine                 │
                    └──────────────┬────────────────┬──────────────┘
                                   │                │
            Threshold Breach Fired │                │ AI Root Cause Diagnosed
                                   ▼                ▼
                     ┌───────────────────┐    ┌───────────────────┐
                     │ send_slack_alert  │    │send_slack_ai_find.│
                     └─────────┬─────────┘    └─────────┬─────────┘
                               │                        │
                               ▼                        ▼
                   SLACK_WEBHOOK_URL_ALERTS   SLACK_WEBHOOK_URL_AI_ANALYSIS
                               │                        │
                               ▼                        ▼
                       #k8s-alerts Channel      #k8s-ai-insights Channel
                       (Immediate PagerDuty)    (Actionable Remediation)
```

1. **`SLACK_WEBHOOK_URL_ALERTS`**: Used for immediate threshold-based alarms. It outputs high-priority operational telemetry (Pod name, Namespace, Severity badge, and breached metric value).
2. **`SLACK_WEBHOOK_URL_AI_ANALYSIS`**: Used strictly for synthesized AI diagnostic findings. It isolates verbose root-cause explanations and multi-line remediation commands from high-frequency alert channels.

### Slack Block Kit Construction

All messages leverage Slack's native **Block Kit UI framework** for clean typography, visual hierarchy, and easy mobile reading:

#### 1. Threshold Alert Block Kit Structure:
- **Header Block**: Displays dynamic severity icons (`🚨 [CRITICAL]` or `⚠️ [WARNING]`) and the violated rule name.
- **Section Block (2-Column Fields)**: Displays Pod, Namespace, Severity, and UTC Timestamp.
- **Section Block (Markdown)**: Details the exact metric value (e.g., `96.4% CPU utilization`).
- **Divider Block**: Visually isolates multiple incident cards.

#### 2. AI Incident Insight Block Kit Structure:
- **Header Block**: Displays `🔎 AI Incident Insights — <pod-name>`.
- **Metadata Fields**: Pod, Namespace, Severity badge (`🔴 CRITICAL`, `🟡 WARNING`, `🔵 INFO`), and Analyzed At timestamp.
- **Summary Section**: Clean summary of the observed anomaly.
- **Likely Root Cause Section**: Plain-English explanation of why the failure occurred.
- **Recommended Action Section**: Formatted within a code block (```` ```kubectl ...``` ````) for single-tap copying and execution by on-call engineers.

### Rate-Limiting & Async HTTP Dispatch
- Dispatches are performed asynchronously via `httpx.AsyncClient` with a strict connection timeout (5.0s for raw alerts, 10.0s for AI payloads).
- When multiple AI anomalies fire simultaneously, a **600ms throttle** (`await asyncio.sleep(0.6)`) is enforced between outgoing webhook calls to prevent Slack HTTP 429 (Rate Limit Exceeded) responses.

---

## 6. Deep Dive: SMTP Email Notification System

The SMTP Email system ([`email_service.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/email_service.py)) delivers enterprise-grade email alerts directly to operator inboxes.

### Dual-Channel Notification Strategy

Similar to the Slack integration, the email system generates two distinct email types:
1. **Rule Breach Incident Alerts (`send_email_alert`)**: Instant notifications when CPU, Memory, or CrashLoop thresholds fire. Styled with clean tabular metadata and high-visibility alert headers.
2. **AI Diagnostic & Root-Cause Reports (`send_email_ai_finding`)**: Deep-dive post-mortem quality reports containing the full SRE analysis, root cause, and pre-formatted terminal commands.

### Dynamic Recipient Discovery Engine

Rather than relying solely on static recipient lists that quickly become stale, the system implements an intelligent dynamic recipient resolver ([`get_alert_recipients()`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/email_service.py#L19)):

```mermaid
flowchart TD
    StartResolver["get_alert_recipients() invoked"] --> ReadEnv["1. Read settings.SMTP_TO_EMAILS (.env)"]
    ReadEnv --> ParseStatic["Parse comma-separated / list addresses"]
    
    ParseStatic --> QueryDB["2. Query MongoDB 'users' Collection"]
    QueryDB --> StreamUsers["Stream all registered user email addresses\n(db.users.find({}, {email: 1}))"]
    
    StreamUsers --> MergePool["3. Merge into unified Python set()"]
    MergePool --> Sanitize["Trim Whitespace & Normalize to Lowercase"]
    Sanitize --> FilterEmpty["Filter Invalid / Empty Entries"]
    FilterEmpty --> SortRecipients["Return Deduplicated, Sorted Recipient List"]
```

> [!NOTE]
> **Automatic Onboarding**: Whenever a new DevOps engineer or operator registers an account on the dashboard via the web UI, their email is automatically included in future incident alerts without requiring any server configuration changes or restarts!

### Non-Blocking Async Thread Offloading

Python's built-in `smtplib` library is synchronous and blocking. If executed directly inside FastAPI's async event loop, establishing TLS handshakes and delivering emails would stall the entire server, freezing dashboard queries and metric polling.

To solve this, the email service offloads all SMTP communication to a background worker thread using:
```python
return await asyncio.to_thread(
    _send_smtp_sync,
    subject=subject,
    text_content=text_content,
    html_content=html_content,
    to_addrs=recipients,
)
```
This guarantees **zero latency impact** on the main event loop.

### Individual Envelope Privacy Delivery

In enterprise incident response, broadcasting all recipient addresses in a shared `To:` or `Cc:` header can leak email addresses and cause confusion. The platform's internal `_deliver_messages()` loop transmits separate envelopes to each recipient:

```python
for rcpt in recipients:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = rcpt  # Dedicated single recipient per message
    ...
    server.sendmail(sender, [rcpt], msg.as_string())
```
This delivers personalized, private messages to every engineer while recording exact per-recipient delivery statuses.

### Cryptographic Security (SSL vs STARTTLS)

The system supports two enterprise encryption standards configurable via environment variables:

| Protocol | Typical Port | Environment Configuration | Connection Mechanism |
|---|---|---|---|
| **STARTTLS** | `587` | `SMTP_USE_TLS=true`<br/>`SMTP_USE_SSL=false` | Connects via plain TCP, initializes default SSL context (`ssl.create_default_context()`), and upgrades connection via `server.starttls()`. |
| **Direct SSL** | `465` | `SMTP_USE_SSL=true`<br/>`SMTP_USE_TLS=false` | Establishes a TLS-encrypted connection from byte 1 via `smtplib.SMTP_SSL()`. |

### Responsive HTML & Plain-Text Multipart Templates

Every email is packaged as a `MIMEMultipart("alternative")` container containing two distinct representations:
1. **Plain-Text Alternative (`text/plain`)**: Renderable on smartwatches, terminal mail clients (Mutt/Alpine), and low-bandwidth connections.
2. **Responsive HTML (`text/html`)**:
   - Modern slate-dark palette matching the dashboard theme.
   - Dynamic status badges (`#ef4444` for Critical, `#f59e0b` for Warning).
   - Structured metadata tables with monospace font for pod and namespace names.
   - Distinct emerald-highlighted remediation cards (`#10b981`) with dark code blocks for instant command copying.

---

## 7. System Sequence Diagrams

### Sequence 1: Threshold Metric Breach to Multi-Channel Dispatch

```mermaid
sequenceDiagram
    autonumber
    participant K8s as Kubernetes Cluster
    participant Prom as Prometheus (:9090)
    participant Rule as Rule Engine (30s Loop)
    participant DB as MongoDB (:27017)
    participant Slack as Slack Webhook (#k8s-alerts)
    participant Email as SMTP Server
    participant User as SRE Inboxes & Channels

    Rule->>Prom: GET /api/v1/query (Pod CPU/RAM/Restarts)
    Prom-->>Rule: Telemetry Matrix
    Rule->>Rule: Detect Violation (e.g. CPU=96% > 95%)
    Rule->>DB: Query active alerts for 'payment-service::high-cpu'
    
    alt Alert Not Already Active
        Rule->>DB: insert_one({pod: 'payment-service', status: 'active', ...})
        par Slack Notification
            Rule->>Slack: POST Block Kit payload (SLACK_WEBHOOK_URL_ALERTS)
            Slack-->>User: Display Alert Card in #k8s-alerts
        and Email Notification
            Rule->>DB: Query registered users + SMTP_TO_EMAILS
            DB-->>Rule: Recipient List ['devops@corp.com', 'oncall@corp.com']
            Rule->>Email: Async thread SMTP TLS delivery
            Email-->>User: Deliver Rich HTML Alert to Inboxes
        end
    else Alert Already Active
        Rule->>Rule: Suppress duplicate dispatch
    end
```

---

### Sequence 2: Log-Correlated AI Root-Cause Diagnostic Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant Prom as Prometheus
    participant Loki as Grafana Loki
    participant AI as AI Engine (30s Loop)
    participant Groq as Groq / OpenAI LLM API
    participant DB as MongoDB
    participant Slack as Slack (#k8s-ai-insights)
    participant Email as SMTP Server
    participant Operator as SRE Operator

    AI->>Prom: Query current pod metric averages
    Prom-->>AI: Pod metrics list
    loop For Each Non-System Pod
        AI->>Loki: GET /loki/api/v1/query_range?query={pod=~"<pod>.*"}
        Loki-->>AI: Raw Log Stream (limit 25)
        AI->>AI: Filter error lines & cap to top 3 lines
    end

    AI->>Groq: POST /chat/completions (Metrics + Error Log Excerpts)
    Groq-->>AI: Structured JSON (Finding: Summary, Root Cause, Kubectl Fix)
    
    AI->>DB: Check if finding already active
    alt New Anomaly Diagnosed
        AI->>DB: insert_one({source: 'ai', status: 'active', fix: 'kubectl ...'})
        
        AI->>Slack: POST Block Kit (SLACK_WEBHOOK_URL_AI_ANALYSIS)
        Slack-->>Operator: Post Diagnostic Card with Copyable Fix
        
        AI->>AI: await asyncio.sleep(0.6) (Rate-Limit Throttle)
        
        AI->>Email: Async SMTP dispatch (HTML AI Diagnostic Card)
        Email-->>Operator: Deliver Root-Cause Post-Mortem Email
    end
```

---

### Sequence 3: User Signup & Dynamic Alert Recipient Synchronization

```mermaid
sequenceDiagram
    autonumber
    participant NewUser as New DevOps Engineer
    participant UI as React Web Dashboard
    participant API as FastAPI (/api/auth)
    participant DB as MongoDB (users collection)
    participant EmailSvc as email_service.py

    NewUser->>UI: Enter email ('alice@company.com') & password
    UI->>API: POST /api/auth/signup
    API->>API: Hash password with bcrypt
    API->>DB: insert_one({email: 'alice@company.com', hashed_pw: ...})
    DB-->>API: Success
    API-->>UI: Return JWT Session Token
    
    note over EmailSvc, DB: Next time RuleEngine or AIEngine fires an alert
    EmailSvc->>DB: db.users.find({}, {email: 1})
    DB-->>EmailSvc: ['admin@company.com', 'alice@company.com']
    EmailSvc->>NewUser: Deliver Incident Alert to Alice automatically!
```

---

## 8. Data Models & State Transitions

### Alert Document Schema (MongoDB `alerts` Collection)

```json
{
  "_id": { "$oid": "670f5e1234567890abcdef12" },
  "pod": "order-service-679fd84c7d-8g29x",
  "namespace": "production",
  "rule": "high-cpu",
  "severity": "critical",
  "message": "96.4% CPU utilization",
  "status": "active",
  "acknowledged": false,
  "source": "rule",
  "likely_root_cause": "Unbounded thread pool processing parallel payment webhooks under peak traffic.",
  "recommended_action": "kubectl scale deployment order-service -n production --replicas=5",
  "created_at": "2026-10-18T10:15:30.000Z",
  "resolved_at": null
}
```

### State Fields:
- **`status`**: `"active"` | `"resolved"`
- **`severity`**: `"critical"` | `"warning"` | `"info"`
- **`source`**: `"rule"` (Threshold engine) | `"ai"` (LLM anomaly diagnosis)
- **`acknowledged`**: `boolean` (Set by operator via UI button)

---

## 9. Resilience, Fault Tolerance & Security Considerations

1. **Non-Blocking Execution**:
   - Long-running network I/O (Loki queries, LLM API calls, SMTP connections) is fully separated from user-facing API routes.
   - Synchronous socket communication (SMTP) runs in a dedicated thread pool via `asyncio.to_thread`.
2. **Circuit Breaking & Fallback Modes**:
   - If Prometheus or Loki becomes temporarily unavailable, background loops log warnings and resume gracefully on the next tick without crashing the FastAPI application.
   - If AI provider quotas or keys fail, the deterministic rule engine continues firing threshold alerts unimpeded.
3. **Sensitive Credential Isolation**:
   - SMTP passwords, Slack webhook URLs, database connection strings, and LLM API keys are strictly configured through environment variables ([`config.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/config.py)) and never committed to source repositories.
4. **Token Cost Controls**:
   - Raw log output is bounded to 25 lines per pod and capped to 3 error lines in prompt payloads, enforcing sub-second inference latency and minimal token consumption.
5. **Deduplication Safeguards**:
   - In-memory restart trackers and active MongoDB document lookups prevent alert floods across both Slack webhooks and email mailboxes.
