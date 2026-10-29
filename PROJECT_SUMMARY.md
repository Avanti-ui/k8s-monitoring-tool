# 🚀 Project Overview (Simple Beginner Guide)

> **Think of this project as an automated AI Doctor & Mechanic for applications running on Kubernetes.**

---

## 📌 1. What Problem Does This Solve?

When companies run their websites and services on the cloud using **Kubernetes**, things can go wrong:
- Servers run out of memory.
- Apps crash or freeze.
- Websites get slow under heavy traffic.

### The Old Way (Traditional Monitoring)
You get a generic panic alert in the middle of the night:
> 🚨 *"Warning: Pod error / CPU is 98% / CrashLoopBackOff!"*

You have to wake up, open terminal commands, read through thousands of confusing server log lines, and guess what broke and how to fix it.

### The New Way (What This Project Does)
Instead of just shouting that something is broken, this tool **diagnoses the exact problem using AI** and tells you how to fix it.

---

## ⚙️ 2. How It Works (Step-by-Step)

```
[ Your Apps in Kubernetes ]
           │
           ▼
1. Collects Metrics & Logs (Prometheus & Loki)
           │
           ▼
2. Detects Problem (Rule Engine detects high CPU, crashes, or memory leaks)
           │
           ▼
3. Asks AI Doctor (Groq / OpenAI / Claude)
   "Here are the logs and numbers. What broke, and what command fixes it?"
           │
           ▼
4. Delivers Solutions Across Multi-Channels:
   ├── 💬 Slack Channels (Instant alarms + AI Block Kit cards)
   ├── 📧 Email Inboxes (Auto-delivered to all registered users + SRE team)
   └── 🖥️ Web Dashboard (Live visual status, graphs & 1-click acknowledge)
```

1. **👀 Monitors Continuously:** Constantly tracks memory, CPU usage, and error logs across your containers.
2. **🧠 Calls AI for Diagnosis:** When an error or crash occurs, it sends the logs and stats to an LLM (like Groq, OpenAI, or Claude).
3. **💡 Explains & Solves:** The AI explains the root cause in simple language and gives you the exact command (`kubectl ...`) to resolve it.
4. **💬 Alerts Your Team via Slack & Email:**
   - **Slack Channels:** Posts immediate metric alarms to `#k8s-alerts` and comprehensive AI diagnostic cards with copyable commands to `#k8s-ai-insights`.
   - **Email Inboxes:** Automatically discovers all registered users and sends rich HTML post-mortem cards directly to their inbox without blocking the server.
5. **🖥️ Live Web Dashboard:** A user-friendly dark-mode dashboard where you can see all pods, clusters, real-time health graphs, and live logs.

