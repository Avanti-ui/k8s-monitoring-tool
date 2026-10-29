# 🐍 K8s Monitoring Tool - Python (FastAPI) Backend

A high-performance async Python/FastAPI backend for the Kubernetes Observability & Monitoring Dashboard. Maintains 100% API contract and response shape compatibility with the React frontend.

---

## 🚀 Quickstart

### 1. Prerequisites
- Python 3.10+
- Running infrastructure (MongoDB `:27017`, Prometheus `:9090`, Loki `:3100`)

### 2. Setup Virtual Environment & Dependencies

**Linux / macOS:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Windows (PowerShell / Command Prompt):**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Start the FastAPI Server
```bash
# From workspace root (works across Windows, macOS, Linux):
npm run backend:dev

# Or directly from the backend directory:
# Linux/macOS:
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 4000 --reload

# Windows:
.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 4000 --reload
```
- **API Base URL**: `http://localhost:4000`
- **Interactive Swagger Docs**: `http://localhost:4000/docs`
- **ReDoc API Spec**: `http://localhost:4000/redoc`
- **Health Check**: `http://localhost:4000/health`

---

## ⚙️ Environment Variables (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP listening port |
| `HOST` | `0.0.0.0` | Bind address |
| `JWT_SECRET` | `ChangeMeInProduction` | Secret key for JWT auth tokens |
| `MONGO_URI` | `mongodb://localhost:27017/k8s-monitor` | MongoDB connection string |
| `PROMETHEUS_URL` | `http://localhost:9090` | Prometheus server URL |
| `LOKI_URL` | `http://localhost:3100` | Grafana Loki endpoint |
| `KUBECONFIG` | `None` (auto-detects `~/.kube/config`) | Colon-separated kubeconfig paths |
| `RULE_ENGINE_INTERVAL_MS` | `30000` | Alert evaluation loop interval |

---

## 📡 API Contract (100% Compatible with Frontend)

- `POST /api/auth/login` - Authenticate operator and return JWT.
- `POST /api/auth/signup` - Register a new operator account.
- `GET /api/metrics/summary` - Pod CPU %, RAM %, and restart counts.
- `GET /api/metrics/history` - 15-minute CPU/RAM metric time series.
- `GET /api/nodes` - Node readiness and hardware saturation stats.
- `GET /api/logs` - Container log lines from Loki.
- `GET /api/alerts` - Active and resolved alerts.
- `POST /api/alerts/{id}/acknowledge` - Acknowledge an alert incident.
- `GET /api/clusters` - Discovered multi-cluster contexts (EKS, AKS, GKE, Minikube).
- `POST /api/clusters/rescan` - Re-scan kubeconfigs on demand.
