# 🖥️ Complete VM Setup & Deployment Guide
### How to Run the Kubernetes Monitoring & Observability Tool on Linux Virtual Machines (AWS EC2, Azure VM, GCP Compute Engine, or Bare-Metal Linux)

---

## 📑 Table of Contents
1. [VM Sizing & Security Group / Firewall Rules](#1-vm-sizing--security-group--firewall-rules)
2. [Method 1 (Recommended): Production Docker Compose on VM](#2-method-1-recommended-production-docker-compose-on-vm)
3. [Method 2: Lightweight Kubernetes on VM (K3s Cluster)](#3-method-2-lightweight-kubernetes-on-vm-k3s-cluster)
4. [Method 3: Native Systemd Services (No App Containers)](#4-method-3-native-systemd-services-no-app-containers)
5. [Connecting VM Backend to Remote Kubernetes Clusters](#5-connecting-vm-backend-to-remote-kubernetes-clusters)
6. [Configuring Free SSL/HTTPS with Let's Encrypt (Certbot)](#6-configuring-free-sslhttps-with-lets-encrypt-certbot)
7. [Auto-Start on VM Reboot](#7-auto-start-on-vm-reboot)
8. [Troubleshooting & Diagnostics](#8-troubleshooting--diagnostics)

---

## 1. VM Sizing & Security Group / Firewall Rules

### Recommended VM Hardware Specs:
- **OS**: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS, Debian 12, or RHEL 9 / Rocky Linux 9
- **CPU**: 2 vCPUs minimum (4 vCPUs recommended if running in-VM K3s/Prometheus)
- **RAM**: 4 GB RAM minimum (8 GB recommended)
- **Disk**: 30+ GB SSD (for metrics, log persistence, and Docker images)
- **Cloud Instance Types**:
  - **AWS EC2**: `t3.medium` or `t3.large`
  - **Azure VM**: `Standard_B2s` or `Standard_D2s_v5`
  - **GCP Compute**: `e2-medium` or `e2-standard-2`

### Security Group / Firewall Ports (Inbound):
Open these ports in AWS Security Group / Azure Network Security Group (NSG) / GCP Firewall / UFW:

| Port | Protocol | Source | Purpose |
| :--- | :--- | :--- | :--- |
| **22** | TCP | Your Admin IP | SSH Access |
| **80** | TCP | `0.0.0.0/0` (Anywhere) | HTTP Dashboard Web Traffic & Let's Encrypt |
| **443** | TCP | `0.0.0.0/0` (Anywhere) | HTTPS Dashboard Web Traffic |
| **6443** | TCP | Private VPC / Your IP | *(Optional)* K3s Kubernetes API Server (Method 2 only) |

> ⚠️ **Security Note**: Never expose internal ports `27017` (MongoDB), `9090` (Prometheus), `3100` (Loki), or `4000` (Backend direct) to the public internet (`0.0.0.0/0`). They are secured behind NGINX or internal Docker networks.

---

## 2. Method 1 (Recommended): Production Docker Compose on VM

This is the fastest, cleanest, and most reliable way to run the entire monitoring stack on a single Linux VM.

### Step 1: Install Docker & Docker Compose on the VM
SSH into your VM and run:

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker using the official automated script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your current user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker and Docker Compose
docker --version
docker compose version
```

### Step 2: Clone Repository & Configure Environment
```bash
# Clone the repository onto your VM
git clone <YOUR_REPOSITORY_URL> k8s-monitoring-tool
cd k8s-monitoring-tool

# Create the environment file
cat <<EOF > .env
JWT_SECRET=$(openssl rand -hex 32)
AI_ENABLED=true
AI_PROVIDER=groq
AI_MODEL=llama-3.3-70b-versatile

# AI Provider Keys (fill the one you use)
GROQ_API_KEY=gsk_your_groq_api_key_here
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Slack Webhook Integrations (optional)
SLACK_WEBHOOK_URL_ALERTS=
SLACK_WEBHOOK_URL_AI_ANALYSIS=
EOF
```

### Step 3: Start All Services via Production Compose
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 4: Verify Container Health
```bash
docker compose -f docker-compose.prod.yml ps
```

You should see 5 running containers:
- `k8s-monitor-frontend` (Port 80 -> UI + reverse proxy to backend)
- `k8s-monitor-backend` (FastAPI backend + AI root-cause engine)
- `k8s-monitor-mongo` (Database storage)
- `k8s-monitor-prometheus` (Metrics storage)
- `k8s-monitor-loki` (Log aggregation)

### Step 5: Access the Web Dashboard
Open your VM's public IP address in your browser:
👉 **`http://<YOUR_VM_PUBLIC_IP>`**

---

## 3. Method 2: Lightweight Kubernetes on VM (K3s Cluster)

Use this method if you want a real Kubernetes cluster running directly inside your VM to test pod deployments, crash-loop alerts, and auto-discovery.

### Step 1: Install K3s (Lightweight Kubernetes)
```bash
# Install K3s without default Traefik (so port 80 is clean)
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable=traefik" sh -

# Give your user permissions to access kubectl
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown -R $USER:$USER ~/.kube
export KUBECONFIG=~/.kube/config

# Verify node is ready
kubectl get nodes
```

### Step 2: Install Helm
```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Step 3: Install Prometheus, Loki & Promtail via Helm
```bash
kubectl create namespace monitoring

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Prometheus Operator
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.service.type=ClusterIP \
  --set alertmanager.enabled=false \
  --set grafana.enabled=false

# Install Loki (Log aggregation)
helm install loki grafana/loki \
  --namespace monitoring \
  --set "persistence.enabled=true,persistence.size=10Gi"

# Install Promtail (DaemonSet shipping all pod logs to Loki)
helm install promtail grafana/promtail \
  --namespace monitoring \
  --set "config.clients[0].url=http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push"
```

### Step 4: Build Images with K3s Containerd
```bash
# Build images using Docker and import into K3s containerd
docker build -t k8s-monitor-backend:latest ./backend
docker build -t k8s-monitor-frontend:latest ./frontend

docker save k8s-monitor-backend:latest | sudo k3s ctr images import -
docker save k8s-monitor-frontend:latest | sudo k3s ctr images import -
```

### Step 5: Deploy Application Manifests
```bash
# Edit imagePullPolicy in k8s/app-deployment.yaml to IfNotPresent
sed -i 's|YOUR_REGISTRY/||g' k8s/app-deployment.yaml
sed -i 's|imagePullPolicy: Always|imagePullPolicy: IfNotPresent|g' k8s/app-deployment.yaml

# Apply the manifest
kubectl apply -f k8s/app-deployment.yaml

# Check pods
kubectl get pods -n monitoring
```

Open `http://<YOUR_VM_PUBLIC_IP>` to access the dashboard.

---

## 4. Method 3: Native Systemd Services (No App Containers)

If you prefer running FastAPI backend and NGINX directly on the host VM:

### Step 1: Install Python 3.11+, Node.js & NGINX
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv nginx git curl

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Start Supporting Infrastructure (MongoDB, Prometheus, Loki)
```bash
npm run infra:up
```

### Step 3: Setup & Run Backend Service with Systemd
```bash
cd /home/ubuntu/k8s-monitoring-tool/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Create Systemd Service for Backend
sudo tee /etc/systemd/system/k8s-monitor-backend.service > /dev/null <<EOF
[Unit]
Description=K8s Monitor FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/k8s-monitoring-tool/backend
ExecStart=/home/ubuntu/k8s-monitoring-tool/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 4000
Restart=always
RestartSec=5
EnvironmentFile=/home/ubuntu/k8s-monitoring-tool/backend/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now k8s-monitor-backend
```

### Step 4: Build Frontend & Configure NGINX
```bash
# Build React Frontend
cd /home/ubuntu/k8s-monitoring-tool/frontend
npm install
npm run build

# Configure NGINX Site
sudo tee /etc/nginx/sites-available/k8s-monitor > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    root /home/ubuntu/k8s-monitoring-tool/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:4000/health;
    }
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/k8s-monitor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

---

## 5. Connecting VM Backend to Remote Kubernetes Clusters

If your VM is monitoring remote Kubernetes clusters (e.g. Amazon EKS, Azure AKS, or on-prem clusters):

1. Place your target cluster's `kubeconfig` on the VM at `~/.kube/config`.
2. Ensure the remote cluster's API endpoint is reachable from the VM.
3. In Docker Compose (`docker-compose.prod.yml`), `~/.kube` is already mounted into the backend container at `/root/.kube:ro`.
4. Navigate to the **Clusters** tab in the dashboard and click **Rescan Clusters** — the backend will automatically discover the remote cluster.

---

## 6. Configuring Free SSL/HTTPS with Let's Encrypt (Certbot)

To secure your VM dashboard with a domain name and HTTPS certificate:

```bash
# 1. Install Certbot and NGINX plugin
sudo apt-get install -y certbot python3-certbot-nginx

# 2. Obtain SSL Certificate (replace with your domain)
sudo certbot --nginx -d monitor.yourdomain.com

# 3. Certbot automatically configures auto-renewal!
sudo certbot renew --dry-run
```

---

## 7. Auto-Start on VM Reboot

If using **Method 1 (Docker Compose)**, Docker containers with `restart: unless-stopped` will automatically start when the VM boots up.

To ensure the Docker daemon starts on boot:
```bash
sudo systemctl enable docker
sudo systemctl enable containerd
```

---

## 8. Troubleshooting & Diagnostics

### View Live Logs:
```bash
# Method 1 (Docker Compose)
docker compose -f docker-compose.prod.yml logs -f --tail=100 backend
docker compose -f docker-compose.prod.yml logs -f --tail=100 frontend

# Method 3 (Systemd)
journalctl -u k8s-monitor-backend -f
sudo tail -f /var/log/nginx/error.log
```

### Free Busy Ports:
```bash
sudo fuser -k 80/tcp 443/tcp 4000/tcp 9090/tcp 3100/tcp 27017/tcp 2>/dev/null || true
```

### Stop All Containers:
```bash
docker compose -f docker-compose.prod.yml down
```
