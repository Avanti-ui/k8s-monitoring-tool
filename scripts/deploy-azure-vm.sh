#!/usr/bin/env bash
# ==============================================================================
#  Kubernetes Monitoring & Observability Tool - Azure VM Deployment Script
#  Target Environment: Azure VM (Recommended: Standard_D4s_v5 or Standard_B4ms)
#  Specs: 4 vCPUs, 16 GB RAM, Ubuntu 22.04 LTS / 24.04 LTS or Debian 12
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Colors & Output Helpers
# ------------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}${BOLD}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}${BOLD}[WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}${BOLD}[ERROR]${NC} $1"; }

# ------------------------------------------------------------------------------
# Default Settings & Flags
# ------------------------------------------------------------------------------
REPO_URL="https://github.com/Avanti-ui/k8s-monitoring-tool.git"
APP_DIR="/opt/k8s-monitoring-tool"
AI_PROVIDER="groq"
AI_MODEL="llama-3.3-70b-versatile"
AI_API_KEY=""
JWT_SECRET=""
CUSTOM_DOMAIN=""
NON_INTERACTIVE=false
CREATE_SWAP=true

# Parse command line flags
while [[ $# -gt 0 ]]; do
  case $1 in
    -y|--non-interactive)
      NON_INTERACTIVE=true
      shift
      ;;
    --dir)
      APP_DIR="$2"
      shift 2
      ;;
    --repo)
      REPO_URL="$2"
      shift 2
      ;;
    --ai-provider)
      AI_PROVIDER="$2"
      shift 2
      ;;
    --ai-key)
      AI_API_KEY="$2"
      shift 2
      ;;
    --jwt-secret)
      JWT_SECRET="$2"
      shift 2
      ;;
    --domain)
      CUSTOM_DOMAIN="$2"
      shift 2
      ;;
    --skip-swap)
      CREATE_SWAP=false
      shift
      ;;
    -h|--help)
      echo "Usage: sudo $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -y, --non-interactive       Run without interactive prompts"
      echo "  --dir <path>                Application directory (default: /opt/k8s-monitoring-tool)"
      echo "  --repo <url>                Git repository URL"
      echo "  --ai-provider <provider>    AI provider: groq (default), openai, anthropic, azure_openai"
      echo "  --ai-key <key>              API key for the selected AI provider"
      echo "  --jwt-secret <secret>       Secret key for JWT (auto-generated if omitted)"
      echo "  --domain <domain>           Domain name for automatic Let's Encrypt SSL/HTTPS"
      echo "  --skip-swap                 Do not configure 4GB swap space"
      echo "  -h, --help                  Show this help message"
      exit 0
      ;;
    *)
      log_warn "Unknown parameter passed: $1"
      shift
      ;;
  esac
done

# ------------------------------------------------------------------------------
# Pre-flight Checks
# ------------------------------------------------------------------------------
check_root() {
  if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root or with sudo privileges:"
    echo "       sudo $0"
    exit 1
  fi
}

detect_user() {
  # Determine real non-root user (e.g. azureuser / ubuntu)
  if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
    REAL_USER="${SUDO_USER}"
    REAL_HOME=$(getent passwd "${SUDO_USER}" | cut -d: -f6)
  else
    REAL_USER="root"
    REAL_HOME="/root"
  fi
  log_info "Running installation for user: ${BOLD}${REAL_USER}${NC} (Home: ${REAL_HOME})"
}

