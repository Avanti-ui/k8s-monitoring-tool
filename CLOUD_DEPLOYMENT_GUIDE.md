# ☁️ Cloud Deployment Guide: AWS (EKS) & Azure (AKS)
### Complete All-in-One Setup & Operations Manual for Kubernetes Monitoring Tool

---

## 📑 Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites & CLI Tools](#2-prerequisites--cli-tools)
3. [Containerization (Dockerfiles & Nginx)](#3-containerization-dockerfiles--nginx)
4. [AWS Deployment Guide (EKS + ECR)](#4-aws-deployment-guide-eks--ecr)
   - [Step 1: Authenticate AWS CLI](#step-1-authenticate-aws-cli)
   - [Step 2: Create Amazon EKS Cluster](#step-2-create-amazon-eks-cluster)
   - [Step 3: Setup Amazon ECR & Push Images](#step-3-setup-amazon-ecr--push-images)
   - [Step 4: Install Monitoring Stack (Prometheus + Loki + Promtail)](#step-4-install-monitoring-stack-prometheus--loki--promtail)
   - [Step 5: Deploy Application Stack to EKS](#step-5-deploy-application-stack-to-eks)
   - [Step 6: Access Dashboard & Verify AWS Deployment](#step-6-access-dashboard--verify-aws-deployment)
5. [Azure Deployment Guide (AKS + ACR)](#5-azure-deployment-guide-aks--acr)
   - [Step 1: Authenticate Azure CLI](#step-1-authenticate-azure-cli)
   - [Step 2: Create Resource Group & Azure Container Registry (ACR)](#step-2-create-resource-group--azure-container-registry-acr)
   - [Step 3: Create Azure Kubernetes Service (AKS) Cluster](#step-3-create-azure-kubernetes-service-aks-cluster)
   - [Step 4: Build & Push Images to ACR](#step-4-build--push-images-to-acr)
   - [Step 5: Install Monitoring Stack (Prometheus + Loki + Promtail)](#step-5-install-monitoring-stack-prometheus--loki--promtail-1)
   - [Step 6: Deploy Application Stack to AKS](#step-6-deploy-application-stack-to-aks)
   - [Step 7: Access Dashboard & Verify Azure Deployment](#step-7-access-dashboard--verify-azure-deployment)
6. [Managed Database Options (AWS DocumentDB & Azure Cosmos DB)](#6-managed-database-options)
7. [Kubernetes Manifests Reference](#7-kubernetes-manifests-reference)
8. [Troubleshooting & Diagnostics](#8-troubleshooting--diagnostics)
9. [Teardown & Cost Cleanup](#9-teardown--cost-cleanup)

---

## 1. Architecture Overview

When deployed onto AWS EKS or Azure AKS, all components operate natively inside the cluster:

```
                      +──────────────────────────────────────────+
                      |         Internet / User Browser          |
                      +─────────────────────┬────────────────────+
                                            │
                    Load Balancer (AWS ALB / Azure Load Balancer)
                                            │
                                 +──────────▼──────────+
                                 |  Frontend (NGINX)   |
                                 |  Port 80 (React UI) |
                                 +──────────┬──────────+
                                            │ /api reverse-proxy
                                 +──────────▼──────────+
                                 |  Backend (FastAPI)  |
                                 |      Port 4000      |
                                 +───┬──────┬───────┬──+
                                     │      │       │
             ┌───────────────────────┘      │       └────────────────────────┐
             ▼                              ▼                                ▼
  +─────────────────────+        +─────────────────────+          +─────────────────────+
  |  MongoDB Database   |        | Prometheus Operator |          |     Grafana Loki    |
  | (StatefulSet / DB)  |        | (Metrics Collector) |          |   (Log Aggregator)  |
  +─────────────────────+        +──────────▲──────────+          +──────────▲──────────+
                                            │                                │
                                  [Kubelet / Node / Pods]           [Promtail DaemonSet]
```

### Component Network Mapping:
- **Frontend**: Serves React SPA & proxies `/api/*` and `/health` requests directly to backend service `http://k8s-monitor-backend:4000`.
- **Backend**: FastAPI connecting to:
  - Prometheus: `http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090`
  - Loki: `http://loki.monitoring.svc.cluster.local:3100`
  - MongoDB: `mongodb://mongodb.monitoring.svc.cluster.local:27017/k8s-monitor` (or managed URI)
- **Monitoring Agents**:
  - `kube-prometheus-stack`: Scrapes Kubernetes metrics across all nodes and pods.
  - `promtail`: Runs as a DaemonSet to stream stdout/stderr pod logs into Loki.

---

## 2. Prerequisites & CLI Tools

Before deploying, ensure you have the following CLI tools installed on your local workstation:

| Tool | Minimum Version | Installation Link | Purpose |
| :--- | :--- | :--- | :--- |
| **Docker** | `24.0+` | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) | Build & push container images |
| **kubectl** | `v1.28+` | [kubernetes.io/docs/tasks/tools/](https://kubernetes.io/docs/tasks/tools/) | Kubernetes cluster management |
| **Helm** | `v3.12+` | [helm.sh/docs/intro/install/](https://helm.sh/docs/intro/install/) | Install Prometheus & Loki stacks |
| **AWS CLI** | `v2.15+` | [aws.amazon.com/cli/](https://aws.amazon.com/cli/) | Manage AWS cloud resources |
| **eksctl** | `v0.170+` | [eksctl.io/installation/](https://eksctl.io/installation/) | Provision EKS clusters easily |
| **Azure CLI** | `v2.55+` | [learn.microsoft.com/cli/azure](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) | Manage Azure & AKS resources |

---

## 3. Containerization (Dockerfiles & Nginx)

The project includes production-ready Dockerfiles for both backend and frontend:

### Backend Dockerfile (`backend/Dockerfile`)
```dockerfile
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

COPY . .

EXPOSE 4000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000"]
```

### Frontend Dockerfile (`frontend/Dockerfile`)
```dockerfile
# Stage 1: Build React Vite app
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Serve via NGINX with reverse proxy
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Frontend NGINX Configuration (`frontend/nginx.conf`)
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://k8s-monitor-backend:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://k8s-monitor-backend:4000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

---

## 4. AWS Deployment Guide (EKS + ECR)

### Step 1: Authenticate AWS CLI
```bash
# Configure credentials
aws configure

# Verify authentication
aws sts get-caller-identity
```

### Step 2: Create Amazon EKS Cluster
Set your target region and cluster name:
```bash
export AWS_REGION="us-east-1"
export CLUSTER_NAME="k8s-monitor-eks"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Provision EKS Cluster with managed node group (2 nodes, t3.medium)
eksctl create cluster \
  --name $CLUSTER_NAME \
  --region $AWS_REGION \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 4 \
  --managed

# Connect kubectl to EKS
aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME

# Verify cluster connectivity
kubectl get nodes
```

### Step 3: Setup Amazon ECR & Push Images
```bash
# 1. Create ECR repositories
aws ecr create-repository --repository-name k8s-monitor-backend --region $AWS_REGION || true
aws ecr create-repository --repository-name k8s-monitor-frontend --region $AWS_REGION || true

# 2. Authenticate Docker to Amazon ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# 3. Build and push Backend image
docker build -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/k8s-monitor-backend:latest ./backend
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/k8s-monitor-backend:latest

# 4. Build and push Frontend image
docker build -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/k8s-monitor-frontend:latest ./frontend
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/k8s-monitor-frontend:latest
```

### Step 4: Install Monitoring Stack (Prometheus + Loki + Promtail)
```bash
# Create monitoring namespace
kubectl create namespace monitoring

# Add Helm Repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack (Prometheus + Kube-State-Metrics + Node Exporter)
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.service.type=ClusterIP \
  --set alertmanager.enabled=false \
  --set grafana.enabled=false

# Install Loki (Log aggregation engine)
helm install loki grafana/loki \
  --namespace monitoring \
  --set "persistence.enabled=true,persistence.size=10Gi"

# Install Promtail (Pod log shipper to Loki)
helm install promtail grafana/promtail \
  --namespace monitoring \
  --set "config.clients[0].url=http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push"
```

### Step 5: Deploy Application Stack to EKS
Update the image URLs in `k8s/app-deployment.yaml` and deploy:

```bash
# Substitute your AWS ECR Registry in the deployment manifest
sed -i.bak "s|YOUR_REGISTRY|$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com|g" k8s/app-deployment.yaml

# (Optional) Update your AI API keys or Slack webhooks in the secret inside k8s/app-deployment.yaml

# Apply the application deployment manifest
kubectl apply -f k8s/app-deployment.yaml
```

### Step 6: Access Dashboard & Verify AWS Deployment
```bash
# Wait for pods to become Ready
kubectl get pods -n monitoring -w

# Retrieve AWS Load Balancer External Address
kubectl get svc k8s-monitor-frontend -n monitoring
```

Copy the `EXTERNAL-IP` (e.g. `a1b2c3d4e5...us-east-1.elb.amazonaws.com`) and open it in your browser:
👉 **`http://<YOUR-ALB-OR-ELB-DNS-NAME>`**

---

## 5. Azure Deployment Guide (AKS + ACR)

### Step 1: Authenticate Azure CLI
```bash
# Login to Azure account
az login

# List subscriptions and set active subscription
az account list --output table
az account set --subscription "<YOUR_SUBSCRIPTION_ID_OR_NAME>"
```

### Step 2: Create Resource Group & Azure Container Registry (ACR)
```bash
export RESOURCE_GROUP="k8s-monitor-rg"
export LOCATION="eastus"
export ACR_NAME="k8smonitoracr$RANDOM"
export AKS_CLUSTER_NAME="k8s-monitor-aks"

# 1. Create Resource Group
az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. Create Azure Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Retrieve ACR Login Server
export ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output text)
echo "ACR Server: $ACR_SERVER"
```

### Step 3: Create Azure Kubernetes Service (AKS) Cluster
```bash
# Provision AKS Cluster attached to ACR
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --node-count 2 \
  --node-vm-size Standard_D2s_v3 \
  --enable-managed-identity \
  --attach-acr $ACR_NAME \
  --generate-ssh-keys

# Get AKS credentials for kubectl
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_CLUSTER_NAME --overwrite-existing

# Verify cluster connectivity
kubectl get nodes
```

### Step 4: Build & Push Images to ACR
You can build directly in the cloud with ACR Tasks (no local Docker required), or build and push with Docker:

#### Option A: Build directly in Cloud with `az acr build` (Fastest)
```bash
# Build Backend image in ACR
az acr build --registry $ACR_NAME --image k8s-monitor-backend:latest ./backend

# Build Frontend image in ACR
az acr build --registry $ACR_NAME --image k8s-monitor-frontend:latest ./frontend
```

#### Option B: Build locally with Docker & Push
```bash
az acr login --name $ACR_NAME
docker build -t $ACR_SERVER/k8s-monitor-backend:latest ./backend
docker push $ACR_SERVER/k8s-monitor-backend:latest

docker build -t $ACR_SERVER/k8s-monitor-frontend:latest ./frontend
docker push $ACR_SERVER/k8s-monitor-frontend:latest
```

### Step 5: Install Monitoring Stack (Prometheus + Loki + Promtail)
```bash
# Create monitoring namespace
kubectl create namespace monitoring

# Add Helm Repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.service.type=ClusterIP \
  --set alertmanager.enabled=false \
  --set grafana.enabled=false

# Install Loki
helm install loki grafana/loki \
  --namespace monitoring \
  --set "persistence.enabled=true,persistence.size=10Gi"

# Install Promtail
helm install promtail grafana/promtail \
  --namespace monitoring \
  --set "config.clients[0].url=http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push"
```

### Step 6: Deploy Application Stack to AKS
```bash
# Substitute your Azure ACR Registry in the deployment manifest
sed -i.bak "s|YOUR_REGISTRY|$ACR_SERVER|g" k8s/app-deployment.yaml

# Apply the application deployment manifest
kubectl apply -f k8s/app-deployment.yaml
```

### Step 7: Access Dashboard & Verify Azure Deployment
```bash
# Wait for pods and public IP assignment
kubectl get pods -n monitoring -w
kubectl get svc k8s-monitor-frontend -n monitoring
```

Copy the Azure Public `EXTERNAL-IP` (e.g. `20.x.x.x`) and open in your browser:
👉 **`http://<AZURE_PUBLIC_IP>`**

---

## 6. Managed Database Options

By default, `k8s/app-deployment.yaml` includes an in-cluster MongoDB StatefulSet. For production high-availability, you can switch to a managed cloud database:

### AWS: Amazon DocumentDB (MongoDB compatible)
1. Provision DocumentDB Cluster:
   ```bash
   aws docdb create-db-cluster \
     --db-cluster-identifier k8s-monitor-docdb \
     --engine docdb \
     --master-username dbadmin \
     --master-user-password "YourStrongPassword123!"
   ```
2. Update `MONGO_URI` in `k8s-monitor-backend-config`:
   ```yaml
   MONGO_URI: "mongodb://dbadmin:YourStrongPassword123@k8s-monitor-docdb.cluster-xxx.us-east-1.docdb.amazonaws.com:27017/k8s-monitor?tls=true&tlsCAFile=/etc/ssl/certs/rds-combined-ca-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
   ```

### Azure: Azure Cosmos DB (for MongoDB API)
1. Provision Cosmos DB MongoDB Account:
   ```bash
   az cosmosdb create \
     --name k8s-monitor-cosmos-mongo \
     --resource-group $RESOURCE_GROUP \
     --kind MongoDB \
     --server-version 4.2
   ```
2. Retrieve connection string:
   ```bash
   az cosmosdb keys list --name k8s-monitor-cosmos-mongo --resource-group $RESOURCE_GROUP --type connection-strings
   ```
3. Set the connection string in `k8s-monitor-backend-config` as `MONGO_URI`.

---

## 7. Kubernetes Manifests Reference

The unified deployment manifest is stored in [`k8s/app-deployment.yaml`](file:///home/d33/Templates/k8s-monitoring-tool/k8s/app-deployment.yaml) and contains:
1. **Namespace**: `monitoring`
2. **MongoDB StatefulSet & Headless Service**: Persistent data storage with 10Gi volume claim.
3. **Backend ServiceAccount & RBAC**: Grants cluster-level read permissions for node and pod auto-discovery.
4. **Backend ConfigMap & Secret**: Configures Prometheus/Loki cluster URLs, AI settings (`GROQ_API_KEY`, `OPENAI_API_KEY`, etc.), and Slack webhooks.
5. **Backend Deployment & ClusterIP Service**: Scalable FastAPI application.
6. **Frontend Deployment & LoadBalancer Service**: NGINX web server proxying traffic.

---

## 8. Troubleshooting & Diagnostics

### 1. Check Pod Status & Logs
```bash
# Check all pods in monitoring namespace
kubectl get pods -n monitoring

# View Backend logs
kubectl logs -n monitoring deployment/k8s-monitor-backend --tail=100 -f

# View Frontend logs
kubectl logs -n monitoring deployment/k8s-monitor-frontend --tail=50

# View Promtail logs
kubectl logs -n monitoring daemonset/promtail --tail=50
```

### 2. Verify In-Cluster Prometheus & Loki Connectivity
```bash
# Exec into backend container and test Prometheus endpoint
kubectl exec -it -n monitoring deployment/k8s-monitor-backend -- \
  curl -s http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090/api/v1/query?query=up

# Exec into backend container and test Loki endpoint
kubectl exec -it -n monitoring deployment/k8s-monitor-backend -- \
  curl -s http://loki.monitoring.svc.cluster.local:3100/ready
```

### 3. Deploy Test Pods to Trigger Alerts
```bash
# Deploy a healthy pod
kubectl run k8s-demo-app --image=nginx:alpine --port=80

# Deploy a crash-looping pod to test AI incident alerts
kubectl run crash-test-pod --image=busybox --restart=Always -- /bin/sh -c "sleep 5; exit 1"
```

---

## 9. Teardown & Cost Cleanup

To prevent ongoing cloud charges when finished testing:

### Tear Down AWS Resources:
```bash
# 1. Delete Kubernetes resources
kubectl delete -f k8s/app-deployment.yaml --ignore-not-found
helm uninstall promtail loki monitoring -n monitoring || true

# 2. Delete ECR Repositories
aws ecr delete-repository --repository-name k8s-monitor-backend --force --region $AWS_REGION
aws ecr delete-repository --repository-name k8s-monitor-frontend --force --region $AWS_REGION

# 3. Delete EKS Cluster & associated VPC / Load Balancers
eksctl delete cluster --name $CLUSTER_NAME --region $AWS_REGION
```

### Tear Down Azure Resources:
```bash
# Deleting the resource group deletes AKS, ACR, and all associated Public IPs / Disks
az group delete --name $RESOURCE_GROUP --yes --no-wait
```
