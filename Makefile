MINIKUBE_HOST_IP  := 192.168.49.1
LOKI_PUSH_URL     := http://$(MINIKUBE_HOST_IP):3100/loki/api/v1/push
PROMETHEUS_NS     := monitoring
PROMETHEUS_SVC    := svc/monitoring-kube-prometheus-prometheus
PROMETHEUS_PORT   := 9090

.PHONY: help \
        infra-up infra-down \
        k8s-helm-repos k8s-prometheus k8s-promtail k8s-stack \
        k8s-port-forward \
        k8s-demo-pods k8s-demo-pods-clean \
        backend frontend \
        up-local up-k8s \
        stop status clean

# ------------------------------------------------------------
# Default target
# ------------------------------------------------------------
help:
	@echo ""
	@echo "  K8s Monitoring Tool — available targets"
	@echo ""
	@echo "  ── Infrastructure ──────────────────────────────────"
	@echo "  infra-up            Start MongoDB + Loki (+ standalone Prometheus)"
	@echo "  infra-down          Stop all Docker Compose containers"
	@echo ""
	@echo "  ── Kubernetes Setup (Option B) ──────────────────────"
	@echo "  k8s-helm-repos      Add Prometheus & Grafana Helm repos"
	@echo "  k8s-prometheus      Install kube-prometheus-stack via Helm"
	@echo "  k8s-promtail        Install Promtail (log shipper → Loki)"
	@echo "  k8s-stack           Run all Helm installs (repos + prometheus + promtail)"
	@echo "  k8s-port-forward    Forward Minikube Prometheus → localhost:9090"
	@echo "  k8s-demo-pods       Deploy sample nginx + crash-loop pods"
	@echo "  k8s-demo-pods-clean Delete the demo pods"
	@echo ""
	@echo "  ── App Servers ──────────────────────────────────────"
	@echo "  backend             Start FastAPI backend on :4000 (hot-reload)"
	@echo "  frontend            Start Vite frontend on :3000"
	@echo ""
	@echo "  ── Full Stack Shortcuts ─────────────────────────────"
	@echo "  up-local            Option A: infra + backend + frontend (no K8s)"
	@echo "  up-k8s              Option B: infra (no standalone Prometheus) +"
	@echo "                      port-forward + demo pods (then run backend &"
	@echo "                      frontend manually in separate terminals)"
	@echo ""
	@echo "  ── Utilities ────────────────────────────────────────"
	@echo "  stop                Kill dev servers and free ports"
	@echo "  status              Show Minikube, pods, and Docker status"
	@echo "  clean               infra-down + delete demo pods"
	@echo ""

# ------------------------------------------------------------
# Infrastructure (Docker Compose)
# ------------------------------------------------------------
infra-up:
	@echo "▶  Starting infrastructure containers..."
	npm run infra:up

infra-down:
	@echo "▶  Stopping infrastructure containers..."
	npm run infra:down

# ------------------------------------------------------------
# Kubernetes / Helm
# ------------------------------------------------------------
k8s-helm-repos:
	@echo "▶  Adding Helm repositories..."
	helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
	helm repo add grafana https://grafana.github.io/helm-charts
	helm repo update

k8s-prometheus:
	@echo "▶  Installing kube-prometheus-stack..."
	helm install monitoring prometheus-community/kube-prometheus-stack \
		--namespace $(PROMETHEUS_NS) --create-namespace

k8s-promtail:
	@echo "▶  Installing Promtail (log shipper → Loki)..."
	helm install promtail grafana/promtail \
		--namespace $(PROMETHEUS_NS) \
		--set "config.clients[0].url=$(LOKI_PUSH_URL)"

k8s-stack: k8s-helm-repos k8s-prometheus k8s-promtail
	@echo "✔  Full Kubernetes monitoring stack installed."

k8s-port-forward:
	@echo "▶  Forwarding Prometheus → localhost:$(PROMETHEUS_PORT)  (Ctrl-C to stop)"
	kubectl port-forward -n $(PROMETHEUS_NS) $(PROMETHEUS_SVC) $(PROMETHEUS_PORT):$(PROMETHEUS_PORT)

k8s-demo-pods:
	@echo "▶  Deploying demo pods..."
	kubectl run k8s-demo-app --image=nginx:alpine --port=80 --dry-run=client -o name | xargs -I{} echo "creating {}" 
	kubectl run k8s-demo-app --image=nginx:alpine --port=80 2>/dev/null || echo "k8s-demo-app already exists"
	kubectl run crash-test-pod --image=busybox --restart=Always -- /bin/sh -c "sleep 5; exit 1" 2>/dev/null || echo "crash-test-pod already exists"
	@echo "✔  Demo pods created."

k8s-demo-pods-clean:
	@echo "▶  Deleting demo pods..."
	kubectl delete pod k8s-demo-app crash-test-pod --ignore-not-found

# ------------------------------------------------------------
# App servers (run in foreground — open separate terminals)
# ------------------------------------------------------------
backend:
	@echo "▶  Starting backend on http://localhost:4000 ..."
	npm run backend:dev

frontend:
	@echo "▶  Starting frontend on http://localhost:3000 ..."
	npm run frontend:dev

# ------------------------------------------------------------
# Full-stack shortcuts
# ------------------------------------------------------------
up-local: infra-up
	@echo ""
	@echo "✔  Infrastructure is up."
	@echo "   Run in separate terminals:"
	@echo "     make backend"
	@echo "     make frontend"
	@echo ""

up-k8s: infra-up
	@echo "▶  Stopping standalone Prometheus (port 9090 needed for K8s)..."
	docker stop k8s-monitor-prometheus 2>/dev/null || true
	@echo "▶  Deploying demo pods..."
	$(MAKE) k8s-demo-pods
	@echo ""
	@echo "✔  Infrastructure ready for K8s mode."
	@echo "   Now run each of these in a separate terminal:"
	@echo "     make k8s-port-forward   ← keep this running"
	@echo "     make backend"
	@echo "     make frontend"
	@echo ""

# ------------------------------------------------------------
# Utilities
# ------------------------------------------------------------
stop:
	@echo "▶  Freeing ports 3000 4000 9090 3100 27017..."
	fuser -k 3000/tcp 4000/tcp 9090/tcp 3100/tcp 27017/tcp 2>/dev/null || true

status:
	@echo "── Minikube ─────────────────────────────────"
	minikube status
	@echo "── Pods (monitoring namespace) ──────────────"
	kubectl get pods -n monitoring
	@echo "── Pods (default namespace) ─────────────────"
	kubectl get pods
	@echo "── Docker containers ────────────────────────"
	docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

clean: infra-down k8s-demo-pods-clean
	@echo "✔  Environment cleaned up."