check_specs() {
  log_info "Analyzing VM hardware and operating system..."
  
  # Check OS
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$NAME
    OS_VER=$VERSION_ID
    log_info "Detected OS: ${OS_NAME} ${OS_VER}"
    if [[ ! "$ID" =~ (ubuntu|debian) ]]; then
      log_warn "This script is optimized for Ubuntu/Debian. Continuing on $ID, but some steps might vary."
    fi
  fi

  # Check vCPUs & RAM
  CPUS=$(nproc)
  TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
  TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))

  log_info "Machine Resources: ${BOLD}${CPUS} vCPUs${NC}, ${BOLD}${TOTAL_RAM_GB} GB RAM${NC}"
  
  if [ "$CPUS" -lt 2 ]; then
    log_warn "At least 2 vCPUs recommended. Found ${CPUS} vCPU."
  fi
  if [ "$TOTAL_RAM_GB" -lt 4 ]; then
    log_warn "At least 4 GB RAM required. Found ${TOTAL_RAM_GB} GB."
  elif [ "$TOTAL_RAM_GB" -ge 15 ]; then
    log_success "Target Azure 4 vCPU / 16 GB RAM profile matched perfectly!"
  fi
}

# ------------------------------------------------------------------------------
# System & Kernel Tuning for 16GB RAM Production VM
# ------------------------------------------------------------------------------
tune_system() {
  log_info "Applying Linux kernel & memory optimizations for 16GB RAM profile..."

  # 1. Swapfile configuration (Azure VMs often don't have swap enabled by default)
  if [ "$CREATE_SWAP" = true ]; then
    SWAP_EXISTS=$(free -m | awk '/Swap/ {print $2}')
    if [ "$SWAP_EXISTS" -lt 1024 ]; then
      log_info "Creating 4 GB swap file for safety under peak loads..."
      fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
      fi
      log_success "4 GB swapfile created and enabled."
    else
      log_info "Existing swap of ${SWAP_EXISTS}MB detected. Skipping swap creation."
    fi
  fi

  # 2. Sysctl parameters for databases (MongoDB, Prometheus, Loki) & network throughput
  cat <<'EOF' > /etc/sysctl.d/99-k8s-monitoring.conf
# Virtual Memory & Memory Mapping for MongoDB & Prometheus
vm.max_map_count = 262144
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# File Descriptors & Inotify
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 512

# Networking & Docker Socket Throughput
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.ip_forward = 1
EOF

  sysctl --system > /dev/null 2>&1
  log_success "Kernel parameters applied (vm.max_map_count=262144, ip_forward=1)."

  # 3. Security Limits
  cat <<'EOF' > /etc/security/limits.d/99-k8s-monitoring.conf
* soft nofile 65536
* hard nofile 65536
* soft nproc  32768
* hard nproc  32768
EOF
}

# ------------------------------------------------------------------------------
# Install Prerequisites & Docker Engine
# ------------------------------------------------------------------------------
install_prerequisites() {
  log_info "Updating system packages & installing dependencies..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    openssl \
    jq \
    ufw \
    htop \
    net-tools \
    tar

  # Install official Docker Engine & Docker Compose plugin
  if ! command -v docker >/dev/null 2>&1; then
    log_info "Installing official Docker Engine and Docker Compose Plugin..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  else
    log_info "Docker is already installed: $(docker --version)"
  fi

  # Configure Docker daemon (log rotation & storage driver)
  mkdir -p /etc/docker
  cat <<'EOF' > /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65536,
      "Soft": 65536
    }
  }
}
EOF
  systemctl restart docker
  systemctl enable docker

  # Add real user to docker group
  if [ "$REAL_USER" != "root" ]; then
    usermod -aG docker "$REAL_USER"
  fi
  log_success "Docker Engine and Docker Compose configured successfully."
}

install_kubectl() {
  if ! command -v kubectl >/dev/null 2>&1; then
    log_info "Installing kubectl CLI..."
    KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt)
    curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
    rm -f kubectl
    log_success "kubectl installed successfully."
  else
    log_info "kubectl already installed."
  fi
}