> [!TIP]
> For the complete enterprise technical blueprint with sequence diagrams and state machines, see [**`docs/ARCHITECTURE.md`**](file:///home/f33/Documents/k8s-monitoring-tool/docs/ARCHITECTURE.md).

---

## 🔍 3. Real-World Comparison

| Situation | Traditional Alert | With This AI Monitoring Platform |
|---|---|---|
| **Memory Leak** | *"Pod OOMKilled"* | 🤖 *"Payment service ran out of memory due to an unclosed session in code. Run: `kubectl rollout restart deployment payment`"* |
| **CPU Spike** | *"CPU > 90%"* | 🤖 *"High CPU caused by 1500 parallel checkout requests. Run: `kubectl scale deployment order-service --replicas=5` to distribute load."* |
| **Crashing App** | *"CrashLoopBackOff"* | 🤖 *"Database connection string is missing in environment variables. Run: `kubectl edit configmap app-config` to add DB_URL."* |

---

## 📁 4. Project Structure (What Each Part Does)

- [**backend/**](file:///home/f33/Documents/k8s-monitoring-tool/backend): 
  - Written in **Python (FastAPI)**.
  - Scrapes metrics from Prometheus and logs from Loki.
  - Sends error context to AI models (Groq / OpenAI / Anthropic).
  - Posts alert messages to Slack.
- [**frontend/**](file:///home/f33/Documents/k8s-monitoring-tool/frontend): 
  - Written in **React + TypeScript + Vite**.
  - Provides the web user interface with real-time graphs, logs, and alerts.
- [**k8s/**](file:///home/f33/Documents/k8s-monitoring-tool/k8s):
  - Kubernetes configuration files and deployment manifests.
- [**README.md**](file:///home/f33/Documents/k8s-monitoring-tool/README.md):
  - Technical setup guide, environment variables, and architecture details.

---

## 👥 5. What Was Built? (Backend vs. Frontend in Simple Terms)

### ⚙️ What the Backend Does (The "Engine & Brain")
The backend runs silently in the background and does the heavy lifting:
1. **Cluster Auto-Discovery ([`cluster_discovery.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/cluster_discovery.py))**: Automatically finds and connects to local or cloud Kubernetes clusters (Minikube, AWS EKS, Azure AKS, Google GKE).
2. **Metrics & Logs Collector ([`prometheus.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/prometheus.py) & [`loki.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/loki.py))**: Constantly polls live CPU/RAM usage and pulls error logs from all running pods.
3. **Threshold Watchdog ([`rule_engine.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/rule_engine.py))**: Runs every 30 seconds to catch high CPU, memory spikes, or crashing pods.
4. **AI Diagnostic Engine ([`ai_engine.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/ai_engine.py))**: Packages error logs and metrics, sends them to AI models (Groq, OpenAI, Claude), and extracts clean root-cause explanations and fix commands.
5. **Slack Bot ([`slack.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/slack.py))**: Automatically posts structured Block Kit cards to Slack with alert summaries and solution commands.
6. **SMTP Email Notifier ([`email_service.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/services/email_service.py))**: Delivers rich HTML diagnostic post-mortems and threshold alerts directly to all registered users and configured on-call engineers.
7. **Fast API & Database ([`api/`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/api), [`database.py`](file:///home/f33/Documents/k8s-monitoring-tool/backend/app/core/database.py))**: Fast endpoints for the UI to fetch data, stores alert history in MongoDB, and manages user login/auth.

---

### 🖥️ What the Frontend Does (The "Cockpit & Visuals")
The frontend gives engineers a clean, interactive web dashboard so they don't have to struggle with terminal commands:
1. **Executive Dashboard ([`OverviewPage.tsx`](file:///home/f33/Documents/k8s-monitoring-tool/frontend/src/pages/OverviewPage.tsx))**: Shows at-a-glance cluster health, total pods, healthy vs. failing containers, and active alerts.
2. **Pods & Nodes Pages ([`PodsPage.tsx`](file:///home/f33/Documents/k8s-monitoring-tool/frontend/src/pages/PodsPage.tsx), [`NodesPage.tsx`](file:///home/f33/Documents/k8s-monitoring-tool/frontend/src/pages/NodesPage.tsx))**: Lists all running workloads with color-coded CPU and RAM usage bars ([`MetricBar.tsx`](file:///home/f33/Documents/k8s-monitoring-tool/frontend/src/components/dashboard/MetricBar.tsx)).
3. **AI Incident Center ([`AlertsPage.tsx`](file:///home/f33/Documents/k8s-monitoring-tool/frontend/src/pages/AlertsPage.tsx))**: Lists triggered alerts with special AI badges, plain-English root causes, and one-click copyable `kubectl` fix commands.
4. **In-Browser Terminal Logs ([`LogsPage.tsx`](file:///home/f33/Documents/k8s-monitoring-tool/frontend/src/pages/LogsPage.tsx), [`TerminalLogs.tsx`](file:///home/f33/Documents/k8s-monitoring-tool/frontend/src/components/dashboard/TerminalLogs.tsx))**: A dark terminal window right in the browser to stream real-time logs for any selected pod.
5. **Interactive Health Charts ([`PodChart.tsx`](file:///home/f33/Documents/k8s-monitoring-tool/frontend/src/components/dashboard/PodChart.tsx))**: Visual graphs to easily spot performance spikes over time.
6. **User Authentication & Navigation ([`LoginPage.tsx`](file:///home/f33/Documents/k8s-monitoring-tool/frontend/src/pages/LoginPage.tsx), [`Sidebar.tsx`](file:///home/f33/Documents/k8s-monitoring-tool/frontend/src/components/layout/Sidebar.tsx))**: Simple secure login page and sleek sidebar for easy navigation.

---

## 🏃 6. How to Run It (Quick Overview)

1. **Start Databases (MongoDB & Loki):**
   ```bash
   docker compose -f docker-compose.local.yml up -d mongodb loki
   ```
2. **Configure API Keys (`backend/.env`):**
   Add your `GROQ_API_KEY` and Slack Webhook URLs.
3. **Run Backend & Frontend:**
   ```bash
   npm run backend:dev    # Starts backend API on port 4000
   npm run frontend:dev   # Starts frontend dashboard on port 3000/5173
   ```

