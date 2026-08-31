<div align="center">

# ⚡ Kubernetes Monitoring & Autonomous AI Observability Platform

**A unified, real-time Kubernetes observability, multi-cluster incident response, and Groq-powered Autonomous SRE diagnostic platform.**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%2F%20Python%203.10+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%20%2F%20TypeScript%20%2F%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes%20(EKS%20%2F%20AKS%20%2F%20GKE%20%2F%20Minikube)-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)](https://kubernetes.io)
[![Groq AI](https://img.shields.io/badge/AI%20Engine-Groq%20%2F%20Llama%203.1%20%2F%20GPT--OSS--120B-f55036?style=for-the-badge&logo=openai&logoColor=white)](https://groq.com)
[![Slack](https://img.shields.io/badge/ChatOps-Slack%20Block%20Kit-4A154B?style=for-the-badge&logo=slack&logoColor=white)](https://slack.com)
[![Prometheus](https://img.shields.io/badge/Telemetry-Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)](https://prometheus.io)
[![Grafana Loki](https://img.shields.io/badge/Logs-Grafana%20Loki%20%2F%20Promtail-F46800?style=for-the-badge&logo=grafana&logoColor=white)](https://grafana.com/oss/loki/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge)](LICENSE)

</div>

---

## 📑 Table of Contents
1. [Overview & Core Capabilities](#-overview--core-capabilities)
2. [Next-Gen AI & Dual-Slack Architecture](#-next-gen-ai--dual-slack-architecture)
3. [System Architecture & Data Flow](#-system-architecture--data-flow)
4. [Tech Stack](#-tech-stack)
5. [Quick Start & Setup Guide](#-quick-start--setup-guide)
   - [Step 1: Start Infrastructure (MongoDB & Loki)](#step-1-start-infrastructure)
   - [Step 2: Connect Minikube Prometheus](#step-2-connect-minikube-prometheus)
   - [Step 3: Configure Environment (.env)](#step-3-configure-environment)
   - [Step 4: Start Backend & Frontend](#step-4-start-backend--frontend)
6. [Live Chaos Demo App (/payment, /orders, /crash)](#-live-chaos-demo-app)
7. [API Specification & Endpoints](#-api-specification--endpoints)
8. [Configuration Reference](#-configuration-reference)

---

## 🌟 Overview & Core Capabilities

The **Kubernetes Monitoring & Autonomous AI Observability Platform** bridges the gap between raw cluster metrics and actionable incident remediation. Instead of just firing ambiguous threshold alarms, the system correlates metrics with error logs and uses high-speed **Groq LLMs** to diagnose root causes and recommend exact `kubectl` fix commands.

### Key Capabilities:
- **🤖 Autonomous SRE Anomaly Engine**: Background evaluation using Groq LLMs (`openai/gpt-oss-120b`, `llama-3.1-8b-instant`). Detects slow memory leaks, thread deadlocks, GC overhead pauses, and API timeouts before pods crash.
- **💬 Dual-Channel Slack Integration**:
  - **Threshold Alerts (`SLACK_WEBHOOK_URL_ALERTS`)**: Instant operational alerts (`🚨 CPU > 85%`, `CrashLoopBackOff`).
  - **AI Diagnostic Insights (`SLACK_WEBHOOK_URL_AI_ANALYSIS`)**: Structured Slack Block Kit cards with Summary, Likely Root Cause, and Executable Remediation Steps.
- **⚡ Sub-Second Pod Telemetry**: Continuous Prometheus metric scraping across workloads. Displays real-time CPU % and RAM % utilization with dynamic sparklines.
- **📜 Distributed Loki Pod Log Streaming**: Direct integration with Grafana Loki and in-cluster Promtail daemonsets for real-time log debugging.
- **🌐 Multi-Cluster Auto-Discovery**: Automatically parses `$KUBECONFIG`, `~/.kube/config`, and `~/.kube/*.yaml` to auto-detect **AWS EKS**, **Azure AKS**, **GCP GKE**, and **Minikube**.
- **🎯 Smart Namespace Filtering**: Filters out noisy internal Kubernetes system pods (`kube-system`, `monitoring`) so Slack notifications stay 100% focused on your applications.

---

## 🤖 Next-Gen AI & Dual-Slack Architecture

```
                 Kubernetes Cluster (Prometheus Metrics & Loki Logs)
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                           ▼
       ┌────────────────────────┐                  ┌────────────────────────┐
       │ Threshold Rule Engine  │                  │    AI Anomaly Engine   │
       │ (Evaluates every 30s)  │                  │ (Groq LLM / Every 30s) │
       └───────────┬────────────┘                  └───────────┬────────────┘
                   │                                           │
                   ▼                                           ▼
         [Hard Metric Breaches]                      [Root Cause & Fix Plans]
                   │                                           │
                   ▼                                           ▼
      Slack: #k8s-alerts Webhook                  Slack: #k8s-ai-insights Webhook
```

---

## 🏗️ System Architecture & Data Flow

```
backend/app/
├── config.py                    ← Pydantic Settings (AI provider, Slack webhooks, DB)
├── main.py                      ← FastAPI app, CORS, Lifespan (Starts Rule & AI engines)
│
├── services/
│   ├── ai/                      ← Multi-Provider AI Abstraction
│   │   ├── base.py              ← Base SRE System Prompt, Payload Models, JSON Cleaners
│   │   ├── groq_provider.py     ← Groq LLM API Client (GPT-OSS-120B / Llama 3.1)
│   │   ├── openai_provider.py   ← OpenAI Provider (GPT-4o / GPT-4o-mini)
│   │   ├── anthropic_provider.py← Anthropic Claude Provider
│   │   └── azure_provider.py    ← Azure OpenAI Deployments
│   │
│   ├── ai_engine.py             ← Background AI Evaluation Loop (MongoDB + Slack Sync)
│   ├── rule_engine.py           ← Background Threshold Rule Loop (CPU, RAM, Restarts)
│   ├── slack.py                 ← Dual Slack Webhook Dispatcher (Block Kit Formatter)
│   ├── prometheus.py            ← Prometheus Async HTTP Client
│   ├── loki.py                  ← Loki Async Log Query Client
│   └── cluster_discovery.py     ← Multi-Cluster Kubeconfig Scanner
│
├── api/
│   ├── alerts.py                ← GET /api/alerts (Includes AI Root Cause & Fix fields)
│   ├── config.py                ← GET /api/config (Exposes AI Status to UI)
│   ├── metrics.py               ← GET /api/metrics/summary, /api/metrics/history
│   ├── logs.py                  ← GET /api/logs?pod=<name>
│   └── clusters.py              ← GET /api/clusters, POST /api/clusters/rescan
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Cyber-aesthetic dark theme operator dashboard |
| **Backend** | FastAPI (Python 3.10+) + Uvicorn | Async ASGI backend and AI evaluation engine |
| **AI / LLMs** | Groq API (`openai/gpt-oss-120b`, `llama-3.1-8b-instant`) | Autonomous root-cause analysis and remediation generator |
| **ChatOps** | Slack Webhooks (Block Kit) | Real-time incident notifications and AI insight streaming |
| **Metrics** | Prometheus Operator | 15s pod and node telemetry scraping |
| **Logs** | Grafana Loki & Promtail | Centralized pod log aggregation and querying |
| **Database** | MongoDB (Motor Async) | Alert persistence, user authentication, and audit logs |

---

## 🚀 Quick Start & Setup Guide

### Step 1: Start Infrastructure
Start the supporting MongoDB and Loki containers:
```bash
docker compose -f docker-compose.local.yml up -d mongodb loki
```

### Step 2: Connect Minikube Prometheus
Forward Prometheus from your Minikube cluster:
```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090 &
```

### Step 3: Configure Environment
Create `backend/.env` (or copy from `backend/.env.example`):
```env
# AI Anomaly Detection Settings
AI_ENABLED=true
AI_PROVIDER=groq
AI_MODEL=openai/gpt-oss-120b
AI_ANALYSIS_INTERVAL_MS=30000

# Groq API Key
GROQ_API_KEY=gsk_your_groq_api_key_here

# Slack Webhook Integrations
SLACK_WEBHOOK_URL_ALERTS=https://hooks.slack.com/services/YOUR/ALERT/WEBHOOK
SLACK_WEBHOOK_URL_AI_ANALYSIS=https://hooks.slack.com/services/YOUR/AI/WEBHOOK
```

### Step 4: Start Backend & Frontend

**Terminal 1 (Backend):**
```bash
# From workspace root (Windows / macOS / Linux):
npm run backend:dev

# Or from backend directory:
# Linux/macOS:
cd backend && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 4000 --reload
# Windows:
cd backend && .venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 4000 --reload
```

**Terminal 2 (Frontend):**
```bash
# From workspace root:
npm run frontend:dev

# Or from frontend directory:
cd frontend
npm run dev
```

Dashboard is live at **`http://localhost:3000`** (or `http://localhost:5173`)!

---

## 🧪 Live Chaos Demo App

A standalone Node.js microservice is included in `../k8s-demo-app` for presentations and testing.

### 1. Deploy the Demo App:
```bash
cd ../k8s-demo-app
./run-demo.sh
```

### 2. Forward Port & Trigger Scenarios:
```bash
kubectl port-forward svc/ecommerce-service 8080:8080
```

| Action | Endpoint | Result |
|---|---|---|
| **Healthy Order** | `curl http://localhost:8080/orders` | Returns 200 OK (<20ms latency). |
| **Memory Leak & 504** | `curl http://localhost:8080/payment` | Retains 15MB heap + emits timeouts. **Groq AI diagnoses leak and posts fix to Slack.** |
| **High CPU Burn** | `curl http://localhost:8080/cpu-stress` | Spikes CPU > 85%. **Rule Engine triggers `🚨 [HIGH CPU]` alert in Slack.** |
| **Fatal Pod Crash** | `curl http://localhost:8080/crash` | Terminates with code 1. **Rule Engine triggers `🚨 [CRASH LOOP]` alert in Slack.** |

---

## 📋 Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `AI_ENABLED` | `true` | Enables or disables background AI analysis |
| `AI_PROVIDER` | `groq` | Supported: `groq`, `openai`, `anthropic`, `azure` |
| `AI_MODEL` | `openai/gpt-oss-120b` | Model identifier on the selected provider |
| `AI_ANALYSIS_INTERVAL_MS`| `30000` | Frequency of AI evaluation loop (milliseconds) |
| `SLACK_WEBHOOK_URL_ALERTS` | `None` | Webhook for immediate threshold rule alerts |
| `SLACK_WEBHOOK_URL_AI_ANALYSIS` | `None` | Webhook for Groq AI incident diagnostic insights |
| `EXCLUDE_SYSTEM_NAMESPACES`| `true` | Filters out `kube-system` and `monitoring` pods from Slack |

---

## 📄 License
This project is licensed under the Apache 2.0 License.
