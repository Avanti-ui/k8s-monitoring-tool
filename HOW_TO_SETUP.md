# 🚀 Complete Project Setup & Testing Guide

This guide walks you through setting up and testing the **Kubernetes Monitoring & Observability Tool** from scratch.

---

## 📑 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Option A: Quick Local Setup (Docker Compose Only)](#2-option-a-quick-local-setup-docker-compose-only)
3. [Option B: Real Kubernetes Setup (Minikube + Prometheus + Promtail)](#3-option-b-real-kubernetes-setup-minikube--prometheus--promtail)
4. [Using the Web Dashboard](#4-using-the-web-dashboard)
5. [Automated API Testing](#5-automated-api-testing)
6. [Stopping All Services](#6-stopping-all-services)

---

## 1. Prerequisites

Make sure you have the following installed on your machine:
- **Node.js** (v18+ recommended) & **npm**
- **Python** 3.10+ & **pip**
- **Docker** & **Docker Compose**
- *(For K8s testing)*: **Minikube**, **kubectl**, and **Helm**

---

## 2. Option A: Quick Local Setup (Docker Compose Only)

Use this mode if you do not want to run a local Kubernetes cluster and just want to test the full stack with standalone Prometheus & Loki containers.

### Step 1: Start Infrastructure Containers
```bash
npm run infra:up
```
*(Starts MongoDB on `:27017`, Prometheus on `:9090`, and Loki on `:3100`)*

### Step 2: Install Backend Dependencies (First-time setup)
**Linux / macOS:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

**Windows (PowerShell / Command Prompt):**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### Step 3: Start Backend Server
In your first terminal:
```bash
npm run backend:dev
```
- Cross-platform: Automatically detects `.venv` on Windows, Linux, and macOS.
- Listens on `http://localhost:4000`.
- Connects to MongoDB, Prometheus, and Loki.
- Runs the continuous alert rule engine.

### Step 4: Start Frontend UI
In a second terminal:
```bash
npm run frontend:dev
```
- Dashboard opens at `http://localhost:3000`.

---

## 3. Option B: Real Kubernetes Setup (Minikube + Prometheus + Promtail)

Use this mode to monitor real pods running inside a local Kubernetes cluster.

### Step 1: Start Minikube & Install Monitoring Stack
```bash
# 1. Start Minikube
minikube start --cpus=4 --memory=8192 --driver=docker

# 2. Add Helm repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# 3. Install Prometheus Operator & Kube-State-Metrics
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace

# 4. Install Promtail to stream live pod logs to Loki
helm install promtail grafana/promtail \
  --namespace monitoring \
  --set "config.clients[0].url=http://192.168.49.1:3100/loki/api/v1/push"

# 5. How to see pods
kubectl get pods -n monitoring 

# 6. How to check logs
kubectl logs -f -n monitoring <pod-name>
```

### Step 2: Start Local Supporting Infrastructure
Start MongoDB and Loki (and stop the standalone Prometheus container so port 9090 is available for K8s):
```bash
npm run infra:up
docker stop k8s-monitor-prometheus
```

### Step 3: Forward Minikube Prometheus to Port 9090
In a dedicated terminal, run:
```bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
```

### Step 4: Deploy Sample Pods to Monitor
```bash
# A healthy demo pod
kubectl run k8s-demo-app --image=nginx:alpine --port=80

# A pod that crash-loops to trigger alerts
kubectl run crash-test-pod --image=busybox --restart=Always -- /bin/sh -c "sleep 5; exit 1"
```

### Step 5: Start the Backend and Frontend
In two separate terminals:

**Terminal 1 (Backend):**
```bash
npm run backend:dev
```

**Terminal 2 (Frontend):**
```bash
npm run frontend:dev
```

---

## 4. Using the Web Dashboard

1. Navigate to **`http://localhost:3000`**.
2. **Register a User Account**:
   - Go to the **Register** tab.
   - Enter your email and password.
   - Read & accept the **Terms & Conditions**.
   - Click **Create Account**.
3. **Explore Dashboard Features**:
   - **Overview / Metrics:** Live CPU & memory utilization, cluster health summary.
   - **Nodes:** Node status (`Ready`/`NotReady`), CPU & RAM stats.
   - **Pods:** Pod telemetry and restart counters.
   - **Logs:** Live container logs streamed from Loki via Promtail (select pod & click **Fetch**).
   - **Alerts:** Real-time triggered alerts for pod restarts and failures.

---

## 5. Automated API Testing

You can run automated tests against the backend API while the backend is running:

```bash
# Run the automated seed and test suite
npm run backend:test
```

Or test endpoints directly via cURL:
```bash
# 1. Health check
curl -s http://localhost:4000/health

# 2. Login to obtain JWT
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@local.dev","password":"yourpassword"}' | jq -r .token)

# 3. Query metrics, nodes, and alerts
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/metrics/summary
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/nodes
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/alerts
```

---

## 6. Stopping All Services

When you are done testing, run:

```bash
# 1. Stop background dev servers and port-forwards
fuser -k 3000/tcp 4000/tcp 9090/tcp 3100/tcp 27017/tcp 2>/dev/null || true

# 2. Stop Docker Compose containers
npm run infra:down

# 3. (Optional) Stop Minikube cluster
minikube stop
```