# ------------------------------------------------------------------------------
# Application Code & Environment Configuration
# ------------------------------------------------------------------------------
setup_application() {
  log_info "Setting up application in ${APP_DIR}..."

  # Check if running inside already cloned repo
  CURRENT_DIR="$(pwd)"
  if [ -f "${CURRENT_DIR}/docker-compose.prod.yml" ]; then
    log_info "Current directory contains the project! Using ${CURRENT_DIR}"
    APP_DIR="${CURRENT_DIR}"
  elif [ -d "${APP_DIR}/.git" ]; then
    log_info "Existing repository found in ${APP_DIR}. Pulling latest changes..."
    cd "${APP_DIR}"
    git pull || true
  else
    log_info "Cloning repository from ${REPO_URL} into ${APP_DIR}..."
    mkdir -p "${APP_DIR}"
    git clone "${REPO_URL}" "${APP_DIR}"
    cd "${APP_DIR}"
  fi

  # Prepare ~/.kube configuration directory so volume mount does not fail
  USER_KUBE_DIR="${REAL_HOME}/.kube"
  mkdir -p "${USER_KUBE_DIR}"
  if [ ! -f "${USER_KUBE_DIR}/config" ]; then
    touch "${USER_KUBE_DIR}/config"
  fi
  chown -R "${REAL_USER}:${REAL_USER}" "${USER_KUBE_DIR}" 2>/dev/null || true

  # Also ensure root has .kube for container binding
  mkdir -p /root/.kube
  touch /root/.kube/config

  # Handle .env configuration
  ENV_FILE="${APP_DIR}/.env"
  if [ ! -f "${ENV_FILE}" ]; then
    log_info "Creating production .env configuration..."

    if [ -z "$JWT_SECRET" ]; then
      JWT_SECRET=$(openssl rand -hex 32)
    fi

    # Interactive key prompt if not provided and not in non-interactive mode
    if [ "$NON_INTERACTIVE" = false ] && [ -z "$AI_API_KEY" ]; then
      echo ""
      echo -e "${CYAN}------------------------------------------------------------${NC}"
      echo -e "${BOLD}AI Configuration (Optional - press Enter to skip or set later)${NC}"
      echo -e "Supported providers: ${BOLD}groq${NC} (recommended/free tier), ${BOLD}openai${NC}, ${BOLD}anthropic${NC}, ${BOLD}azure_openai${NC}"
      echo -e "${CYAN}------------------------------------------------------------${NC}"
      read -rp "Select AI Provider [default: groq]: " INPUT_PROVIDER || true
      if [ -n "$INPUT_PROVIDER" ]; then
        AI_PROVIDER="$INPUT_PROVIDER"
      fi

      read -rsp "Enter API Key for ${AI_PROVIDER} (hidden, or press Enter): " INPUT_KEY || true
      echo ""
      if [ -n "$INPUT_KEY" ]; then
        AI_API_KEY="$INPUT_KEY"
      fi
    fi

    # Format provider specific key
    GROQ_KEY=""
    OPENAI_KEY=""
    ANTHROPIC_KEY=""
    AZURE_KEY=""
    case "$AI_PROVIDER" in
      groq)         GROQ_KEY="$AI_API_KEY" ;;
      openai)     OPENAI_KEY="$AI_API_KEY" ;;
      anthropic)  ANTHROPIC_KEY="$AI_API_KEY" ;;
      azure_openai) AZURE_KEY="$AI_API_KEY" ;;
    esac

    cat <<EOF > "${ENV_FILE}"
# Production Environment Variables for Azure VM
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}

# AI Engine Configuration
AI_ENABLED=true
AI_PROVIDER=${AI_PROVIDER}
AI_MODEL=${AI_MODEL}
GROQ_API_KEY=${GROQ_KEY}
OPENAI_API_KEY=${OPENAI_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
AZURE_OPENAI_API_KEY=${AZURE_KEY}
AZURE_OPENAI_ENDPOINT=

# Slack Alert Webhooks (Optional)
SLACK_WEBHOOK_URL_ALERTS=
SLACK_WEBHOOK_URL_AI_ANALYSIS=
EOF
    log_success ".env created with generated JWT_SECRET and AI settings."
  else
    log_info "Found existing .env file. Keeping existing configurations."
  fi

  # Ensure ownership
  if [ "$REAL_USER" != "root" ]; then
    chown -R "${REAL_USER}:${REAL_USER}" "${APP_DIR}"
  fi
}

