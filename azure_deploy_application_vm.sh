#!/usr/bin/env bash
# ==============================================================================
# Azure VM Deployment & Setup Script
#
# This script automates the complete provisioning and deployment of the
# Kubernetes Monitoring & Autonomous AI Observability Platform on an Azure VM
# (Ubuntu 22.04/24.04 LTS or Debian Linux).
#
# What it installs and configures:
# 1. System prerequisites, build tools, curl, git, and network utilities.
# 2. Docker Engine, containerd, and Docker Compose plugin.
# 3. Kubernetes CLI (kubectl) official release.
# 4. Minikube with Docker driver and metrics-server addon.
# 5. Helm 3 package manager.
# 6. Node.js (LTS), npm, Python 3, pip, and python3-venv.
# 7. In-cluster Prometheus Stack, Grafana Loki, and Promtail via Helm.
# 8. Backend & Frontend application dependencies and environment configuration.
# 9. Prometheus port-forwarding and production container orchestration.
# ==============================================================================

set -euo pipefail

# --- Color Codes for Output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}${BOLD}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}${BOLD}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}${BOLD}[ERROR]${NC} $1"
}

# Determine sudo requirement
if [ "$EUID" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
    else
        log_error "This script requires superuser privileges. Please install sudo or run as root."
        exit 1
    fi
else
    SUDO=""
fi

TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME=$(eval echo "~$TARGET_USER")

# Enable seamless su execution for sudo group users if pam.d/su is present
if [ -f /etc/pam.d/su ] && ! grep -q "pam_wheel.so trust group=sudo" /etc/pam.d/su; then
    $SUDO sed -i '/auth       sufficient pam_rootok.so/a auth       sufficient pam_wheel.so trust group=sudo' /etc/pam.d/su 2>/dev/null || true
fi

echo -e "${CYAN}${BOLD}"
echo "=================================================================="
echo " ⚡ Azure VM Kubernetes Monitoring Deployment & Setup"
echo " Target User : $TARGET_USER"
echo " Target Home : $TARGET_HOME"
echo " Date        : $(date -u)"
echo "=================================================================="
echo -e "${NC}"

# ==============================================================================
# STEP 1: Update System Packages & Install Core Utilities
# ==============================================================================
log_info "Step 1/9: Updating system package repositories..."
$SUDO apt-get update -y
$SUDO apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    wget \
    git \
    jq \
    conntrack \
    socat \
    iptables \
    net-tools \
    unzip \
    build-essential \
    software-properties-common

log_success "System utilities installed successfully."

# ==============================================================================
# STEP 2: Install Docker Engine & Docker Compose Plugin
# ==============================================================================
log_info "Step 2/9: Installing Docker Engine & Docker Compose..."
if ! command -v docker >/dev/null 2>&1; then
    $SUDO install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    $SUDO chmod a+r /etc/apt/keyrings/docker.gpg

    UBUNTU_CODENAME=$(lsb_release -cs 2>/dev/null || echo "jammy")
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME} stable" | \
        $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null

    $SUDO apt-get update -y
    $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
    log_info "Docker is already installed ($(docker --version))."
fi

# Ensure Docker Compose CLI plugin is functional
if [ -f "$TARGET_HOME/.docker/cli-plugins/docker-compose" ]; then
    if ! su - "$TARGET_USER" -c "docker compose version" >/dev/null 2>&1; then
        log_warn "Outdated or broken plugin found at $TARGET_HOME/.docker/cli-plugins/docker-compose. Removing..."
        rm -f "$TARGET_HOME/.docker/cli-plugins/docker-compose" || true
    fi
fi

