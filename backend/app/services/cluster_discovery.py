import os
import re
import yaml
import httpx
from typing import List, Dict, Optional, Set
from pathlib import Path
from app.config import settings
from app.models.schemas import DiscoveredCluster, ClusterProvider


class ClusterDiscoveryService:
    _instance: Optional["ClusterDiscoveryService"] = None

    def __init__(self):
        self._cached_clusters: List[DiscoveredCluster] = []
        self._is_scanning: bool = False
        self.manual_config_file = Path.cwd() / "clusters.yaml"

    @classmethod
    def get_instance(cls) -> "ClusterDiscoveryService":
        if cls._instance is None:
            cls._instance = ClusterDiscoveryService()
        return cls._instance

    async def get_clusters(self, force_rescan: bool = False) -> List[DiscoveredCluster]:
        if not self._cached_clusters or force_rescan:
            return await self.discover_clusters()
        return self._cached_clusters

    async def discover_clusters(self) -> List[DiscoveredCluster]:
        if self._is_scanning:
            return self._cached_clusters
        self._is_scanning = True

        try:
            discovered_map: Dict[str, DiscoveredCluster] = {}
            config_files = self._resolve_kubeconfig_paths()

            for file_path in config_files:
                try:
                    if not os.path.exists(file_path):
                        continue
                    with open(file_path, "r", encoding="utf-8") as f:
                        parsed = yaml.safe_load(f)

                    if not isinstance(parsed, dict) or not isinstance(parsed.get("contexts"), list):
                        continue

                    cluster_lookup = {
                        c.get("name"): c.get("cluster", {})
                        for c in parsed.get("clusters", [])
                        if isinstance(c, dict) and "name" in c
                    }

                    for ctx in parsed.get("contexts", []):
                        if not isinstance(ctx, dict) or not ctx.get("name") or not ctx.get("context"):
                            continue

                        context_name = ctx["name"]
                        ctx_body = ctx["context"]
                        cluster_name = ctx_body.get("cluster", "")
                        cluster_obj = cluster_lookup.get(cluster_name, {})

                        provider = self._infer_provider(
                            context_name, cluster_name, cluster_obj.get("server", "")
                        )
                        display_name = self._derive_display_name(context_name, cluster_name, provider)

                        cluster_entry = DiscoveredCluster(
                            id=self._slugify(context_name),
                            name=context_name,
                            displayName=display_name,
                            provider=provider,
                            server=cluster_obj.get("server", ""),
                            contextName=context_name,
                            sourceFile=str(file_path),
                            isReachable=False,
                            defaultNamespace=ctx_body.get("namespace", "default"),
                            isManualOverride=False,
                        )
                        discovered_map[context_name] = cluster_entry
                except Exception as err:
                    print(f"[ClusterDiscovery] Failed to parse kubeconfig '{file_path}': {err}")

            # Merge manual overrides from clusters.yaml
            manual_overrides = self._load_manual_overrides()
            for manual in manual_overrides:
                key = manual.get("name") or manual.get("id")
                if not key:
                    continue
                existing = discovered_map.get(key)
                merged = DiscoveredCluster(
                    id=manual.get("id") or (existing.id if existing else self._slugify(key)),
                    name=manual.get("name") or (existing.name if existing else key),
                    displayName=manual.get("displayName") or (existing.displayName if existing else key),
                    provider=manual.get("provider") or (existing.provider if existing else "unknown"),
                    server=manual.get("server") or (existing.server if existing else ""),
                    contextName=manual.get("contextName") or (existing.contextName if existing else key),
                    sourceFile=manual.get("kubeconfigPath") or (existing.sourceFile if existing else "clusters.yaml"),
                    isReachable=False,
                    isManualOverride=True,
                )
                discovered_map[key] = merged

            clusters_list = list(discovered_map.values())

            # Fallback default cluster if nothing found
            if not clusters_list:
                clusters_list.append(
                    DiscoveredCluster(
                        id="local-cluster",
                        name="production-k8s-cluster",
                        displayName="production-k8s-cluster (Local)",
                        provider="minikube",
                        server=settings.K8S_API_SERVER or "http://localhost:8001",
                        contextName="minikube",
                        sourceFile="environment",
                        isReachable=True,
                        statusMessage="Online (Direct Scrape)",
                        latencyMs=1,
                    )
                )

            # Probe connectivity in parallel
            await self._probe_all_clusters(clusters_list)

            self._cached_clusters = clusters_list
            print(f"[ClusterDiscovery] Discovered {len(clusters_list)} clusters")
            return self._cached_clusters
        finally:
            self._is_scanning = False

    def _resolve_kubeconfig_paths(self) -> List[str]:
        paths: Set[str] = set()
        home_dir = os.path.expanduser("~")
        default_kube_dir = os.path.join(home_dir, ".kube")

        if settings.KUBECONFIG:
            for p in settings.KUBECONFIG.split(os.pathsep):
                resolved = os.path.expanduser(p.strip())
                if os.path.exists(resolved):
                    paths.add(resolved)

        default_config = os.path.join(default_kube_dir, "config")
        if os.path.exists(default_config):
            paths.add(default_config)

        if os.path.exists(default_kube_dir):
            try:
                for entry in os.listdir(default_kube_dir):
                    if entry.endswith((".yaml", ".yml", ".config")):
                        paths.add(os.path.join(default_kube_dir, entry))
            except Exception as err:
                print(f"[ClusterDiscovery] Error scanning ~/.kube: {err}")

        return list(paths)

    def _infer_provider(self, context_name: str, cluster_name: str = "", server: str = "") -> ClusterProvider:
        combined = f"{context_name} {cluster_name} {server}".lower()
        if "arn:aws:eks" in combined or "eks.amazonaws.com" in combined or "eks" in combined:
            return "eks"
        if "providers/microsoft.containerservice/managedclusters" in combined or "azmk8s.io" in combined or "aks" in combined:
            return "aks"
        if combined.startswith("gke_") or ".gke." in combined or "gke" in combined:
            return "gke"
        if "minikube" in combined:
            return "minikube"
        if "kind-" in combined or "kind" in combined:
            return "kind"
        if "k3s" in combined:
            return "k3s"
        return "unknown"

    def _derive_display_name(self, context_name: str, cluster_name: str, provider: ClusterProvider) -> str:
        arn_match = re.search(r"cluster/([a-zA-Z0-9._-]+)$", context_name)
        if arn_match:
            return f"{arn_match.group(1)} (EKS)"

        if context_name.startswith("gke_"):
            parts = context_name.split("_")
            return f"{parts[-1]} (GKE)"

        if provider == "aks":
            clean_aks = re.sub(r"^aks-?", "", context_name, flags=re.IGNORECASE)
            return f"{clean_aks} (AKS)"

        if provider == "minikube":
            return "minikube (Local)"
        if provider == "kind":
            return f"{context_name} (Kind)"

        return context_name

    async def _probe_all_clusters(self, clusters: List[DiscoveredCluster]):
        async with httpx.AsyncClient(verify=False, timeout=2.5) as client:
            for cluster in clusters:
                if not cluster.server:
                    cluster.isReachable = False
                    cluster.statusMessage = "No API server endpoint"
                    continue

                try:
                    url = f"{cluster.server.rstrip('/')}/version"
                    resp = await client.get(url)
                    if resp.status_code < 500:
                        cluster.isReachable = True
                        cluster.statusMessage = "Online"
                    else:
                        cluster.isReachable = False
                        cluster.statusMessage = f"HTTP {resp.status_code}"
                except Exception as err:
                    cluster.isReachable = False
                    cluster.statusMessage = "Unreachable"

    def _load_manual_overrides(self) -> List[dict]:
        if not self.manual_config_file.exists():
            return []
        try:
            with open(self.manual_config_file, "r", encoding="utf-8") as f:
                parsed = yaml.safe_load(f)
            return parsed.get("clusters", []) if isinstance(parsed, dict) else []
        except Exception:
            return []

    def _slugify(self, text: str) -> str:
        return re.sub(r"[^a-z0-9_-]+", "-", text.lower()).strip("-")
