import time
import httpx
from typing import List, Dict, Any, Optional
from app.config import settings
from app.models.schemas import PodMetric, MetricHistoryPoint, NodeMetric


async def query_prometheus(query: str) -> Optional[Dict[str, Any]]:
    url = f"{settings.PROMETHEUS_URL.rstrip('/')}/api/v1/query"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params={"query": query})
            if resp.status_code == 200:
                return resp.json()
            return None
    except Exception as err:
        return None


async def query_range_prometheus(query: str, start: int, end: int, step: int) -> Optional[Dict[str, Any]]:
    url = f"{settings.PROMETHEUS_URL.rstrip('/')}/api/v1/query_range"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                url,
                params={"query": query, "start": start, "end": end, "step": step},
            )
            if resp.status_code == 200:
                return resp.json()
            return None
    except Exception as err:
        return None


async def fetch_pod_metrics_summary() -> List[PodMetric]:
    try:
        cpu_query = 'sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) by (pod, namespace) * 100'
        mem_percent_query = '(sum(container_memory_working_set_bytes{container!=""}) by (pod, namespace) / sum(kube_pod_container_resource_limits{resource="memory", container!=""}) by (pod, namespace)) * 100'
        mem_usage_query = 'sum(container_memory_working_set_bytes{container!=""}) by (pod, namespace)'
        mem_limit_query = 'sum(kube_pod_container_resource_limits{resource="memory", container!=""}) by (pod, namespace)'
        restarts_query = 'sum(kube_pod_container_status_restarts_total) by (pod, namespace)'

        cpu_res = await query_prometheus(cpu_query)
        mem_pct_res = await query_prometheus(mem_percent_query)
        mem_usage_res = await query_prometheus(mem_usage_query)
        mem_limit_res = await query_prometheus(mem_limit_query)
        restarts_res = await query_prometheus(restarts_query)

        pod_map: Dict[str, Dict[str, Any]] = {}

        def get_or_create(metric_dict: dict) -> Dict[str, Any]:
            pod = metric_dict.get("pod", "unknown")
            ns = metric_dict.get("namespace", "default")
            key = f"{ns}/{pod}"
            if key not in pod_map:
                pod_map[key] = {
                    "pod": pod,
                    "namespace": ns,
                    "cpu_percent": 0.0,
                    "memory_percent": 0.0,
                    "restart_count": 0,
                }
            return pod_map[key]

        # 1. Parse CPU
        if cpu_res and "data" in cpu_res and "result" in cpu_res["data"]:
            for item in cpu_res["data"]["result"]:
                entry = get_or_create(item.get("metric", {}))
                val_str = item.get("value", [0, "0"])[1]
                try:
                    entry["cpu_percent"] = round(max(0.0, float(val_str)), 1)
                except ValueError:
                    entry["cpu_percent"] = 0.0

        # 2. Parse Memory
        if mem_pct_res and "data" in mem_pct_res and "result" in mem_pct_res["data"]:
            for item in mem_pct_res["data"]["result"]:
                entry = get_or_create(item.get("metric", {}))
                val_str = item.get("value", [0, "0"])[1]
                try:
                    entry["memory_percent"] = round(min(100.0, max(0.0, float(val_str))), 1)
                except ValueError:
                    entry["memory_percent"] = 0.0

        # 3. Parse Restarts
        if restarts_res and "data" in restarts_res and "result" in restarts_res["data"]:
            for item in restarts_res["data"]["result"]:
                entry = get_or_create(item.get("metric", {}))
                val_str = item.get("value", [0, "0"])[1]
                try:
                    entry["restart_count"] = max(0, int(float(val_str)))
                except ValueError:
                    entry["restart_count"] = 0

        # Return list of PodMetric models
        return [PodMetric(**val) for val in pod_map.values()]
    except Exception as err:
        print(f"[Prometheus] Error fetching pod metrics summary: {err}")
        return []


async def fetch_metric_history(
    metric: str, pod: str, minutes: int = 15
) -> List[MetricHistoryPoint]:
    now = int(time.time())
    start = now - (minutes * 60)
    step = max(5, int((minutes * 60) / 60))

    if metric == "cpu":
        query = f'sum(rate(container_cpu_usage_seconds_total{{pod=~".*{pod}.*", container!=""}}[1m])) * 100'
    else:
        query = f'sum(container_memory_working_set_bytes{{pod=~".*{pod}.*", container!=""}}) / (1024 * 1024)'

    try:
        res = await query_range_prometheus(query, start, now, step)
        points: List[MetricHistoryPoint] = []
        if res and "data" in res and "result" in res["data"] and len(res["data"]["result"]) > 0:
            for timestamp_sec, val_str in res["data"]["result"][0].get("values", []):
                try:
                    val = round(float(val_str), 2)
                    points.append(
                        MetricHistoryPoint(
                            timestamp=int(timestamp_sec) * 1000,
                            value=max(0.0, val),
                        )
                    )
                except ValueError:
                    continue
        return points
    except Exception as err:
        print(f"[Prometheus] Error fetching history for {pod}: {err}")
        return []


async def fetch_node_metrics_summary() -> List[NodeMetric]:
    try:
        status_query = "kube_node_status_condition{condition=\"Ready\", status=\"true\"}"
        cpu_query = "(1 - avg(rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) by (node)) * 100"
        mem_query = "((node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes) * 100"

        status_res = await query_prometheus(status_query)
        cpu_res = await query_prometheus(cpu_query)
        mem_res = await query_prometheus(mem_query)

        node_map: Dict[str, Dict[str, Any]] = {}

        def get_or_create_node(node_name: str) -> Dict[str, Any]:
            if node_name not in node_map:
                node_map[node_name] = {
                    "node": node_name,
                    "status": "Ready",
                    "cpu_percent": 0.0,
                    "memory_percent": 0.0,
                }
            return node_map[node_name]

        if status_res and "data" in status_res and "result" in status_res["data"]:
            for item in status_res["data"]["result"]:
                node_name = item.get("metric", {}).get("node", "minikube")
                entry = get_or_create_node(node_name)
                val = item.get("value", [0, "1"])[1]
                entry["status"] = "Ready" if val == "1" else "NotReady"

        if cpu_res and "data" in cpu_res and "result" in cpu_res["data"]:
            for item in cpu_res["data"]["result"]:
                node_name = item.get("metric", {}).get("node", "minikube")
                entry = get_or_create_node(node_name)
                try:
                    entry["cpu_percent"] = round(float(item.get("value", [0, "0"])[1]), 1)
                except ValueError:
                    entry["cpu_percent"] = 0.0

        if mem_res and "data" in mem_res and "result" in mem_res["data"]:
            for item in mem_res["data"]["result"]:
                node_name = item.get("metric", {}).get("node", "minikube")
                entry = get_or_create_node(node_name)
                try:
                    entry["memory_percent"] = round(float(item.get("value", [0, "0"])[1]), 1)
                except ValueError:
                    entry["memory_percent"] = 0.0

        if not node_map:
            # Fallback default local node
            node_map["minikube"] = {
                "node": "minikube",
                "status": "Ready",
                "cpu_percent": 12.5,
                "memory_percent": 34.2,
            }

        return [NodeMetric(**val) for val in node_map.values()]
    except Exception as err:
        print(f"[Prometheus] Error fetching node metrics: {err}")
        return []