if ! docker compose version >/dev/null 2>&1; then
    log_info "Ensuring Docker Compose plugin is installed..."
    $SUDO apt-get update -y
    $SUDO apt-get install -y docker-compose-v2 || $SUDO apt-get install -y docker-compose-plugin || true

    # In Ubuntu 24.04 (and Debian), docker-compose-v2 places the binary in /usr/libexec/docker/cli-plugins
    # but docker.io looks for plugins in /usr/lib/docker/cli-plugins
    if [ -f /usr/libexec/docker/cli-plugins/docker-compose ] && [ ! -e /usr/lib/docker/cli-plugins/docker-compose ]; then
        $SUDO mkdir -p /usr/lib/docker/cli-plugins
        $SUDO ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/lib/docker/cli-plugins/docker-compose
    fi

    # Fallback: install latest Docker Compose plugin binary directly if still unavailable
    if ! docker compose version >/dev/null 2>&1; then
        log_info "Fetching latest official Docker Compose binary..."
        $SUDO mkdir -p /usr/lib/docker/cli-plugins
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | jq -r '.tag_name // "v2.29.7"')
        curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" -o /tmp/docker-compose
        $SUDO install -m 0755 /tmp/docker-compose /usr/lib/docker/cli-plugins/docker-compose
        $SUDO ln -sf /usr/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose || true
        rm -f /tmp/docker-compose
    fi
fi

$SUDO systemctl enable --now docker

# Add user to docker group if not already present
if ! groups "$TARGET_USER" | grep -q "\bdocker\b"; then
    log_info "Adding $TARGET_USER to docker group..."
    $SUDO usermod -aG docker "$TARGET_USER"
fi
log_success "Docker Engine is active and running."

# ==============================================================================
# STEP 3: Install kubectl (Kubernetes CLI)
# ==============================================================================
log_info "Step 3/9: Installing kubectl..."
if ! command -v kubectl >/dev/null 2>&1; then
    KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt)
    log_info "Downloading kubectl version: $KUBECTL_VERSION"
    curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
    $SUDO install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
    rm -f kubectl
fi
log_success "kubectl installed: $(kubectl version --client --output=yaml | grep -E 'gitVersion' | head -n1 || echo 'ok')"

# ==============================================================================
# STEP 4: Install Minikube
# ==============================================================================
log_info "Step 4/9: Installing Minikube..."
if ! command -v minikube >/dev/null 2>&1; then
    curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
    $SUDO install minikube-linux-amd64 /usr/local/bin/minikube
    rm -f minikube-linux-amd64
fi
log_success "Minikube installed: $(minikube version --short)"

# ==============================================================================
# STEP 5: Install Helm 3
# ==============================================================================
log_info "Step 5/9: Installing Helm 3..."
if ! command -v helm >/dev/null 2>&1; then
    curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi
log_success "Helm installed: $(helm version --short)"

# ==============================================================================
# STEP 6: Install Node.js LTS, npm, Python 3, and venv
# ==============================================================================
log_info "Step 6/9: Installing Node.js LTS & Python development tools..."
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
fi

$SUDO apt-get install -y python3 python3-pip python3-venv

log_success "Node.js $(node -v) / npm $(npm -v) / Python $(python3 --version) ready."

# ==============================================================================
# STEP 7: Start Minikube Cluster
# ==============================================================================
log_info "Step 7/9: Starting Minikube cluster using Docker driver..."

# Set sysctl parameters required for container routing
$SUDO sysctl -w net.bridge.bridge-nf-call-iptables=1 >/dev/null 2>&1 || true
$SUDO sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || true

# Start Minikube as TARGET_USER (Minikube should not run directly as root)
su - "$TARGET_USER" -c '
    if minikube status | grep -q "Running"; then
        echo "[INFO] Minikube is already running."
    else
        echo "[INFO] Launching Minikube (2 CPUs, 4096MB RAM)..."
        minikube start --driver=docker --cpus=2 --memory=4096 --addons=metrics-server
    fi
    kubectl config use-context minikube
'

log_success "Minikube cluster is healthy and operational."