# ------------------------------------------------------------------------------
# Systemd Service (Auto-restart on Azure VM reboot)
# ------------------------------------------------------------------------------
setup_systemd_service() {
  log_info "Configuring systemd service for auto-start on VM reboot..."
  
  cat <<EOF > /etc/systemd/system/k8s-monitoring-tool.service
[Unit]
Description=Kubernetes Monitoring Tool Stack (Docker Compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/docker compose -f ${APP_DIR}/docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f ${APP_DIR}/docker-compose.prod.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable k8s-monitoring-tool.service
  log_success "Systemd service 'k8s-monitoring-tool.service' registered and enabled."
}

# ------------------------------------------------------------------------------
# Firewall Setup (UFW)
# ------------------------------------------------------------------------------
configure_firewall() {
  log_info "Configuring host UFW firewall rules..."
  if command -v ufw >/dev/null 2>&1; then
    ufw default deny incoming >/dev/null 2>&1 || true
    ufw default allow outgoing >/dev/null 2>&1 || true
    ufw allow 22/tcp comment "SSH" >/dev/null 2>&1 || true
    ufw allow 80/tcp comment "HTTP Dashboard" >/dev/null 2>&1 || true
    ufw allow 443/tcp comment "HTTPS Dashboard" >/dev/null 2>&1 || true

    # Enable non-interactively
    echo "y" | ufw enable >/dev/null 2>&1 || true
    log_success "UFW configured: Ports 22 (SSH), 80 (HTTP), 443 (HTTPS) allowed."
  fi
}

# ------------------------------------------------------------------------------
# Start Containers & Health Checks
# ------------------------------------------------------------------------------
start_services() {
  log_info "Building and launching production Docker Compose stack..."
  cd "${APP_DIR}"
  docker compose -f docker-compose.prod.yml pull || true
  docker compose -f docker-compose.prod.yml up -d --build

  log_info "Waiting for services to become healthy..."
  local RETRIES=30
  local DELAY=3
  local SUCCESS=false

  for ((i=1; i<=RETRIES; i++)); do
    echo -n "."
    # Check health endpoint on reverse proxy (port 80) or backend direct (port 4000)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      SUCCESS=true
      echo ""
      break
    fi
    sleep "$DELAY"
  done

  if [ "$SUCCESS" = true ]; then
    log_success "All services are up and responding with HTTP 200 OK!"
  else
    echo ""
    log_warn "Health endpoint did not return 200 within 90s. Checking container status..."
    docker compose -f docker-compose.prod.yml ps
  fi
}

# ------------------------------------------------------------------------------
# Public IP & Azure Metadata Detection
# ------------------------------------------------------------------------------
get_public_ip() {
  # Try Azure Instance Metadata Service first (fastest on Azure VM)
  AZURE_IP=$(curl -s -H Metadata:true --connect-timeout 2 "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text" 2>/dev/null || true)
  if [ -n "$AZURE_IP" ]; then
    echo "$AZURE_IP"
    return
  fi

  # Fallback to external resolvers
  EXTERNAL_IP=$(curl -s --connect-timeout 3 https://ifconfig.me 2>/dev/null || curl -s --connect-timeout 3 https://api.ipify.org 2>/dev/null || echo "YOUR_AZURE_VM_IP")
  echo "$EXTERNAL_IP"
}

# ------------------------------------------------------------------------------
# Optional SSL / HTTPS (Let's Encrypt Certbot)
# ------------------------------------------------------------------------------
setup_ssl() {
  if [ -n "$CUSTOM_DOMAIN" ]; then
    log_info "Setting up Let's Encrypt SSL certificate for domain: ${BOLD}${CUSTOM_DOMAIN}${NC}..."
    apt-get install -y -qq certbot python3-certbot-nginx
    
    # Temporarily stop container port 80 to run standalone certbot
    docker compose -f "${APP_DIR}/docker-compose.prod.yml" stop k8s-monitor-frontend
    certbot certonly --standalone -d "${CUSTOM_DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email || log_warn "Certbot failed. Please verify DNS points to this VM IP."
    docker compose -f "${APP_DIR}/docker-compose.prod.yml" start k8s-monitor-frontend
    log_success "SSL certificates obtained at /etc/letsencrypt/live/${CUSTOM_DOMAIN}/"
  fi
}

# ------------------------------------------------------------------------------
# Main Execution Flow
# ------------------------------------------------------------------------------
main() {
  echo ""
  echo -e "${CYAN}================================================================${NC}"
  echo -e "${BOLD} 🚀 Kubernetes Monitoring Tool - Azure VM Deployment (4vCPU / 16GB)${NC}"
  echo -e "${CYAN}================================================================${NC}"
  echo ""

  check_root
  detect_user
  check_specs
  tune_system
  install_prerequisites
  install_kubectl
  setup_application
  setup_systemd_service
  configure_firewall
  start_services
  setup_ssl

  VM_PUBLIC_IP=$(get_public_ip)

  echo ""
  echo -e "${GREEN}================================================================${NC}"
  echo -e "${BOLD} 🎉 DEPLOYMENT COMPLETE!${NC}"
  echo -e "${GREEN}================================================================${NC}"
  echo ""
  echo -e "Web Dashboard URL:    ${BOLD}${CYAN}http://${VM_PUBLIC_IP}${NC}"
  if [ -n "$CUSTOM_DOMAIN" ]; then
    echo -e "Custom Domain HTTPS:  ${BOLD}${CYAN}https://${CUSTOM_DOMAIN}${NC}"
  fi
  echo -e "Backend Health:       ${BOLD}http://${VM_PUBLIC_IP}/health${NC}"
  echo ""
  echo -e "${BOLD}Important Azure NSG Reminder:${NC}"
  echo -e " Ensure your Azure Network Security Group (NSG) allows inbound traffic:"
  echo -e "   - Port ${BOLD}80${NC}   (HTTP)  -> Source: ${BOLD}Internet / 0.0.0.0/0${NC}"
  echo -e "   - Port ${BOLD}443${NC}  (HTTPS) -> Source: ${BOLD}Internet / 0.0.0.0/0${NC}"
  echo -e "   - Port ${BOLD}22${NC}   (SSH)   -> Source: ${BOLD}Your Admin IP${NC}"
  echo ""
  echo -e "${BOLD}Connecting your Remote or Azure AKS Kubernetes Cluster:${NC}"
  echo -e " 1. Run: ${CYAN}az aks get-credentials --resource-group <rg> --name <aks-cluster-name>${NC}"
  echo -e "    or copy your cluster kubeconfig to: ${BOLD}${REAL_HOME}/.kube/config${NC}"
  echo -e " 2. Restart backend: ${CYAN}cd ${APP_DIR} && docker compose -f docker-compose.prod.yml restart k8s-monitor-backend${NC}"
  echo ""
  echo -e "${BOLD}Service Management Commands:${NC}"
  echo -e " - Check Status:     ${CYAN}cd ${APP_DIR} && docker compose -f docker-compose.prod.yml ps${NC}"
  echo -e " - View Logs:        ${CYAN}cd ${APP_DIR} && docker compose -f docker-compose.prod.yml logs -f${NC}"
  echo -e " - Restart Stack:    ${CYAN}sudo systemctl restart k8s-monitoring-tool${NC}"
  echo -e "${CYAN}================================================================${NC}"
}

main "$@"