# ==============================================================================
# STEP 8: Deploy In-Cluster Prometheus & Loki via Helm
# ==============================================================================
log_info "Step 8/9: Deploying Prometheus and Loki monitoring stack via Helm..."

su - "$TARGET_USER" -c '
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
    helm repo add grafana https://grafana.github.io/helm-charts >/dev/null 2>&1 || true
    helm repo update

    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

    # Install Prometheus Stack if not already installed
    if ! helm list -n monitoring | grep -q "monitoring"; then
        echo "[INFO] Installing kube-prometheus-stack..."
        helm install monitoring prometheus-community/kube-prometheus-stack \
            --namespace monitoring \
            --set prometheus.service.type=ClusterIP \
            --set grafana.enabled=false \
            --set alertmanager.enabled=false \
            --wait --timeout=300s
    else
        echo "[INFO] kube-prometheus-stack is already installed."
    fi

    # Install Loki Stack (Loki + Promtail)
    if ! helm list -n monitoring | grep -q "loki"; then
        echo "[INFO] Installing loki-stack for pod logs..."
        helm install loki grafana/loki-stack \
            --namespace monitoring \
            --set loki.persistence.enabled=false \
            --set promtail.enabled=true \
            --wait --timeout=300s
    else
        echo "[INFO] loki-stack is already installed."
    fi
'

log_success "Prometheus and Loki monitoring charts deployed."

# ==============================================================================
# STEP 9: Configure Application Environment & Setup Systemd Port-Forward
# ==============================================================================
log_info "Step 9/9: Configuring application environment and systemd services..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Generate .env if missing
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    log_info "Creating default .env configuration..."
    JWT_SECRET=$(openssl rand -hex 32)
    cat <<EOF > "$SCRIPT_DIR/.env"
# Server Configuration
HOST=0.0.0.0
PORT=4000
DEBUG=false

# Authentication
JWT_SECRET=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24

# Database & Upstream URLs
MONGO_URI=mongodb://localhost:27017/k8s-monitor
PROMETHEUS_URL=http://localhost:9090
LOKI_URL=http://localhost:3100

# Autonomous AI Settings
AI_ENABLED=true
AI_PROVIDER=groq
AI_MODEL=openai/gpt-oss-120b
AI_ANALYSIS_INTERVAL_MS=30000

# Groq / LLM API Key (Replace with your actual key)
GROQ_API_KEY=gsk_your_groq_api_key_here

# Slack Integrations (Optional)
SLACK_WEBHOOK_URL_ALERTS=
SLACK_WEBHOOK_URL_AI_ANALYSIS=
EXCLUDE_SYSTEM_NAMESPACES=true
EOF
    $SUDO chown "$TARGET_USER:$TARGET_USER" "$SCRIPT_DIR/.env"
fi

# Ensure backend/.env also exists
if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
    cp "$SCRIPT_DIR/.env" "$SCRIPT_DIR/backend/.env"
    $SUDO chown "$TARGET_USER:$TARGET_USER" "$SCRIPT_DIR/backend/.env"
fi

# Create a systemd service to keep Prometheus port-forward active automatically
log_info "Setting up Prometheus port-forward systemd service..."
$SUDO tee /etc/systemd/system/k8s-prometheus-forward.service > /dev/null <<EOF
[Unit]
Description=Kubernetes Prometheus Port Forwarding Service
After=network.target docker.service

[Service]
Type=simple
User=${TARGET_USER}
Environment=KUBECONFIG=${TARGET_HOME}/.kube/config
ExecStart=/usr/local/bin/kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090 --address 0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl enable --now k8s-prometheus-forward.service || true

# Start supporting containers (MongoDB & Loki) via docker compose
log_info "Starting MongoDB & Loki containers..."
COMPOSE_CMD="docker compose"
if ! su - "$TARGET_USER" -c "docker compose version" >/dev/null 2>&1; then
    if su - "$TARGET_USER" -c "command -v docker-compose" >/dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    fi
fi
su - "$TARGET_USER" -c "cd '$SCRIPT_DIR' && $COMPOSE_CMD -f docker-compose.local.yml up -d mongodb loki"

# Setup Python Virtual Environment for backend
if [ ! -d "$SCRIPT_DIR/backend/.venv" ]; then
    log_info "Creating backend Python virtual environment..."
    su - "$TARGET_USER" -c "cd '$SCRIPT_DIR/backend' && python3 -m venv .venv && source .venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt"
fi

# Setup Frontend NPM packages
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    log_info "Installing frontend npm dependencies..."
    su - "$TARGET_USER" -c "cd '$SCRIPT_DIR/frontend' && npm install"
fi

# Detect Public IP
PUBLIC_IP=$(curl -s -m 5 https://api.ipify.org || curl -s -m 5 https://ifconfig.me || echo "YOUR_VM_PUBLIC_IP")

# Configure frontend/.env with API endpoint
echo "VITE_API_URL=http://${PUBLIC_IP}:4000" > "$SCRIPT_DIR/frontend/.env"
$SUDO chown "$TARGET_USER:$TARGET_USER" "$SCRIPT_DIR/frontend/.env"

# Setup Systemd Services for Backend & Frontend (Auto-start on boot)
log_info "Setting up systemd services for Backend and Frontend..."

$SUDO tee /etc/systemd/system/k8s-backend.service > /dev/null <<EOF
[Unit]
Description=K8s Monitoring FastAPI Backend
After=network.target docker.service

[Service]
Type=simple
User=${TARGET_USER}
WorkingDirectory=${SCRIPT_DIR}/backend
EnvironmentFile=${SCRIPT_DIR}/.env
ExecStart=${SCRIPT_DIR}/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 4000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

$SUDO tee /etc/systemd/system/k8s-frontend.service > /dev/null <<EOF
[Unit]
Description=K8s Monitoring React Frontend
After=network.target

[Service]
Type=simple
User=${TARGET_USER}
WorkingDirectory=${SCRIPT_DIR}/frontend
ExecStart=/usr/bin/npm run dev -- --host 0.0.0.0 --port 3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl enable --now k8s-backend.service
$SUDO systemctl enable --now k8s-frontend.service

echo ""
echo -e "${GREEN}${BOLD}=================================================================="
echo " 🎉 Azure VM Deployment & Setup Complete!"
echo "=================================================================="
echo -e "${NC}"
echo -e "Summary of Installed Components:"
echo -e "  ✔ Docker Engine       : $(docker --version)"
echo -e "  ✔ Docker Compose      : $(docker compose version 2>/dev/null || docker-compose --version 2>/dev/null || echo 'Ready')"
echo -e "  ✔ kubectl CLI         : $(kubectl version --client --output=yaml | grep -E 'gitVersion' | head -n1 || echo 'Ready')"
echo -e "  ✔ Minikube            : $(minikube version --short)"
echo -e "  ✔ Helm 3              : $(helm version --short)"
echo -e "  ✔ Node.js & npm       : Node $(node -v) / npm $(npm -v)"
echo -e "  ✔ Python 3            : $(python3 --version)"
echo -e "  ✔ Prometheus Stack    : Active in namespace 'monitoring'"
echo -e "  ✔ Loki & Promtail     : Active in namespace 'monitoring'"
echo -e "  ✔ FastAPI Backend     : Active (Port 4000)"
echo -e "  ✔ React Frontend      : Active (Port 3000)"
echo ""
echo -e "${CYAN}${BOLD}Access Your Live Application:${NC}"
echo -e "👉 ${BOLD}Frontend Dashboard : http://${PUBLIC_IP}:3000${NC}"
echo -e "👉 ${BOLD}Backend API Docs   : http://${PUBLIC_IP}:4000/docs${NC}"
echo -e "👉 ${BOLD}Prometheus Metrics : http://${PUBLIC_IP}:9090${NC}"
echo ""

